import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { PermissionDeniedError, ResourceOutOfScopeError } from '../../src/lib/authorization';
import { insertIncidentTx } from '../../src/modules/incidents/repository';
import {
  InterventionNotFoundError,
  InterventionTerminalError,
  InterventionValidationError,
  InvalidTransitionError,
  MissingActualCostError,
  MissingReasonError,
} from '../../src/modules/interventions/errors';
import type { InterventionFull } from '../../src/modules/interventions/repository';
import {
  createIntervention,
  getIntervention,
  listHistory,
  listInterventions,
  listInterventionsForIncident,
  transitionStatus,
  updateIntervention,
} from '../../src/modules/interventions/service';
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
 * Service des interventions (DEC-060, section 8).
 *
 * Même méthode que `tests/incidents/service.test.ts` : des contextes réels
 * issus de `loadAccessContext`, et des situations construites par le vrai
 * chemin (bail, immeuble) plutôt que des lignes insérées à la main.
 */
describe('Service des interventions (DEC-060)', () => {
  let harness: TestDatabase;
  let ownerContext: Awaited<ReturnType<typeof contextOf>>;
  let managerContext: Awaited<ReturnType<typeof contextOf>>;
  let otherOwnerContext: Awaited<ReturnType<typeof contextOf>>;

  let propertyInScope: string;
  let propertyOutOfScope: string;
  let propertySecondInScope: string;
  let propertyOtherOrg: string;
  let lease: LeaseInfo;
  let otherLease: LeaseInfo;

  let apartmentCounter = 0;
  async function freshLease(propertyId: string): Promise<LeaseInfo> {
    apartmentCounter += 1;
    const apartmentId = await addApartment(harness, propertyId, `R${String(apartmentCounter)}`);
    return addBillableLease(harness, {
      apartmentId,
      tenantApartmentId: apartmentId,
      ownerContext,
      hashPassword: passwordHasher(harness),
      phone: freshPhone(),
      startDate: '2026-01-01',
    });
  }

  const createValidIntervention = (overrides: Partial<Record<string, unknown>> = {}) => ({
    title: 'Remplacement du robinet',
    description: 'Le robinet de la cuisine fuit depuis trois jours.',
    propertyId: propertyInScope,
    apartmentId: lease.apartmentId,
    incidentId: null,
    providerName: null,
    providerPhone: null,
    plannedFor: null,
    estimatedCost: null,
    assignedToUserId: null,
    ...overrides,
  });

  const createOk = (overrides: Partial<Record<string, unknown>> = {}, context = ownerContext) =>
    createIntervention(harness.db, createValidIntervention(overrides), context);

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    ownerContext = await contextOf(harness, SEED_IDS.ownerA);
    managerContext = await contextOf(harness, SEED_IDS.managerA);
    otherOwnerContext = await contextOf(harness, SEED_IDS.ownerB);

    propertyInScope = SEED_IDS.propertyA;
    propertyOutOfScope = await addProperty(harness, 'Résidence hors périmètre gestionnaire');
    propertySecondInScope = await addProperty(harness, 'Résidence secondaire organisation A');
    propertyOtherOrg = await addProperty(harness, 'Résidence autre organisation', {
      organizationId: SEED_IDS.organizationB,
    });

    lease = await freshLease(propertyInScope);
    otherLease = await freshLease(propertyOutOfScope);
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('createIntervention', () => {
    it('le OWNER crée une intervention autonome (sans incident)', async () => {
      const intervention = await createOk();

      expect(intervention.status).toBe('PLANNED');
      expect(intervention.incidentId).toBeNull();
    });

    it('le MANAGER sur son périmètre crée une intervention', async () => {
      const intervention = await createOk({}, managerContext);

      expect(intervention.id).toBeTruthy();
    });

    it('un TENANT qui tente de créer lève PermissionDeniedError', async () => {
      const tenantContext = await contextOf(harness, lease.tenantUserId);

      await expect(createOk({}, tenantContext)).rejects.toThrow(PermissionDeniedError);
    });

    it('un propertyId inexistant lève ResourceOutOfScopeError', async () => {
      await expect(
        createOk({ propertyId: '00000000-0000-4000-8000-000000000000', apartmentId: null }),
      ).rejects.toThrow(ResourceOutOfScopeError);
    });

    it("un apartmentId qui n'appartient pas au propertyId lève ResourceOutOfScopeError", async () => {
      await expect(
        createOk({ apartmentId: otherLease.apartmentId, propertyId: propertyInScope }),
      ).rejects.toThrow(ResourceOutOfScopeError);
    });

    it("un incidentId d'une autre organisation lève ResourceOutOfScopeError", async () => {
      const foreignIncident = await insertIncidentTx(harness.db, {
        organizationId: SEED_IDS.organizationB,
        propertyId: propertyOtherOrg,
        apartmentId: otherLease.apartmentId,
        createdByUserId: SEED_IDS.ownerB,
        title: 'Incident autre organisation',
        description: 'Hors de notre périmètre.',
        priority: 'NORMAL',
        category: 'OTHER',
      });

      await expect(createOk({ incidentId: foreignIncident.id })).rejects.toThrow(
        ResourceOutOfScopeError,
      );
    });

    it('un incidentId avec apartmentId différent lève InterventionValidationError', async () => {
      const incident = await insertIncidentTx(harness.db, {
        organizationId: SEED_IDS.organizationA,
        propertyId: propertyInScope,
        apartmentId: lease.apartmentId,
        createdByUserId: SEED_IDS.ownerA,
        title: 'Incident de référence',
        description: 'Sert à tester la cohérence.',
        priority: 'NORMAL',
        category: 'OTHER',
      });

      await expect(createOk({ incidentId: incident.id, apartmentId: null })).rejects.toThrow(
        InterventionValidationError,
      );
    });

    it('un incidentId avec propertyId différent lève InterventionValidationError', async () => {
      const incident = await insertIncidentTx(harness.db, {
        organizationId: SEED_IDS.organizationA,
        propertyId: propertyInScope,
        apartmentId: lease.apartmentId,
        createdByUserId: SEED_IDS.ownerA,
        title: 'Incident sur le premier immeuble',
        description: 'Sert à tester la cohérence.',
        priority: 'NORMAL',
        category: 'OTHER',
      });
      const secondApartmentId = await addApartment(harness, propertySecondInScope, 'SEC1');

      await expect(
        createOk({
          incidentId: incident.id,
          propertyId: propertySecondInScope,
          apartmentId: secondApartmentId,
        }),
      ).rejects.toThrow(InterventionValidationError);
    });

    it("un assignedToUserId d'une autre organisation lève ResourceOutOfScopeError", async () => {
      await expect(createOk({ assignedToUserId: SEED_IDS.ownerB })).rejects.toThrow(
        ResourceOutOfScopeError,
      );
    });

    it('un titre trop court lève InterventionValidationError', async () => {
      await expect(createOk({ title: 'ab' })).rejects.toThrow(InterventionValidationError);
    });
  });

  describe('updateIntervention', () => {
    it('le OWNER modifie title et description en PLANNED', async () => {
      const intervention = await createOk();

      const updated = await updateIntervention(
        harness.db,
        intervention.id,
        { title: 'Robinet remplacé', description: 'Intervention terminée côté pièces.' },
        ownerContext,
      );

      expect(updated.title).toBe('Robinet remplacé');
    });

    it('le MANAGER modifie providerName en PLANNED', async () => {
      const intervention = await createOk({}, managerContext);

      const updated = await updateIntervention(
        harness.db,
        intervention.id,
        { providerName: 'Plomberie Conakry' },
        managerContext,
      );

      expect(updated.providerName).toBe('Plomberie Conakry');
    });

    it('en IN_PROGRESS, modifier title lève InterventionValidationError', async () => {
      const intervention = await createOk();
      await transitionStatus(
        harness.db,
        intervention.id,
        { toStatus: 'IN_PROGRESS' },
        ownerContext,
      );

      await expect(
        updateIntervention(harness.db, intervention.id, { title: 'Nouveau titre' }, ownerContext),
      ).rejects.toThrow(InterventionValidationError);
    });

    it('en IN_PROGRESS, modifier providerPhone passe', async () => {
      const intervention = await createOk();
      await transitionStatus(
        harness.db,
        intervention.id,
        { toStatus: 'IN_PROGRESS' },
        ownerContext,
      );

      const updated = await updateIntervention(
        harness.db,
        intervention.id,
        { providerPhone: '+224620000099' },
        ownerContext,
      );

      expect(updated.providerPhone).toBe('+224620000099');
    });

    it('sur COMPLETED, toute modification lève InterventionTerminalError', async () => {
      const intervention = await createOk();
      await transitionStatus(
        harness.db,
        intervention.id,
        { toStatus: 'IN_PROGRESS' },
        ownerContext,
      );
      await transitionStatus(
        harness.db,
        intervention.id,
        { toStatus: 'COMPLETED', actualCost: 100_000 },
        ownerContext,
      );

      await expect(
        updateIntervention(
          harness.db,
          intervention.id,
          { providerName: 'Autre prestataire' },
          ownerContext,
        ),
      ).rejects.toThrow(InterventionTerminalError);
    });

    it('sur CANCELLED, toute modification lève InterventionTerminalError', async () => {
      const intervention = await createOk();
      await transitionStatus(
        harness.db,
        intervention.id,
        { toStatus: 'CANCELLED', reason: 'Annulé par le locataire.' },
        ownerContext,
      );

      await expect(
        updateIntervention(harness.db, intervention.id, { title: 'Nouveau titre' }, ownerContext),
      ).rejects.toThrow(InterventionTerminalError);
    });
  });

  describe('transitionStatus', () => {
    it('PLANNED -> IN_PROGRESS passe', async () => {
      const intervention = await createOk();

      const updated = await transitionStatus(
        harness.db,
        intervention.id,
        { toStatus: 'IN_PROGRESS' },
        ownerContext,
      );

      expect(updated.status).toBe('IN_PROGRESS');
      expect(updated.startedAt).not.toBeNull();
    });

    it('PLANNED -> COMPLETED directement lève InvalidTransitionError', async () => {
      const intervention = await createOk();

      await expect(
        transitionStatus(
          harness.db,
          intervention.id,
          { toStatus: 'COMPLETED', actualCost: 50_000 },
          ownerContext,
        ),
      ).rejects.toThrow(InvalidTransitionError);
    });

    it('IN_PROGRESS -> COMPLETED avec actualCost persiste le coût et complete la date', async () => {
      const intervention = await createOk();
      await transitionStatus(
        harness.db,
        intervention.id,
        { toStatus: 'IN_PROGRESS' },
        ownerContext,
      );

      const updated = await transitionStatus(
        harness.db,
        intervention.id,
        { toStatus: 'COMPLETED', actualCost: 135_000 },
        ownerContext,
      );

      expect(updated.status).toBe('COMPLETED');
      expect(updated.actualCost).toBe(135_000);
      expect(updated.completedAt).not.toBeNull();
    });

    it('IN_PROGRESS -> COMPLETED sans actualCost (ni paramètre ni ligne) lève MissingActualCostError', async () => {
      const intervention = await createOk();
      await transitionStatus(
        harness.db,
        intervention.id,
        { toStatus: 'IN_PROGRESS' },
        ownerContext,
      );

      await expect(
        transitionStatus(harness.db, intervention.id, { toStatus: 'COMPLETED' }, ownerContext),
      ).rejects.toThrow(MissingActualCostError);
    });

    it('PLANNED -> CANCELLED sans reason lève MissingReasonError', async () => {
      const intervention = await createOk();

      await expect(
        transitionStatus(harness.db, intervention.id, { toStatus: 'CANCELLED' }, ownerContext),
      ).rejects.toThrow(MissingReasonError);
    });

    it('PLANNED -> CANCELLED avec reason renseigne cancelledAt', async () => {
      const intervention = await createOk();

      const updated = await transitionStatus(
        harness.db,
        intervention.id,
        { toStatus: 'CANCELLED', reason: 'Le locataire a annulé le rendez vous.' },
        ownerContext,
      );

      expect(updated.status).toBe('CANCELLED');
      expect(updated.cancelledAt).not.toBeNull();
    });

    it('COMPLETED -> IN_PROGRESS lève InvalidTransitionError', async () => {
      const intervention = await createOk();
      await transitionStatus(
        harness.db,
        intervention.id,
        { toStatus: 'IN_PROGRESS' },
        ownerContext,
      );
      await transitionStatus(
        harness.db,
        intervention.id,
        { toStatus: 'COMPLETED', actualCost: 20_000 },
        ownerContext,
      );

      await expect(
        transitionStatus(harness.db, intervention.id, { toStatus: 'IN_PROGRESS' }, ownerContext),
      ).rejects.toThrow(InvalidTransitionError);
    });

    it('un TENANT qui tente une transition lève PermissionDeniedError', async () => {
      const intervention = await createOk();
      const tenantContext = await contextOf(harness, lease.tenantUserId);

      await expect(
        transitionStatus(harness.db, intervention.id, { toStatus: 'IN_PROGRESS' }, tenantContext),
      ).rejects.toThrow(PermissionDeniedError);
    });
  });

  describe('getIntervention et listInterventions : projection selon le rôle', () => {
    it('le OWNER reçoit la projection complète', async () => {
      const intervention = await createOk({
        providerName: 'Plomberie Conakry',
        estimatedCost: 90_000,
        assignedToUserId: SEED_IDS.managerA,
      });

      const found = (await getIntervention(
        harness.db,
        intervention.id,
        ownerContext,
      )) as InterventionFull;

      expect(found.providerName).toBe('Plomberie Conakry');
      expect(found.estimatedCost).toBe(90_000);
      expect(found.assignedToUserId).toBe(SEED_IDS.managerA);
    });

    it('le TENANT reçoit la projection minimisée', async () => {
      const intervention = await createOk({
        providerName: 'Plomberie Conakry',
        estimatedCost: 90_000,
        assignedToUserId: SEED_IDS.managerA,
      });
      const tenantContext = await contextOf(harness, lease.tenantUserId);

      const found = await getIntervention(harness.db, intervention.id, tenantContext);

      expect(found).not.toHaveProperty('providerName');
      expect(found).not.toHaveProperty('estimatedCost');
      expect(found).not.toHaveProperty('assignedToUserId');
    });

    it('un TENANT ne peut pas élargir sa vue en passant des filtres', async () => {
      await createOk({ providerName: 'Plomberie Conakry', estimatedCost: 90_000 });
      const tenantContext = await contextOf(harness, lease.tenantUserId);

      const result = await listInterventions(harness.db, tenantContext, { status: ['PLANNED'] });

      expect(result.interventions.length).toBeGreaterThan(0);
      for (const row of result.interventions) {
        expect(row).not.toHaveProperty('providerName');
        expect(row).not.toHaveProperty('estimatedCost');
      }
    });
  });

  describe('listInterventionsForIncident', () => {
    it("le OWNER liste les interventions d'un incident de son organisation", async () => {
      const incident = await insertIncidentTx(harness.db, {
        organizationId: SEED_IDS.organizationA,
        propertyId: propertyInScope,
        apartmentId: lease.apartmentId,
        createdByUserId: SEED_IDS.ownerA,
        title: 'Infiltration au plafond',
        description: 'Une tache apparaît au plafond.',
        priority: 'NORMAL',
        category: 'OTHER',
      });
      const intervention = await createOk({ incidentId: incident.id });

      const list = await listInterventionsForIncident(harness.db, incident.id, ownerContext);

      expect(list.map((row) => row.id)).toEqual([intervention.id]);
    });

    it('un incident hors périmètre lève ResourceOutOfScopeError', async () => {
      const incident = await insertIncidentTx(harness.db, {
        organizationId: SEED_IDS.organizationA,
        propertyId: propertyInScope,
        apartmentId: lease.apartmentId,
        createdByUserId: SEED_IDS.ownerA,
        title: 'Incident hors périmètre pour autrui',
        description: 'Ne doit pas être visible par une autre organisation.',
        priority: 'NORMAL',
        category: 'OTHER',
      });

      await expect(
        listInterventionsForIncident(harness.db, incident.id, otherOwnerContext),
      ).rejects.toThrow(ResourceOutOfScopeError);
    });
  });

  describe('listHistory', () => {
    it('retourne les transitions dans l ordre', async () => {
      const intervention = await createOk();
      await transitionStatus(
        harness.db,
        intervention.id,
        { toStatus: 'IN_PROGRESS' },
        ownerContext,
      );
      await transitionStatus(
        harness.db,
        intervention.id,
        { toStatus: 'COMPLETED', actualCost: 42_000 },
        ownerContext,
      );

      const history = await listHistory(harness.db, intervention.id, ownerContext);

      expect(history.map((entry) => entry.toStatus)).toEqual([
        'PLANNED',
        'IN_PROGRESS',
        'COMPLETED',
      ]);
    });

    it('un TENANT hors périmètre lève InterventionNotFoundError', async () => {
      const intervention = await createOk();
      const otherTenantContext = await contextOf(harness, otherLease.tenantUserId);

      await expect(listHistory(harness.db, intervention.id, otherTenantContext)).rejects.toThrow(
        InterventionNotFoundError,
      );
    });
  });
});
