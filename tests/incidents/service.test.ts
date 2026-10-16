import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { PermissionDeniedError, ResourceOutOfScopeError } from '../../src/lib/authorization';
import {
  IncidentClosedError,
  IncidentNotFoundError,
  IncidentValidationError,
  InvalidTransitionError,
  MissingAssignmentError,
  MissingReasonError,
} from '../../src/modules/incidents/errors';
import {
  addComment,
  assignIncident,
  createIncident,
  transitionStatus,
  updateIncident,
} from '../../src/modules/incidents/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  addAccess,
  addApartment,
  addBillableLease,
  addProperty,
  addUser,
  contextOf,
  freshPhone,
  passwordHasher,
} from '../helpers/rents';

type LeaseInfo = { leaseId: string; tenantUserId: string; apartmentId: string };

/**
 * Service des incidents (DEC-059, section 4).
 *
 * Même méthode que `tests/receipts/service.test.ts` : des contextes réels
 * issus de `loadAccessContext`, et des situations construites par le vrai
 * chemin (bail, accès) plutôt que des lignes insérées à la main.
 */
describe('Service des incidents (DEC-059)', () => {
  let harness: TestDatabase;
  let ownerContext: Awaited<ReturnType<typeof contextOf>>;
  let managerContext: Awaited<ReturnType<typeof contextOf>>;
  let otherOwnerContext: Awaited<ReturnType<typeof contextOf>>;

  let propertyInScope: string;
  let propertyOutOfScope: string;
  let propertyOtherOrg: string;
  let lease: LeaseInfo;
  let secondManagerUserId: string;

  let apartmentCounter = 0;
  async function freshLease(propertyId: string): Promise<LeaseInfo> {
    apartmentCounter += 1;
    const apartmentId = await addApartment(harness, propertyId, `S${String(apartmentCounter)}`);
    return addBillableLease(harness, {
      apartmentId,
      tenantApartmentId: apartmentId,
      ownerContext,
      hashPassword: passwordHasher(harness),
      phone: freshPhone(),
      startDate: '2026-01-01',
    });
  }

  const createValidIncident = (overrides: Partial<Record<string, unknown>> = {}) => ({
    title: 'Fuite d eau',
    description: 'De l eau s accumule sous l evier.',
    priority: 'NORMAL',
    category: 'PLUMBING',
    apartmentId: lease.apartmentId,
    ...overrides,
  });

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    ownerContext = await contextOf(harness, SEED_IDS.ownerA);
    managerContext = await contextOf(harness, SEED_IDS.managerA);
    otherOwnerContext = await contextOf(harness, SEED_IDS.ownerB);

    propertyInScope = SEED_IDS.propertyA;
    propertyOutOfScope = await addProperty(harness, 'Résidence hors périmètre gestionnaire');
    propertyOtherOrg = await addProperty(harness, 'Résidence autre organisation', {
      organizationId: SEED_IDS.organizationB,
    });

    lease = await freshLease(propertyInScope);

    const secondManager = await addUser(harness, { fullName: 'Second Gestionnaire' });
    secondManagerUserId = secondManager.id;
    await addAccess(harness, { userId: secondManagerUserId, role: 'MANAGER' });
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('createIncident', () => {
    it('un TENANT avec bail actif crée un incident', async () => {
      const tenantContext = await contextOf(harness, lease.tenantUserId);

      const incident = await createIncident(harness.db, createValidIncident(), tenantContext);

      expect(incident.incident.createdByUserId).toBe(lease.tenantUserId);
      expect(incident.incident.status).toBe('OPEN');
    });

    it('un TENANT sans bail actif est refusé', async () => {
      const tenantContext = await contextOf(harness, lease.tenantUserId);
      const otherApartmentId = await addApartment(harness, propertyOutOfScope, 'OOS1');

      await expect(
        createIncident(
          harness.db,
          createValidIncident({ apartmentId: otherApartmentId }),
          tenantContext,
        ),
      ).rejects.toThrow(ResourceOutOfScopeError);
    });

    it('le MANAGER sur son périmètre crée un incident', async () => {
      const incident = await createIncident(harness.db, createValidIncident(), managerContext);

      expect(incident.incident.id).toBeTruthy();
    });

    it('le MANAGER hors périmètre est refusé', async () => {
      const apartmentId = await addApartment(harness, propertyOutOfScope, 'OOS2');

      await expect(
        createIncident(harness.db, createValidIncident({ apartmentId }), managerContext),
      ).rejects.toThrow(ResourceOutOfScopeError);
    });

    it('le OWNER sur son organisation crée un incident', async () => {
      const incident = await createIncident(harness.db, createValidIncident(), ownerContext);

      expect(incident.incident.id).toBeTruthy();
    });

    it('le OWNER sur une autre organisation est refusé', async () => {
      const apartmentId = await addApartment(harness, propertyOtherOrg, 'B1', {
        organizationId: SEED_IDS.organizationB,
      });

      await expect(
        createIncident(harness.db, createValidIncident({ apartmentId }), ownerContext),
      ).rejects.toThrow(ResourceOutOfScopeError);
    });

    it('un titre vide lève IncidentValidationError', async () => {
      await expect(
        createIncident(harness.db, createValidIncident({ title: '' }), ownerContext),
      ).rejects.toThrow(IncidentValidationError);
    });

    it('une catégorie invalide lève IncidentValidationError', async () => {
      await expect(
        createIncident(harness.db, createValidIncident({ category: 'UNKNOWN' }), ownerContext),
      ).rejects.toThrow(IncidentValidationError);
    });
  });

  describe('updateIncident', () => {
    it('le TENANT créateur modifie son incident tant qu il est OPEN', async () => {
      const tenantContext = await contextOf(harness, lease.tenantUserId);
      const incident = await createIncident(harness.db, createValidIncident(), tenantContext);

      const updated = await updateIncident(
        harness.db,
        incident.incident.id,
        { title: 'Fuite réparée partiellement' },
        tenantContext,
      );

      expect(updated.incident.title).toBe('Fuite réparée partiellement');
    });

    it('le TENANT créateur est refusé une fois l incident ASSIGNED', async () => {
      const tenantContext = await contextOf(harness, lease.tenantUserId);
      const incident = await createIncident(harness.db, createValidIncident(), tenantContext);

      await assignIncident(harness.db, incident.incident.id, secondManagerUserId, ownerContext);
      await transitionStatus(harness.db, incident.incident.id, 'ASSIGNED', null, ownerContext);

      await expect(
        updateIncident(harness.db, incident.incident.id, { title: 'Nouveau titre' }, tenantContext),
      ).rejects.toThrow();
    });

    it('le MANAGER sur son périmètre modifie l incident', async () => {
      const incident = await createIncident(harness.db, createValidIncident(), ownerContext);

      const updated = await updateIncident(
        harness.db,
        incident.incident.id,
        { priority: 'URGENT' },
        managerContext,
      );

      expect(updated.incident.priority).toBe('URGENT');
    });

    it('le MANAGER hors périmètre est refusé', async () => {
      const apartmentId = await addApartment(harness, propertyOutOfScope, 'OOS3');
      const incident = await createIncident(
        harness.db,
        createValidIncident({ apartmentId }),
        ownerContext,
      );

      await expect(
        updateIncident(
          harness.db,
          incident.incident.id,
          { title: 'Nouveau titre' },
          managerContext,
        ),
      ).rejects.toThrow(IncidentNotFoundError);
    });

    it('un incident CLOSED lève IncidentClosedError', async () => {
      const incident = await createIncident(harness.db, createValidIncident(), ownerContext);
      await transitionStatus(harness.db, incident.incident.id, 'CLOSED', null, ownerContext);

      await expect(
        updateIncident(harness.db, incident.incident.id, { title: 'Nouveau titre' }, ownerContext),
      ).rejects.toThrow(IncidentClosedError);
    });
  });

  describe('assignIncident', () => {
    it('le MANAGER affecte un incident de son périmètre à un gestionnaire de l organisation', async () => {
      const incident = await createIncident(harness.db, createValidIncident(), managerContext);

      const updated = await assignIncident(
        harness.db,
        incident.incident.id,
        secondManagerUserId,
        managerContext,
      );

      expect(updated.incident.assignedToUserId).toBe(secondManagerUserId);
      expect(updated.incident.assignedByUserId).toBe(SEED_IDS.managerA);
    });

    it('le MANAGER est refusé s il affecte à un utilisateur d une autre organisation', async () => {
      const incident = await createIncident(harness.db, createValidIncident(), managerContext);

      await expect(
        assignIncident(harness.db, incident.incident.id, SEED_IDS.ownerB, managerContext),
      ).rejects.toThrow(ResourceOutOfScopeError);
    });

    it('un TENANT qui tente d affecter lève PermissionDeniedError', async () => {
      const tenantContext = await contextOf(harness, lease.tenantUserId);
      const incident = await createIncident(harness.db, createValidIncident(), tenantContext);

      await expect(
        assignIncident(harness.db, incident.incident.id, secondManagerUserId, tenantContext),
      ).rejects.toThrow(PermissionDeniedError);
    });
  });

  describe('transitionStatus', () => {
    it('OPEN -> ASSIGNED sans affectation lève MissingAssignmentError', async () => {
      const incident = await createIncident(harness.db, createValidIncident(), ownerContext);

      await expect(
        transitionStatus(harness.db, incident.incident.id, 'ASSIGNED', null, ownerContext),
      ).rejects.toThrow(MissingAssignmentError);
    });

    it('OPEN -> ASSIGNED avec affectation passe', async () => {
      const incident = await createIncident(harness.db, createValidIncident(), ownerContext);
      await assignIncident(harness.db, incident.incident.id, secondManagerUserId, ownerContext);

      const updated = await transitionStatus(
        harness.db,
        incident.incident.id,
        'ASSIGNED',
        null,
        ownerContext,
      );

      expect(updated.incident.status).toBe('ASSIGNED');
    });

    it('IN_PROGRESS -> RESOLVED renseigne resolvedAt', async () => {
      const incident = await createIncident(harness.db, createValidIncident(), ownerContext);
      await transitionStatus(harness.db, incident.incident.id, 'IN_PROGRESS', null, ownerContext);

      const updated = await transitionStatus(
        harness.db,
        incident.incident.id,
        'RESOLVED',
        null,
        ownerContext,
      );

      expect(updated.incident.status).toBe('RESOLVED');
      expect(updated.incident.resolvedAt).not.toBeNull();
    });

    it('RESOLVED -> IN_PROGRESS sans motif lève MissingReasonError', async () => {
      const incident = await createIncident(harness.db, createValidIncident(), ownerContext);
      await transitionStatus(harness.db, incident.incident.id, 'IN_PROGRESS', null, ownerContext);
      await transitionStatus(harness.db, incident.incident.id, 'RESOLVED', null, ownerContext);

      await expect(
        transitionStatus(harness.db, incident.incident.id, 'IN_PROGRESS', null, ownerContext),
      ).rejects.toThrow(MissingReasonError);
    });

    it('RESOLVED -> IN_PROGRESS avec motif passe', async () => {
      const incident = await createIncident(harness.db, createValidIncident(), ownerContext);
      await transitionStatus(harness.db, incident.incident.id, 'IN_PROGRESS', null, ownerContext);
      await transitionStatus(harness.db, incident.incident.id, 'RESOLVED', null, ownerContext);

      const updated = await transitionStatus(
        harness.db,
        incident.incident.id,
        'IN_PROGRESS',
        'Le problème persiste.',
        ownerContext,
      );

      expect(updated.incident.status).toBe('IN_PROGRESS');
    });

    it('CLOSED -> OPEN lève InvalidTransitionError', async () => {
      const incident = await createIncident(harness.db, createValidIncident(), ownerContext);
      await transitionStatus(harness.db, incident.incident.id, 'CLOSED', null, ownerContext);

      await expect(
        transitionStatus(harness.db, incident.incident.id, 'OPEN', null, ownerContext),
      ).rejects.toThrow(InvalidTransitionError);
    });

    it('un TENANT qui tente une transition lève PermissionDeniedError', async () => {
      const tenantContext = await contextOf(harness, lease.tenantUserId);
      const incident = await createIncident(harness.db, createValidIncident(), tenantContext);

      await expect(
        transitionStatus(harness.db, incident.incident.id, 'IN_PROGRESS', null, tenantContext),
      ).rejects.toThrow(PermissionDeniedError);
    });

    it('le MANAGER hors périmètre est refusé', async () => {
      const apartmentId = await addApartment(harness, propertyOutOfScope, 'OOS4');
      const incident = await createIncident(
        harness.db,
        createValidIncident({ apartmentId }),
        ownerContext,
      );

      await expect(
        transitionStatus(harness.db, incident.incident.id, 'IN_PROGRESS', null, managerContext),
      ).rejects.toThrow(IncidentNotFoundError);
    });
  });

  describe('addComment', () => {
    it('le MANAGER du périmètre commente', async () => {
      const incident = await createIncident(harness.db, createValidIncident(), ownerContext);

      const comment = await addComment(
        harness.db,
        incident.incident.id,
        'Le plombier est passé.',
        managerContext,
      );

      expect(comment.comment.content).toBe('Le plombier est passé.');
      expect(comment.authorName).toBeTruthy();
    });

    it('le TENANT concerné commente', async () => {
      const tenantContext = await contextOf(harness, lease.tenantUserId);
      const incident = await createIncident(harness.db, createValidIncident(), tenantContext);

      const comment = await addComment(
        harness.db,
        incident.incident.id,
        'Merci de votre visite.',
        tenantContext,
      );

      expect(comment.comment.content).toBe('Merci de votre visite.');
    });

    it('un utilisateur hors périmètre est refusé', async () => {
      const incident = await createIncident(harness.db, createValidIncident(), ownerContext);

      await expect(
        addComment(harness.db, incident.incident.id, 'Intrusion.', otherOwnerContext),
      ).rejects.toThrow(IncidentNotFoundError);
    });
  });
});
