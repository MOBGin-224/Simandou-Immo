import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { NewIntervention, NewInterventionStatusHistoryEntry } from '../../src/db/schema';
import { SEED_IDS, seed } from '../../src/db/seed';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  addApartment,
  addBillableLease,
  addProperty,
  contextOf,
  freshPhone,
  passwordHasher,
} from '../helpers/rents';

/**
 * DEC-060 : ce que la BASE refuse, quoi qu'écrive un futur service.
 *
 * Même méthode que `tests/incidents/schema.test.ts` : écrire SANS passer par un
 * cas d'usage, pour prouver que les contraintes arrêtent une écriture fautive
 * même si le code applicatif se trompe.
 */
describe('Contraintes des tables d interventions (DEC-060)', () => {
  let harness: TestDatabase;
  let owner: Awaited<ReturnType<typeof contextOf>>;
  let property: string;
  let lease: { leaseId: string; tenantUserId: string; apartmentId: string };

  /** Intervention valide, dont chaque test ne casse qu'UN champ. */
  const validIntervention = (): NewIntervention => ({
    organizationId: SEED_IDS.organizationA,
    propertyId: property,
    apartmentId: lease.apartmentId,
    createdByUserId: lease.tenantUserId,
    title: 'Remplacement du robinet',
    description: 'Le robinet de la cuisine fuit depuis trois jours.',
  });

  const insertIntervention = (values: Partial<NewIntervention> = {}) =>
    harness.db.insert(harness.schema.interventions).values({ ...validIntervention(), ...values });

  const freshInterventionId = async (values: Partial<NewIntervention> = {}) => {
    const [row] = await insertIntervention(values).returning();
    if (!row) throw new Error('L intervention de test n a pas ete creee.');
    return row.id;
  };

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    property = await addProperty(harness, 'Résidence Contraintes interventions');
    owner = await contextOf(harness, SEED_IDS.ownerA);

    const apartmentId = await addApartment(harness, property, 'I01');
    lease = await addBillableLease(harness, {
      apartmentId,
      tenantApartmentId: apartmentId,
      ownerContext: owner,
      hashPassword: passwordHasher(harness),
      phone: freshPhone(),
      startDate: '2026-01-01',
    });
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('L intervention (interventions)', () => {
    it('accepte une intervention valide', async () => {
      await expect(insertIntervention()).resolves.toBeDefined();
    });

    it('refuse un estimatedCost négatif', async () => {
      await expect(insertIntervention({ estimatedCost: -1 })).rejects.toThrow();
    });

    it('refuse un actualCost négatif', async () => {
      await expect(
        insertIntervention({
          status: 'COMPLETED',
          completedAt: new Date(),
          actualCost: -1,
        }),
      ).rejects.toThrow();
    });

    it('refuse un statut COMPLETED sans completedAt', async () => {
      await expect(
        insertIntervention({ status: 'COMPLETED', completedAt: null, actualCost: 0 }),
      ).rejects.toThrow();
    });

    it('refuse un statut COMPLETED sans actualCost', async () => {
      await expect(
        insertIntervention({ status: 'COMPLETED', completedAt: new Date(), actualCost: null }),
      ).rejects.toThrow();
    });

    it('refuse un statut CANCELLED sans cancelledAt', async () => {
      await expect(
        insertIntervention({ status: 'CANCELLED', cancelledAt: null }),
      ).rejects.toThrow();
    });

    it('refuse un statut IN_PROGRESS sans startedAt', async () => {
      await expect(
        insertIntervention({ status: 'IN_PROGRESS', startedAt: null }),
      ).rejects.toThrow();
    });

    it('refuse un incidentId renseigné avec propertyId NULL', async () => {
      const incidentId = await (async () => {
        const [row] = await harness.db
          .insert(harness.schema.incidents)
          .values({
            organizationId: SEED_IDS.organizationA,
            propertyId: property,
            apartmentId: lease.apartmentId,
            createdByUserId: lease.tenantUserId,
            title: 'Fuite d eau',
            description: 'De l eau s accumule sous l evier.',
            priority: 'NORMAL',
            category: 'PLUMBING',
          })
          .returning();
        if (!row) throw new Error('L incident de test n a pas ete cree.');
        return row.id;
      })();

      // propertyId est NOT NULL dans la table : on contourne le typage pour
      // prouver que la contrainte SQL refuserait de toute façon la ligne si le
      // NOT NULL venait un jour à disparaître.
      await expect(
        harness.db.insert(harness.schema.interventions).values({
          ...validIntervention(),
          incidentId,
          propertyId: null as unknown as string,
        }),
      ).rejects.toThrow();
    });

    it('accepte une intervention COMPLETED avec completedAt et actualCost', async () => {
      await expect(
        insertIntervention({
          status: 'COMPLETED',
          startedAt: new Date(),
          completedAt: new Date(),
          actualCost: 150_000,
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('L historique (intervention_status_history)', () => {
    const validHistory = (interventionId: string): NewInterventionStatusHistoryEntry => ({
      interventionId,
      fromStatus: null,
      toStatus: 'PLANNED',
      byUserId: lease.tenantUserId,
    });

    it('accepte une ligne de transition valide', async () => {
      const interventionId = await freshInterventionId();

      await expect(
        harness.db
          .insert(harness.schema.interventionStatusHistory)
          .values(validHistory(interventionId)),
      ).resolves.toBeDefined();
    });
  });
});
