import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type {
  NewIncident,
  NewIncidentComment,
  NewIncidentStatusHistoryEntry,
} from '../../src/db/schema';
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
 * DEC-059 : ce que la BASE refuse, quoi qu'écrive un futur service.
 *
 * Même méthode que `tests/receipts/schema.test.ts` : écrire SANS passer par
 * un cas d'usage, pour prouver que les contraintes arrêtent une écriture
 * fautive même si le code applicatif se trompe.
 */
describe('Contraintes des tables d incidents (DEC-059)', () => {
  let harness: TestDatabase;
  let owner: Awaited<ReturnType<typeof contextOf>>;
  let property: string;
  let lease: { leaseId: string; tenantUserId: string; apartmentId: string };

  /** Incident valide, dont chaque test ne casse qu'UN champ. */
  const validIncident = (): NewIncident => ({
    organizationId: SEED_IDS.organizationA,
    propertyId: property,
    apartmentId: lease.apartmentId,
    createdByUserId: lease.tenantUserId,
    title: 'Fuite d eau sous l evier',
    description: 'De l eau s accumule sous l evier de la cuisine depuis hier.',
    priority: 'NORMAL',
    category: 'PLUMBING',
  });

  const insertIncident = (values: Partial<NewIncident> = {}) =>
    harness.db.insert(harness.schema.incidents).values({ ...validIncident(), ...values });

  const freshIncidentId = async () => {
    const [row] = await insertIncident({}).returning();
    if (!row) throw new Error('L incident de test n a pas ete cree.');
    return row.id;
  };

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    property = await addProperty(harness, 'Résidence Contraintes incidents');
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

  describe('L incident (incidents)', () => {
    it('accepte un incident valide', async () => {
      await expect(insertIncident()).resolves.toBeDefined();
    });

    it('refuse une catégorie invalide', async () => {
      await expect(insertIncident({ category: 'UNKNOWN_CATEGORY' })).rejects.toThrow();
    });

    it('refuse un statut ASSIGNED sans assignedToUserId', async () => {
      await expect(
        insertIncident({ status: 'ASSIGNED', assignedToUserId: null }),
      ).rejects.toThrow();
    });

    it('refuse un statut CLOSED sans closedAt', async () => {
      await expect(insertIncident({ status: 'CLOSED', closedAt: null })).rejects.toThrow();
    });

    it('refuse un statut RESOLVED sans resolvedAt', async () => {
      await expect(insertIncident({ status: 'RESOLVED', resolvedAt: null })).rejects.toThrow();
    });

    it('refuse un assignedToUserId renseigné sans assignedAt', async () => {
      await expect(
        insertIncident({
          status: 'ASSIGNED',
          assignedToUserId: SEED_IDS.managerA,
          assignedByUserId: SEED_IDS.ownerA,
          assignedAt: null,
        }),
      ).rejects.toThrow();
    });

    it('accepte un statut ASSIGNED avec affectation complète', async () => {
      await expect(
        insertIncident({
          status: 'ASSIGNED',
          assignedToUserId: SEED_IDS.managerA,
          assignedByUserId: SEED_IDS.ownerA,
          assignedAt: new Date(),
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('L historique (incident_status_history)', () => {
    const validHistory = (incidentId: string): NewIncidentStatusHistoryEntry => ({
      incidentId,
      fromStatus: null,
      toStatus: 'OPEN',
      byUserId: lease.tenantUserId,
    });

    it('accepte une ligne d historique valide', async () => {
      const incidentId = await freshIncidentId();

      await expect(
        harness.db.insert(harness.schema.incidentStatusHistory).values(validHistory(incidentId)),
      ).resolves.toBeDefined();
    });
  });

  describe('Le commentaire (incident_comments)', () => {
    const validComment = (incidentId: string): NewIncidentComment => ({
      incidentId,
      authorUserId: lease.tenantUserId,
      content: 'Le plombier est passé ce matin.',
    });

    it('accepte un commentaire valide', async () => {
      const incidentId = await freshIncidentId();

      await expect(
        harness.db.insert(harness.schema.incidentComments).values(validComment(incidentId)),
      ).resolves.toBeDefined();
    });

    it('refuse un commentaire vide', async () => {
      const incidentId = await freshIncidentId();

      await expect(
        harness.db
          .insert(harness.schema.incidentComments)
          .values({ ...validComment(incidentId), content: '' }),
      ).rejects.toThrow();
    });

    it('refuse un commentaire de plus de 2000 caractères', async () => {
      const incidentId = await freshIncidentId();

      await expect(
        harness.db
          .insert(harness.schema.incidentComments)
          .values({ ...validComment(incidentId), content: 'a'.repeat(2001) }),
      ).rejects.toThrow();
    });
  });
});
