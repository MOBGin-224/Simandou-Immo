import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { createTestDatabase, type TestDatabase } from '../helpers/database';

/**
 * MVP-BACKLOG-006 : le seed de développement.
 *
 * Ces tests visent la fonction `seed` réellement utilisée par `npm run db:seed`,
 * pas une reproduction : un seed testé par une copie ne prouve rien.
 *
 * Enjeu central : la seconde organisation. Sans deux organisations peuplées, les
 * tests d'isolation multi-tenant des lots suivants ne peuvent pas exister, et
 * l'isolation est la barrière unique du produit, faute de RLS (ADR-005, ADR-007).
 */
describe('Seed de développement', () => {
  let harness: TestDatabase;

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);
  }, 60_000);

  afterAll(async () => {
    await harness?.close();
  });

  it('crée deux organisations distinctes', async () => {
    const { db, schema } = harness;

    const rows = await db.select().from(schema.organizations);

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id).sort()).toEqual(
      [SEED_IDS.organizationA, SEED_IDS.organizationB].sort(),
    );
  });

  it('donne un propriétaire à chacune des deux organisations', async () => {
    const { db, schema } = harness;

    const rows = await db
      .select({ organizationId: schema.userAccess.organizationId })
      .from(schema.userAccess)
      .where(eq(schema.userAccess.role, 'OWNER'));

    const organizations = rows.map((row) => row.organizationId);

    expect(organizations).toContain(SEED_IDS.organizationA);
    expect(organizations).toContain(SEED_IDS.organizationB);
  });

  it('crée les trois appartements de l immeuble A', async () => {
    const { db, schema } = harness;

    const rows = await db
      .select()
      .from(schema.apartments)
      .where(eq(schema.apartments.propertyId, SEED_IDS.propertyA));

    expect(rows.map((row) => row.number).sort()).toEqual(['A01', 'A02', 'A03']);
  });

  it('exprime les loyers de référence en entiers avec leur devise', async () => {
    const { db, schema } = harness;

    const rows = await db
      .select()
      .from(schema.apartments)
      .where(eq(schema.apartments.id, SEED_IDS.apartmentA01));

    // 2 500 000 GNF, entier, devise explicite (DEC-014).
    expect(rows[0]?.referenceRentAmount).toBe(2500000);
    expect(rows[0]?.currency).toBe('GNF');
  });

  it('affecte au gestionnaire un périmètre limité à un seul immeuble', async () => {
    const { db, schema } = harness;

    const rows = await db
      .select({ propertyId: schema.managerPropertyAccess.propertyId })
      .from(schema.managerPropertyAccess)
      .where(eq(schema.managerPropertyAccess.userAccessId, SEED_IDS.accessManagerA));

    // Un périmètre restreint est ce qui rendra testable le refus hors périmètre.
    expect(rows).toHaveLength(1);
    expect(rows[0]?.propertyId).toBe(SEED_IDS.propertyA);
  });

  it('laisse un propriétaire agir aussi comme gestionnaire sans second compte', async () => {
    const { db, schema } = harness;

    // DEC-003 : l'unicité porte sur le triplet utilisateur, organisation, rôle.
    // Ajouter le rôle MANAGER au propriétaire A doit donc être accepté.
    await db.insert(schema.userAccess).values({
      userId: SEED_IDS.ownerA,
      organizationId: SEED_IDS.organizationA,
      role: 'MANAGER',
    });

    const rows = await db
      .select()
      .from(schema.userAccess)
      .where(eq(schema.userAccess.userId, SEED_IDS.ownerA));

    expect(rows.map((row) => row.role).sort()).toEqual(['MANAGER', 'OWNER']);
  });

  it('est idempotent : rejouer le seed ne duplique rien', async () => {
    const { db, schema } = harness;

    const before = await db.select().from(schema.apartments);

    await seed(db);
    await seed(db);

    const after = await db.select().from(schema.apartments);

    // Le seed doit pouvoir être relancé sans nettoyer la base au préalable.
    expect(after).toHaveLength(before.length);
  });
});

/**
 * Isolation multi-tenant.
 *
 * Le produit n'utilise pas de politiques RLS (ADR-005). La base ne constitue donc
 * PAS une seconde barrière : l'isolation reposera entièrement sur le service
 * d'autorisation du lot Autorisation.
 *
 * Ce que ces tests établissent dès maintenant, c'est que les données nécessaires
 * pour l'éprouver existent, et qu'un filtre par organisation sépare réellement
 * les deux jeux de données.
 */
describe('Isolation multi-tenant', () => {
  let harness: TestDatabase;

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);
  }, 60_000);

  afterAll(async () => {
    await harness?.close();
  });

  it('ne renvoie aucun immeuble de B lorsque le filtre porte sur A', async () => {
    const { db, schema } = harness;

    const rows = await db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.organizationId, SEED_IDS.organizationA));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(SEED_IDS.propertyA);
    expect(rows.map((row) => row.id)).not.toContain(SEED_IDS.propertyB);
  });

  it('ne renvoie aucun appartement lorsque le filtre porte sur B', async () => {
    const { db, schema } = harness;

    const rows = await db
      .select()
      .from(schema.apartments)
      .where(eq(schema.apartments.organizationId, SEED_IDS.organizationB));

    // L'organisation B n'a pas encore d'appartement : le résultat doit être vide,
    // et surtout ne pas laisser fuiter ceux de A.
    expect(rows).toHaveLength(0);
  });

  it('permet de vérifier le périmètre sans jointure', async () => {
    const { db } = harness;

    // organization_id est dénormalisé sur les appartements précisément pour que
    // la vérification d'accès ne nécessite aucune jointure (ADR-007).
    const rows = await db.execute<{ count: string }>(sql`
      select count(*)::text as count
      from apartments
      where organization_id = ${SEED_IDS.organizationA}
    `);

    expect(Number(rows.rows[0]?.count)).toBe(3);
  });

  it('garde chaque appartement cohérent avec l organisation de son immeuble', async () => {
    const { db } = harness;

    // Invariant du modèle : la colonne dénormalisée ne doit jamais diverger de la
    // source. Une divergence rendrait la vérification de périmètre fausse tout en
    // paraissant correcte.
    const rows = await db.execute<{ count: string }>(sql`
      select count(*)::text as count
      from apartments a
      join properties p on p.id = a.property_id
      where a.organization_id <> p.organization_id
    `);

    expect(Number(rows.rows[0]?.count)).toBe(0);
  });
});
