import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestDatabase, type TestDatabase } from '../helpers/database';

/**
 * MVP-BACKLOG-007 : création, lecture, relation, et surtout REFUS.
 *
 * Les tests de refus comptent davantage que les tests de succès. Une contrainte
 * que rien ne vérifie finit par disparaître d'un schéma, et le défaut n'apparaît
 * qu'en production, sur de l'argent.
 */
describe('Contraintes du schéma initial', () => {
  let harness: TestDatabase;

  const organizationId = '11111111-1111-4111-8111-111111111111';
  const otherOrganizationId = '22222222-2222-4222-8222-222222222222';
  const propertyId = '11111111-1111-4111-8111-111111111120';
  const otherPropertyId = '11111111-1111-4111-8111-111111111121';

  beforeAll(async () => {
    harness = await createTestDatabase();
    const { db, schema } = harness;

    await db.insert(schema.organizations).values([
      { id: organizationId, name: 'Organisation A', type: 'COMPANY' },
      { id: otherOrganizationId, name: 'Organisation B', type: 'INDIVIDUAL' },
    ]);

    await db.insert(schema.properties).values([
      { id: propertyId, organizationId, name: 'Immeuble A' },
      { id: otherPropertyId, organizationId, name: 'Immeuble A bis' },
    ]);
  }, 60_000);

  afterAll(async () => {
    await harness?.close();
  });

  // --- Création et lecture ---------------------------------------------------

  it('crée et relit une organisation avec ses valeurs par défaut', async () => {
    const { db, schema } = harness;

    const rows = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, organizationId));

    expect(rows[0]?.name).toBe('Organisation A');
    // Devise par défaut du marché initial (DEC-014).
    expect(rows[0]?.defaultCurrency).toBe('GNF');
    // L'archivage est un horodatage, nul par défaut (DEC-020).
    expect(rows[0]?.archivedAt).toBeNull();
  });

  it('applique le statut VACANT par défaut à un appartement', async () => {
    const { db, schema } = harness;

    const inserted = await db
      .insert(schema.apartments)
      .values({ organizationId, propertyId, number: 'DEF01' })
      .returning();

    // Le terme officiel est « Vacant », jamais AVAILABLE (DEC-019).
    expect(inserted[0]?.status).toBe('VACANT');
  });

  // --- Relation --------------------------------------------------------------

  it('relie un appartement à son immeuble et à son organisation', async () => {
    const { db, schema } = harness;

    await db.insert(schema.apartments).values({ organizationId, propertyId, number: 'REL01' });

    const rows = await db
      .select({
        apartmentNumber: schema.apartments.number,
        propertyName: schema.properties.name,
        organizationName: schema.organizations.name,
      })
      .from(schema.apartments)
      .innerJoin(schema.properties, eq(schema.properties.id, schema.apartments.propertyId))
      .innerJoin(
        schema.organizations,
        eq(schema.organizations.id, schema.apartments.organizationId),
      )
      .where(eq(schema.apartments.number, 'REL01'));

    expect(rows[0]).toEqual({
      apartmentNumber: 'REL01',
      propertyName: 'Immeuble A',
      organizationName: 'Organisation A',
    });
  });

  // --- Unicité ---------------------------------------------------------------

  it('refuse deux appartements de même numéro dans un même immeuble', async () => {
    const { db, schema } = harness;

    await db.insert(schema.apartments).values({ organizationId, propertyId, number: 'UNI01' });

    await expect(
      db.insert(schema.apartments).values({ organizationId, propertyId, number: 'UNI01' }),
    ).rejects.toThrow();
  });

  it('accepte le même numéro dans deux immeubles différents', async () => {
    const { db, schema } = harness;

    await db
      .insert(schema.apartments)
      .values({ organizationId, propertyId: otherPropertyId, number: 'UNI01' });

    const rows = await db
      .select()
      .from(schema.apartments)
      .where(eq(schema.apartments.number, 'UNI01'));

    // Le numéro est unique par immeuble, pas globalement.
    expect(rows).toHaveLength(2);
  });

  it('refuse deux immeubles de même nom dans une même organisation', async () => {
    const { db, schema } = harness;

    await expect(
      db.insert(schema.properties).values({ organizationId, name: 'Immeuble A' }),
    ).rejects.toThrow();
  });

  it('accepte le même nom dans deux organisations différentes', async () => {
    const { db, schema } = harness;

    const inserted = await db
      .insert(schema.properties)
      .values({ organizationId: otherOrganizationId, name: 'Immeuble A' })
      .returning();

    expect(inserted[0]?.organizationId).toBe(otherOrganizationId);
  });

  // --- Convention monétaire (DEC-014) ---------------------------------------

  it('refuse un montant sans devise', async () => {
    const { db, schema } = harness;

    await expect(
      db
        .insert(schema.apartments)
        .values({ organizationId, propertyId, number: 'MON01', referenceRentAmount: 2500000 }),
    ).rejects.toThrow();
  });

  it('refuse une devise sans montant', async () => {
    const { db, schema } = harness;

    await expect(
      db
        .insert(schema.apartments)
        .values({ organizationId, propertyId, number: 'MON02', currency: 'GNF' }),
    ).rejects.toThrow();
  });

  it('accepte un montant entier accompagné de sa devise', async () => {
    const { db, schema } = harness;

    const inserted = await db
      .insert(schema.apartments)
      .values({
        organizationId,
        propertyId,
        number: 'MON03',
        referenceRentAmount: 2500000,
        currency: 'GNF',
      })
      .returning();

    // 2 500 000 GNF stocké comme entier : le GNF n'a pas de sous-unité.
    expect(inserted[0]?.referenceRentAmount).toBe(2500000);
    expect(inserted[0]?.currency).toBe('GNF');
  });

  it('refuse un montant négatif', async () => {
    const { db, schema } = harness;

    await expect(
      db.insert(schema.apartments).values({
        organizationId,
        propertyId,
        number: 'MON04',
        referenceRentAmount: -1,
        currency: 'GNF',
      }),
    ).rejects.toThrow();
  });

  it('refuse un code devise mal formé', async () => {
    const { db, schema } = harness;

    await expect(
      db.insert(schema.apartments).values({
        organizationId,
        propertyId,
        number: 'MON05',
        referenceRentAmount: 1000,
        currency: 'gnf',
      }),
    ).rejects.toThrow();
  });

  // --- Utilisateurs ----------------------------------------------------------

  it('refuse un utilisateur sans téléphone ni email', async () => {
    const { db, schema } = harness;

    await expect(db.insert(schema.users).values({ fullName: 'Sans contact' })).rejects.toThrow();
  });

  it('refuse un nom réduit à des espaces', async () => {
    const { db, schema } = harness;

    await expect(
      db.insert(schema.users).values({ fullName: '   ', phone: '+224600000099' }),
    ).rejects.toThrow();
  });

  it('autorise plusieurs utilisateurs sans email', async () => {
    const { db, schema } = harness;

    // L'email est souvent absent sur le marché visé : l'unicité ne doit pas
    // empêcher deux comptes dépourvus d'adresse.
    await db.insert(schema.users).values([
      { fullName: 'Utilisateur Un', phone: '+224600000101' },
      { fullName: 'Utilisateur Deux', phone: '+224600000102' },
    ]);

    const rows = await db.select().from(schema.users);

    expect(rows.filter((row) => row.email === null).length).toBeGreaterThanOrEqual(2);
  });

  it('refuse deux utilisateurs avec le même téléphone', async () => {
    const { db, schema } = harness;

    await expect(
      db.insert(schema.users).values({ fullName: 'Doublon', phone: '+224600000101' }),
    ).rejects.toThrow();
  });

  // --- Préservation de l'historique (DEC-013) -------------------------------

  it('refuse de supprimer une organisation qui porte un immeuble', async () => {
    const { db, schema } = harness;

    // Les clés étrangères sont en RESTRICT : aucune cascade destructive ne peut
    // effacer un historique.
    await expect(
      db.delete(schema.organizations).where(eq(schema.organizations.id, organizationId)),
    ).rejects.toThrow();
  });

  it('refuse de supprimer un immeuble qui porte un appartement', async () => {
    const { db, schema } = harness;

    await expect(
      db.delete(schema.properties).where(eq(schema.properties.id, propertyId)),
    ).rejects.toThrow();
  });
});
