import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  loadAccessContext,
  membershipsIn,
  organizationsOf,
} from '../../src/lib/authorization/access-context';
import { can } from '../../src/lib/authorization/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';

/**
 * MVP-BACKLOG-011 et MVP-BACKLOG-014 : contexte d'organisation et périmètre.
 *
 * Contre une vraie base, avec la vraie migration. Ce qui se vérifie ici ne se
 * vérifie pas dans les tests du service pur : que la LECTURE exclut bien ce
 * qu'elle doit exclure. Un accès révoqué qui reviendrait du chargement rendrait
 * inutile toute la logique de décision qui suit.
 */
describe("Chargement du contexte d'accès", () => {
  let harness: TestDatabase;

  const orgA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  const orgB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';

  const propertyA1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa101';
  const propertyA2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa102';

  const ownerId = '11111111-1111-4111-8111-111111111101';
  const managerId = '11111111-1111-4111-8111-111111111102';
  const suspendedId = '11111111-1111-4111-8111-111111111103';
  const revokedId = '11111111-1111-4111-8111-111111111104';
  const timestampedId = '11111111-1111-4111-8111-111111111105';
  const multiOrgId = '11111111-1111-4111-8111-111111111106';
  const doubleRoleId = '11111111-1111-4111-8111-111111111107';

  const managerAccessId = '22222222-2222-4222-8222-222222222201';
  const doubleRoleManagerAccessId = '22222222-2222-4222-8222-222222222202';

  beforeAll(async () => {
    harness = await createTestDatabase();
    const { db, schema } = harness;

    await db.insert(schema.organizations).values([
      { id: orgA, name: 'Patrimoine A', type: 'COMPANY' },
      { id: orgB, name: 'Patrimoine B', type: 'INDIVIDUAL' },
    ]);

    await db.insert(schema.properties).values([
      { id: propertyA1, organizationId: orgA, name: 'Immeuble A1' },
      { id: propertyA2, organizationId: orgA, name: 'Immeuble A2' },
    ]);

    await db.insert(schema.users).values([
      { id: ownerId, fullName: 'Proprietaire', phone: '+224630000001', status: 'ACTIVE' },
      { id: managerId, fullName: 'Gestionnaire', phone: '+224630000002', status: 'ACTIVE' },
      { id: suspendedId, fullName: 'Suspendu', phone: '+224630000003', status: 'ACTIVE' },
      { id: revokedId, fullName: 'Revoque', phone: '+224630000004', status: 'ACTIVE' },
      { id: timestampedId, fullName: 'Date posee', phone: '+224630000005', status: 'ACTIVE' },
      { id: multiOrgId, fullName: 'Deux orgs', phone: '+224630000006', status: 'ACTIVE' },
      { id: doubleRoleId, fullName: 'Deux roles', phone: '+224630000007', status: 'ACTIVE' },
    ]);

    await db.insert(schema.userAccess).values([
      { userId: ownerId, organizationId: orgA, role: 'OWNER' },
      { id: managerAccessId, userId: managerId, organizationId: orgA, role: 'MANAGER' },
      { userId: suspendedId, organizationId: orgA, role: 'MANAGER', status: 'SUSPENDED' },
      { userId: revokedId, organizationId: orgA, role: 'MANAGER', status: 'REVOKED' },
      // Statut resté ACTIVE mais date de révocation posée : incohérence qui doit
      // tout de même fermer l'accès.
      {
        userId: timestampedId,
        organizationId: orgA,
        role: 'MANAGER',
        revokedAt: new Date('2026-09-01T00:00:00Z'),
      },
      { userId: multiOrgId, organizationId: orgA, role: 'OWNER' },
      { userId: multiOrgId, organizationId: orgB, role: 'MANAGER' },
      { userId: doubleRoleId, organizationId: orgA, role: 'OWNER' },
      {
        id: doubleRoleManagerAccessId,
        userId: doubleRoleId,
        organizationId: orgA,
        role: 'MANAGER',
      },
    ]);

    await db.insert(schema.managerPropertyAccess).values([
      { userAccessId: managerAccessId, propertyId: propertyA1 },
      // Périmètre révoqué : ne doit jamais remonter.
      {
        userAccessId: managerAccessId,
        propertyId: propertyA2,
        revokedAt: new Date('2026-09-01T00:00:00Z'),
      },
      { userAccessId: doubleRoleManagerAccessId, propertyId: propertyA1 },
    ]);
  }, 120_000);

  afterAll(async () => {
    await harness?.close();
  });

  it('charge un proprietaire, sans perimetre d immeubles', async () => {
    const context = await loadAccessContext(harness.db, ownerId);

    expect(context.userId).toBe(ownerId);
    expect(context.memberships).toHaveLength(1);
    expect(context.memberships[0]?.role).toBe('OWNER');
    expect(context.memberships[0]?.organizationId).toBe(orgA);
    expect(context.memberships[0]?.propertyIds).toEqual([]);
  });

  it('charge un gestionnaire avec son perimetre, revocations exclues', async () => {
    const context = await loadAccessContext(harness.db, managerId);

    expect(context.memberships).toHaveLength(1);
    expect(context.memberships[0]?.role).toBe('MANAGER');
    // A2 est revoque : seul A1 doit remonter.
    expect(context.memberships[0]?.propertyIds).toEqual([propertyA1]);
  });

  it('exclut un acces suspendu', async () => {
    expect((await loadAccessContext(harness.db, suspendedId)).memberships).toEqual([]);
  });

  it('exclut un acces revoque', async () => {
    expect((await loadAccessContext(harness.db, revokedId)).memberships).toEqual([]);
  });

  it('exclut un acces dont seule la date de revocation est posee', async () => {
    expect((await loadAccessContext(harness.db, timestampedId)).memberships).toEqual([]);
  });

  it('charge un utilisateur rattache a deux organisations', async () => {
    const context = await loadAccessContext(harness.db, multiOrgId);

    expect(context.memberships).toHaveLength(2);
    expect(organizationsOf(context).sort()).toEqual([orgA, orgB].sort());
    expect(membershipsIn(context, orgA)[0]?.role).toBe('OWNER');
    expect(membershipsIn(context, orgB)[0]?.role).toBe('MANAGER');
  });

  it('charge deux roles dans une meme organisation', async () => {
    const context = await loadAccessContext(harness.db, doubleRoleId);

    expect(membershipsIn(context, orgA)).toHaveLength(2);
    expect(
      membershipsIn(context, orgA)
        .map((membership) => membership.role)
        .sort(),
    ).toEqual(['MANAGER', 'OWNER']);
  });

  it('ne charge rien pour un utilisateur inconnu', async () => {
    const context = await loadAccessContext(harness.db, '99999999-9999-4999-8999-999999999999');

    expect(context.memberships).toEqual([]);
  });

  // --- Bout en bout ----------------------------------------------------------

  it('un gestionnaire charge depuis la base ne franchit pas son perimetre', async () => {
    const context = await loadAccessContext(harness.db, managerId);

    expect(can(context, 'apartment.update', { organizationId: orgA, propertyId: propertyA1 })).toBe(
      true,
    );
    expect(can(context, 'apartment.update', { organizationId: orgA, propertyId: propertyA2 })).toBe(
      false,
    );
    expect(can(context, 'property.read', { organizationId: orgB })).toBe(false);
  });

  it('une revocation en base ferme immediatement l acces', async () => {
    const { db, schema } = harness;

    await db
      .update(schema.userAccess)
      .set({ status: 'REVOKED', revokedAt: new Date() })
      .where(eq(schema.userAccess.id, managerAccessId));

    try {
      const context = await loadAccessContext(db, managerId);

      expect(context.memberships).toEqual([]);
      expect(can(context, 'apartment.read', { organizationId: orgA, propertyId: propertyA1 })).toBe(
        false,
      );
    } finally {
      await db
        .update(schema.userAccess)
        .set({ status: 'ACTIVE', revokedAt: null })
        .where(eq(schema.userAccess.id, managerAccessId));
    }
  });
});
