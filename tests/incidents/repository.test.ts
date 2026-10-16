import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import {
  IncidentClosedError,
  InvalidTransitionError,
  MissingAssignmentError,
  MissingReasonError,
} from '../../src/modules/incidents/errors';
import {
  findIncidentById,
  insertIncidentCommentTx,
  insertIncidentTx,
  listIncidentComments,
  listIncidentsForContext,
  listIncidentStatusHistory,
  transitionIncidentStatusTx,
  updateIncidentAssignmentTx,
  updateIncidentFieldsTx,
  type InsertIncidentPayload,
} from '../../src/modules/incidents/repository';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  addApartment,
  addBillableLease,
  addProperty,
  contextOf,
  freshPhone,
  passwordHasher,
} from '../helpers/rents';

type LeaseInfo = { leaseId: string; tenantUserId: string; apartmentId: string };

/**
 * Repository des incidents (DEC-059).
 *
 * Même méthode que `tests/receipts/repository.test.ts` : un périmètre par
 * organisation ou par immeuble, des contextes réels issus de
 * `loadAccessContext`, jamais de raccourci qui contournerait la condition de
 * visibilité.
 */
describe('Repository des incidents (DEC-059)', () => {
  let harness: TestDatabase;
  let ownerContext: Awaited<ReturnType<typeof contextOf>>;
  let managerContext: Awaited<ReturnType<typeof contextOf>>;
  let otherOwnerContext: Awaited<ReturnType<typeof contextOf>>;

  let propertyInScope: string;
  let propertyOutOfScope: string;
  let lease: LeaseInfo;
  let otherLease: LeaseInfo;

  let apartmentCounter = 0;
  async function freshLease(propertyId: string): Promise<LeaseInfo> {
    apartmentCounter += 1;
    const apartmentId = await addApartment(harness, propertyId, `I${String(apartmentCounter)}`);
    return addBillableLease(harness, {
      apartmentId,
      tenantApartmentId: apartmentId,
      ownerContext,
      hashPassword: passwordHasher(harness),
      phone: freshPhone(),
      startDate: '2026-01-01',
    });
  }

  const payloadFor = (values: Partial<InsertIncidentPayload> = {}): InsertIncidentPayload => ({
    organizationId: SEED_IDS.organizationA,
    propertyId: propertyInScope,
    apartmentId: lease.apartmentId,
    createdByUserId: lease.tenantUserId,
    title: 'Fuite d eau',
    description: 'De l eau s accumule sous l evier.',
    priority: 'NORMAL',
    category: 'PLUMBING',
    ...values,
  });

  const insertIncident = (values: Partial<InsertIncidentPayload> = {}) =>
    insertIncidentTx(harness.db, payloadFor(values));

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    ownerContext = await contextOf(harness, SEED_IDS.ownerA);
    managerContext = await contextOf(harness, SEED_IDS.managerA);
    otherOwnerContext = await contextOf(harness, SEED_IDS.ownerB);

    propertyInScope = SEED_IDS.propertyA;
    propertyOutOfScope = await addProperty(harness, 'Résidence hors périmètre');

    lease = await freshLease(propertyInScope);
    otherLease = await freshLease(propertyOutOfScope);
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('insertIncidentTx', () => {
    it('crée l incident en OPEN et une ligne d historique de création', async () => {
      const incident = await insertIncident();

      expect(incident.status).toBe('OPEN');

      const history = await listIncidentStatusHistory(harness.db, incident.id, ownerContext);

      expect(history).toHaveLength(1);
      expect(history[0]?.fromStatus).toBeNull();
      expect(history[0]?.toStatus).toBe('OPEN');
      expect(history[0]?.byUserId).toBe(lease.tenantUserId);
    });
  });

  describe('Visibilité : findIncidentById', () => {
    it('le OWNER de l organisation trouve l incident', async () => {
      const incident = await insertIncident();

      const found = await findIncidentById(harness.db, incident.id, ownerContext);

      expect(found?.incident.id).toBe(incident.id);
      expect(found?.createdByName).toBeTruthy();
    });

    it('le MANAGER sur son périmètre trouve l incident', async () => {
      const incident = await insertIncident({ propertyId: propertyInScope });

      const found = await findIncidentById(harness.db, incident.id, managerContext);

      expect(found?.incident.id).toBe(incident.id);
    });

    it('le MANAGER hors périmètre reçoit null', async () => {
      const incident = await insertIncident({
        propertyId: propertyOutOfScope,
        apartmentId: otherLease.apartmentId,
        createdByUserId: otherLease.tenantUserId,
      });

      const found = await findIncidentById(harness.db, incident.id, managerContext);

      expect(found).toBeNull();
    });

    it('le TENANT créateur trouve l incident', async () => {
      const incident = await insertIncident();
      const tenantContext = await contextOf(harness, lease.tenantUserId);

      const found = await findIncidentById(harness.db, incident.id, tenantContext);

      expect(found?.incident.id).toBe(incident.id);
    });

    it('un TENANT non concerné reçoit null', async () => {
      const incident = await insertIncident();
      const otherTenantContext = await contextOf(harness, otherLease.tenantUserId);

      const found = await findIncidentById(harness.db, incident.id, otherTenantContext);

      expect(found).toBeNull();
    });

    it('une autre organisation reçoit null', async () => {
      const incident = await insertIncident();

      const found = await findIncidentById(harness.db, incident.id, otherOwnerContext);

      expect(found).toBeNull();
    });
  });

  describe('Liste : listIncidentsForContext', () => {
    it('filtre par statut', async () => {
      const incident = await insertIncident();
      await transitionIncidentStatusTx(
        harness.db,
        incident.id,
        'IN_PROGRESS',
        SEED_IDS.ownerA,
        null,
        ownerContext,
      );

      const result = await listIncidentsForContext(harness.db, ownerContext, {
        status: ['IN_PROGRESS'],
      });

      expect(result.incidents.some((row) => row.incident.id === incident.id)).toBe(true);
      expect(result.incidents.every((row) => row.incident.status === 'IN_PROGRESS')).toBe(true);
    });

    it('filtre par priorité', async () => {
      const incident = await insertIncident({ priority: 'URGENT' });

      const result = await listIncidentsForContext(harness.db, ownerContext, {
        priority: 'URGENT',
      });

      expect(result.incidents.some((row) => row.incident.id === incident.id)).toBe(true);
      expect(result.incidents.every((row) => row.incident.priority === 'URGENT')).toBe(true);
    });

    it('filtre par catégorie', async () => {
      const incident = await insertIncident({ category: 'ELECTRICITY' });

      const result = await listIncidentsForContext(harness.db, ownerContext, {
        category: 'ELECTRICITY',
      });

      expect(result.incidents.some((row) => row.incident.id === incident.id)).toBe(true);
      expect(result.incidents.every((row) => row.incident.category === 'ELECTRICITY')).toBe(true);
    });

    it('filtre par immeuble', async () => {
      const incident = await insertIncident({ propertyId: propertyInScope });

      const result = await listIncidentsForContext(harness.db, ownerContext, {
        propertyId: propertyInScope,
      });

      expect(result.incidents.every((row) => row.incident.propertyId === propertyInScope)).toBe(
        true,
      );
      expect(result.incidents.some((row) => row.incident.id === incident.id)).toBe(true);
    });

    it('filtre par assignedToUserId', async () => {
      const incident = await insertIncident();
      await updateIncidentAssignmentTx(
        harness.db,
        incident.id,
        SEED_IDS.managerA,
        SEED_IDS.ownerA,
        ownerContext,
      );

      const result = await listIncidentsForContext(harness.db, ownerContext, {
        assignedToUserId: SEED_IDS.managerA,
      });

      expect(result.incidents.some((row) => row.incident.id === incident.id)).toBe(true);
      expect(
        result.incidents.every((row) => row.incident.assignedToUserId === SEED_IDS.managerA),
      ).toBe(true);
    });

    it('filtre toProcess sur OPEN et ASSIGNED', async () => {
      const openIncident = await insertIncident();
      const closedIncident = await insertIncident();
      await transitionIncidentStatusTx(
        harness.db,
        closedIncident.id,
        'CLOSED',
        SEED_IDS.ownerA,
        null,
        ownerContext,
      );

      const result = await listIncidentsForContext(harness.db, ownerContext, { toProcess: true });

      expect(result.incidents.some((row) => row.incident.id === openIncident.id)).toBe(true);
      expect(result.incidents.some((row) => row.incident.id === closedIncident.id)).toBe(false);
    });

    it('pagine (page, pageSize)', async () => {
      for (let i = 0; i < 3; i += 1) await insertIncident();

      const result = await listIncidentsForContext(harness.db, ownerContext, {
        page: 1,
        pageSize: 2,
      });

      expect(result.incidents).toHaveLength(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.pageSize).toBe(2);
      expect(result.meta.total).toBeGreaterThanOrEqual(3);
    });

    it('respecte le périmètre : un TENANT ne voit que ses incidents', async () => {
      await insertIncident();
      const tenantContext = await contextOf(harness, lease.tenantUserId);

      const result = await listIncidentsForContext(harness.db, tenantContext);

      expect(
        result.incidents.every(
          (row) =>
            row.incident.createdByUserId === lease.tenantUserId ||
            row.incident.apartmentId === lease.apartmentId,
        ),
      ).toBe(true);
    });
  });

  describe('updateIncidentFieldsTx', () => {
    it('met à jour les champs descriptifs', async () => {
      const incident = await insertIncident();

      const updated = await updateIncidentFieldsTx(
        harness.db,
        incident.id,
        { title: 'Fuite réparée partiellement', priority: 'URGENT' },
        ownerContext,
      );

      expect(updated.title).toBe('Fuite réparée partiellement');
      expect(updated.priority).toBe('URGENT');
    });

    it('refuse la modification d un incident CLOSED', async () => {
      const incident = await insertIncident();
      await transitionIncidentStatusTx(
        harness.db,
        incident.id,
        'CLOSED',
        SEED_IDS.ownerA,
        null,
        ownerContext,
      );

      await expect(
        updateIncidentFieldsTx(harness.db, incident.id, { title: 'Nouveau titre' }, ownerContext),
      ).rejects.toThrow(IncidentClosedError);
    });
  });

  describe('updateIncidentAssignmentTx', () => {
    it('renseigne assignedToUserId, assignedAt et assignedByUserId', async () => {
      const incident = await insertIncident();

      const updated = await updateIncidentAssignmentTx(
        harness.db,
        incident.id,
        SEED_IDS.managerA,
        SEED_IDS.ownerA,
        ownerContext,
      );

      expect(updated.assignedToUserId).toBe(SEED_IDS.managerA);
      expect(updated.assignedByUserId).toBe(SEED_IDS.ownerA);
      expect(updated.assignedAt).not.toBeNull();
    });
  });

  describe('transitionIncidentStatusTx', () => {
    it('OPEN -> ASSIGNED passe avec une affectation préalable', async () => {
      const incident = await insertIncident();
      await updateIncidentAssignmentTx(
        harness.db,
        incident.id,
        SEED_IDS.managerA,
        SEED_IDS.ownerA,
        ownerContext,
      );

      const updated = await transitionIncidentStatusTx(
        harness.db,
        incident.id,
        'ASSIGNED',
        SEED_IDS.ownerA,
        null,
        ownerContext,
      );

      expect(updated.status).toBe('ASSIGNED');
    });

    it('OPEN -> ASSIGNED sans affectation préalable échoue', async () => {
      const incident = await insertIncident();

      await expect(
        transitionIncidentStatusTx(
          harness.db,
          incident.id,
          'ASSIGNED',
          SEED_IDS.ownerA,
          null,
          ownerContext,
        ),
      ).rejects.toThrow(MissingAssignmentError);
    });

    it('OPEN -> RESOLVED échoue, transition non autorisée', async () => {
      const incident = await insertIncident();

      await expect(
        transitionIncidentStatusTx(
          harness.db,
          incident.id,
          'RESOLVED',
          SEED_IDS.ownerA,
          null,
          ownerContext,
        ),
      ).rejects.toThrow(InvalidTransitionError);
    });

    it('IN_PROGRESS -> RESOLVED renseigne resolvedAt', async () => {
      const incident = await insertIncident();
      await transitionIncidentStatusTx(
        harness.db,
        incident.id,
        'IN_PROGRESS',
        SEED_IDS.ownerA,
        null,
        ownerContext,
      );

      const updated = await transitionIncidentStatusTx(
        harness.db,
        incident.id,
        'RESOLVED',
        SEED_IDS.ownerA,
        null,
        ownerContext,
      );

      expect(updated.status).toBe('RESOLVED');
      expect(updated.resolvedAt).not.toBeNull();
    });

    it('RESOLVED -> IN_PROGRESS sans motif échoue', async () => {
      const incident = await insertIncident();
      await transitionIncidentStatusTx(
        harness.db,
        incident.id,
        'IN_PROGRESS',
        SEED_IDS.ownerA,
        null,
        ownerContext,
      );
      await transitionIncidentStatusTx(
        harness.db,
        incident.id,
        'RESOLVED',
        SEED_IDS.ownerA,
        null,
        ownerContext,
      );

      await expect(
        transitionIncidentStatusTx(
          harness.db,
          incident.id,
          'IN_PROGRESS',
          SEED_IDS.ownerA,
          null,
          ownerContext,
        ),
      ).rejects.toThrow(MissingReasonError);
    });

    it('lève InvalidTransitionError sur une transition interdite depuis CLOSED', async () => {
      const incident = await insertIncident();
      await transitionIncidentStatusTx(
        harness.db,
        incident.id,
        'CLOSED',
        SEED_IDS.ownerA,
        null,
        ownerContext,
      );

      await expect(
        transitionIncidentStatusTx(
          harness.db,
          incident.id,
          'OPEN',
          SEED_IDS.ownerA,
          null,
          ownerContext,
        ),
      ).rejects.toThrow(InvalidTransitionError);
    });
  });

  describe('insertIncidentCommentTx', () => {
    it('crée le commentaire', async () => {
      const incident = await insertIncident();

      const comment = await insertIncidentCommentTx(
        harness.db,
        incident.id,
        lease.tenantUserId,
        'Le plombier est passé.',
        ownerContext,
      );

      expect(comment.content).toBe('Le plombier est passé.');
      expect(comment.incidentId).toBe(incident.id);
    });
  });

  describe('Historique et commentaires', () => {
    it('listIncidentStatusHistory retourne les entrées dans l ordre', async () => {
      const incident = await insertIncident();
      await transitionIncidentStatusTx(
        harness.db,
        incident.id,
        'IN_PROGRESS',
        SEED_IDS.ownerA,
        null,
        ownerContext,
      );
      await transitionIncidentStatusTx(
        harness.db,
        incident.id,
        'ON_HOLD',
        SEED_IDS.ownerA,
        null,
        ownerContext,
      );

      const history = await listIncidentStatusHistory(harness.db, incident.id, ownerContext);

      expect(history.map((entry) => entry.toStatus)).toEqual(['OPEN', 'IN_PROGRESS', 'ON_HOLD']);
    });

    it('listIncidentComments retourne les commentaires avec le nom d auteur', async () => {
      const incident = await insertIncident();
      await insertIncidentCommentTx(
        harness.db,
        incident.id,
        lease.tenantUserId,
        'Premier commentaire.',
        ownerContext,
      );

      const comments = await listIncidentComments(harness.db, incident.id, ownerContext);

      expect(comments).toHaveLength(1);
      expect(comments[0]?.authorName).toBeTruthy();
      expect(comments[0]?.comment.content).toBe('Premier commentaire.');
    });

    it('un TENANT hors périmètre reçoit un tableau vide, pas d erreur', async () => {
      const incident = await insertIncident();
      const otherTenantContext = await contextOf(harness, otherLease.tenantUserId);

      const history = await listIncidentStatusHistory(harness.db, incident.id, otherTenantContext);
      const comments = await listIncidentComments(harness.db, incident.id, otherTenantContext);

      expect(history).toEqual([]);
      expect(comments).toEqual([]);
    });
  });
});
