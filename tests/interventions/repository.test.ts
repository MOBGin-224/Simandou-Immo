import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { insertIncidentTx } from '../../src/modules/incidents/repository';
import {
  InterventionTerminalError,
  InterventionValidationError,
  InvalidTransitionError,
  MissingActualCostError,
  MissingReasonError,
} from '../../src/modules/interventions/errors';
import {
  findInterventionById,
  insertInterventionTx,
  listInterventionsForContext,
  listInterventionsForIncident,
  listInterventionStatusHistory,
  transitionInterventionStatusTx,
  updateInterventionFieldsTx,
  type InsertInterventionPayload,
  type InterventionFull,
} from '../../src/modules/interventions/repository';
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
 * Repository des interventions (DEC-060).
 *
 * Même méthode que `tests/incidents/repository.test.ts` : un périmètre par
 * organisation ou par immeuble, des contextes réels issus de
 * `loadAccessContext`, jamais de raccourci qui contournerait la condition de
 * visibilité.
 */
describe('Repository des interventions (DEC-060)', () => {
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
    const apartmentId = await addApartment(harness, propertyId, `V${String(apartmentCounter)}`);
    return addBillableLease(harness, {
      apartmentId,
      tenantApartmentId: apartmentId,
      ownerContext,
      hashPassword: passwordHasher(harness),
      phone: freshPhone(),
      startDate: '2026-01-01',
    });
  }

  const payloadFor = (
    values: Partial<InsertInterventionPayload> = {},
  ): InsertInterventionPayload => ({
    organizationId: SEED_IDS.organizationA,
    propertyId: propertyInScope,
    apartmentId: lease.apartmentId,
    createdByUserId: SEED_IDS.ownerA,
    title: 'Remplacement du chauffe eau',
    description: 'Le chauffe eau ne produit plus d eau chaude.',
    ...values,
  });

  const insertIntervention = (values: Partial<InsertInterventionPayload> = {}) =>
    insertInterventionTx(harness.db, payloadFor(values));

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

  describe('insertInterventionTx', () => {
    it('crée l intervention en PLANNED et une ligne d historique de création', async () => {
      const intervention = await insertIntervention();

      expect(intervention.status).toBe('PLANNED');

      const history = await listInterventionStatusHistory(
        harness.db,
        intervention.id,
        ownerContext,
      );

      expect(history).toHaveLength(1);
      expect(history[0]?.fromStatus).toBeNull();
      expect(history[0]?.toStatus).toBe('PLANNED');
      expect(history[0]?.byUserId).toBe(SEED_IDS.ownerA);
    });
  });

  describe('Visibilité : findInterventionById', () => {
    it('le OWNER de l organisation trouve l intervention', async () => {
      const intervention = await insertIntervention();

      const found = await findInterventionById(harness.db, intervention.id, ownerContext, 'full');

      expect(found?.id).toBe(intervention.id);
    });

    it('le MANAGER sur son périmètre trouve l intervention', async () => {
      const intervention = await insertIntervention({ propertyId: propertyInScope });

      const found = await findInterventionById(harness.db, intervention.id, managerContext, 'full');

      expect(found?.id).toBe(intervention.id);
    });

    it('le MANAGER hors périmètre reçoit null', async () => {
      const intervention = await insertIntervention({
        propertyId: propertyOutOfScope,
        apartmentId: otherLease.apartmentId,
        createdByUserId: SEED_IDS.ownerB,
      });

      const found = await findInterventionById(harness.db, intervention.id, managerContext, 'full');

      expect(found).toBeNull();
    });

    it('le TENANT dont le bail correspond à apartmentId voit (version minimale)', async () => {
      const intervention = await insertIntervention();
      const tenantContext = await contextOf(harness, lease.tenantUserId);

      const found = await findInterventionById(
        harness.db,
        intervention.id,
        tenantContext,
        'minimal',
      );

      expect(found?.id).toBe(intervention.id);
    });

    it('le TENANT dont un incident lié existe voit (version minimale), même hors de son logement', async () => {
      const incident = await insertIncidentTx(harness.db, {
        organizationId: SEED_IDS.organizationA,
        propertyId: propertyInScope,
        apartmentId: lease.apartmentId,
        createdByUserId: lease.tenantUserId,
        title: 'Fuite dans les parties communes',
        description: 'De l eau s infiltre depuis le toit.',
        priority: 'NORMAL',
        category: 'OTHER',
      });

      // apartmentId NULL : seule la sous-requête sur incidentId doit la rendre visible.
      const intervention = await insertIntervention({
        apartmentId: null,
        incidentId: incident.id,
      });
      const tenantContext = await contextOf(harness, lease.tenantUserId);

      const found = await findInterventionById(
        harness.db,
        intervention.id,
        tenantContext,
        'minimal',
      );

      expect(found?.id).toBe(intervention.id);
    });

    it('un TENANT hors périmètre reçoit null', async () => {
      const intervention = await insertIntervention();
      const otherTenantContext = await contextOf(harness, otherLease.tenantUserId);

      const found = await findInterventionById(
        harness.db,
        intervention.id,
        otherTenantContext,
        'minimal',
      );

      expect(found).toBeNull();
    });

    it('une autre organisation reçoit null', async () => {
      const intervention = await insertIntervention();

      const found = await findInterventionById(
        harness.db,
        intervention.id,
        otherOwnerContext,
        'full',
      );

      expect(found).toBeNull();
    });
  });

  describe('Projection : full contre minimal', () => {
    it("la projection 'full' renvoie les coûts, le prestataire et l affectation", async () => {
      const intervention = await insertIntervention({
        providerName: 'Plomberie Conakry',
        providerPhone: '+224620000099',
        assignedToUserId: SEED_IDS.managerA,
        estimatedCost: 200_000,
      });

      const found = (await findInterventionById(
        harness.db,
        intervention.id,
        ownerContext,
        'full',
      )) as InterventionFull;

      expect(found.providerName).toBe('Plomberie Conakry');
      expect(found.providerPhone).toBe('+224620000099');
      expect(found.assignedToUserId).toBe(SEED_IDS.managerA);
      expect(found.estimatedCost).toBe(200_000);
    });

    it("la projection 'minimal' ne renvoie ni coûts, ni prestataire, ni affectation", async () => {
      const intervention = await insertIntervention({
        providerName: 'Plomberie Conakry',
        providerPhone: '+224620000099',
        assignedToUserId: SEED_IDS.managerA,
        estimatedCost: 200_000,
      });
      const tenantContext = await contextOf(harness, lease.tenantUserId);

      const found = await findInterventionById(
        harness.db,
        intervention.id,
        tenantContext,
        'minimal',
      );

      expect(found).not.toHaveProperty('providerName');
      expect(found).not.toHaveProperty('providerPhone');
      expect(found).not.toHaveProperty('assignedToUserId');
      expect(found).not.toHaveProperty('estimatedCost');
      expect(found).not.toHaveProperty('actualCost');
    });
  });

  describe('Liste : listInterventionsForContext', () => {
    it('filtre par statut', async () => {
      const intervention = await insertIntervention();
      await transitionInterventionStatusTx(
        harness.db,
        intervention.id,
        'IN_PROGRESS',
        SEED_IDS.ownerA,
        null,
        ownerContext,
      );

      const result = await listInterventionsForContext(
        harness.db,
        ownerContext,
        { status: ['IN_PROGRESS'] },
        'full',
      );

      expect(result.interventions.some((row) => row.id === intervention.id)).toBe(true);
      expect(result.interventions.every((row) => row.status === 'IN_PROGRESS')).toBe(true);
    });

    it('filtre par immeuble', async () => {
      const intervention = await insertIntervention({ propertyId: propertyInScope });

      const result = await listInterventionsForContext(
        harness.db,
        ownerContext,
        { propertyId: propertyInScope },
        'full',
      );

      expect(
        result.interventions.every(
          (row) => (row as InterventionFull).propertyId === propertyInScope,
        ),
      ).toBe(true);
      expect(result.interventions.some((row) => row.id === intervention.id)).toBe(true);
    });

    it('filtre par logement', async () => {
      const intervention = await insertIntervention({ apartmentId: lease.apartmentId });

      const result = await listInterventionsForContext(
        harness.db,
        ownerContext,
        { apartmentId: lease.apartmentId },
        'full',
      );

      expect(result.interventions.some((row) => row.id === intervention.id)).toBe(true);
    });

    it('filtre par incident', async () => {
      const incident = await insertIncidentTx(harness.db, {
        organizationId: SEED_IDS.organizationA,
        propertyId: propertyInScope,
        apartmentId: lease.apartmentId,
        createdByUserId: lease.tenantUserId,
        title: 'Panne électrique',
        description: 'Plus de courant dans la cuisine.',
        priority: 'URGENT',
        category: 'ELECTRICITY',
      });
      const intervention = await insertIntervention({ incidentId: incident.id });

      const result = await listInterventionsForContext(
        harness.db,
        ownerContext,
        { incidentId: incident.id },
        'full',
      );

      expect(result.interventions.map((row) => row.id)).toEqual([intervention.id]);
    });

    it('filtre par assignedToUserId', async () => {
      const intervention = await insertIntervention({ assignedToUserId: SEED_IDS.managerA });

      const result = await listInterventionsForContext(
        harness.db,
        ownerContext,
        { assignedToUserId: SEED_IDS.managerA },
        'full',
      );

      expect(result.interventions.some((row) => row.id === intervention.id)).toBe(true);
      expect(
        result.interventions.every(
          (row) => (row as InterventionFull).assignedToUserId === SEED_IDS.managerA,
        ),
      ).toBe(true);
    });

    it('pagine (page, pageSize)', async () => {
      for (let i = 0; i < 3; i += 1) await insertIntervention();

      const result = await listInterventionsForContext(
        harness.db,
        ownerContext,
        { page: 1, pageSize: 2 },
        'full',
      );

      expect(result.interventions).toHaveLength(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.pageSize).toBe(2);
      expect(result.meta.total).toBeGreaterThanOrEqual(3);
    });

    it('trie par createdAt décroissant', async () => {
      for (let i = 0; i < 3; i += 1) await insertIntervention();

      const result = await listInterventionsForContext(harness.db, ownerContext, {}, 'full');
      const createdDates = result.interventions.map((row) =>
        (row as InterventionFull).createdAt.getTime(),
      );

      for (let i = 1; i < createdDates.length; i += 1) {
        expect(createdDates[i - 1]).toBeGreaterThanOrEqual(createdDates[i] ?? 0);
      }
    });

    it('respecte le périmètre : un TENANT ne voit jamais le logement d un autre bail', async () => {
      await insertIntervention();
      const otherIntervention = await insertIntervention({
        propertyId: propertyOutOfScope,
        apartmentId: otherLease.apartmentId,
        createdByUserId: SEED_IDS.ownerB,
      });
      const otherFound = (await findInterventionById(
        harness.db,
        otherIntervention.id,
        ownerContext,
        'full',
      )) as InterventionFull;
      const tenantContext = await contextOf(harness, lease.tenantUserId);

      const result = await listInterventionsForContext(harness.db, tenantContext, {}, 'minimal');

      expect(result.interventions.length).toBeGreaterThan(0);
      expect(
        result.interventions.every((row) => row.apartmentNumber !== otherFound.apartmentNumber),
      ).toBe(true);
    });
  });

  describe('updateInterventionFieldsTx', () => {
    it('met à jour les champs en PLANNED', async () => {
      const intervention = await insertIntervention();

      const updated = await updateInterventionFieldsTx(
        harness.db,
        intervention.id,
        { title: 'Chauffe eau remplacé', estimatedCost: 180_000 },
        ownerContext,
      );

      expect(updated.title).toBe('Chauffe eau remplacé');
      expect(updated.estimatedCost).toBe(180_000);
    });

    it('refuse la modification de title en IN_PROGRESS', async () => {
      const intervention = await insertIntervention();
      await transitionInterventionStatusTx(
        harness.db,
        intervention.id,
        'IN_PROGRESS',
        SEED_IDS.ownerA,
        null,
        ownerContext,
      );

      await expect(
        updateInterventionFieldsTx(
          harness.db,
          intervention.id,
          { title: 'Nouveau titre' },
          ownerContext,
        ),
      ).rejects.toThrow(InterventionValidationError);
    });

    it('accepte providerName, providerPhone et estimatedCost en IN_PROGRESS', async () => {
      const intervention = await insertIntervention();
      await transitionInterventionStatusTx(
        harness.db,
        intervention.id,
        'IN_PROGRESS',
        SEED_IDS.ownerA,
        null,
        ownerContext,
      );

      const updated = await updateInterventionFieldsTx(
        harness.db,
        intervention.id,
        { providerName: 'Électricité Kaloum', estimatedCost: 90_000 },
        ownerContext,
      );

      expect(updated.providerName).toBe('Électricité Kaloum');
    });

    it('refuse toute modification sur une intervention COMPLETED', async () => {
      const intervention = await insertIntervention();
      await transitionInterventionStatusTx(
        harness.db,
        intervention.id,
        'IN_PROGRESS',
        SEED_IDS.ownerA,
        null,
        ownerContext,
      );
      await transitionInterventionStatusTx(
        harness.db,
        intervention.id,
        'COMPLETED',
        SEED_IDS.ownerA,
        null,
        ownerContext,
        120_000,
      );

      await expect(
        updateInterventionFieldsTx(
          harness.db,
          intervention.id,
          { providerName: 'Nouveau prestataire' },
          ownerContext,
        ),
      ).rejects.toThrow(InterventionTerminalError);
    });
  });

  describe('transitionInterventionStatusTx', () => {
    it('PLANNED -> IN_PROGRESS renseigne startedAt', async () => {
      const intervention = await insertIntervention();

      const updated = await transitionInterventionStatusTx(
        harness.db,
        intervention.id,
        'IN_PROGRESS',
        SEED_IDS.ownerA,
        null,
        ownerContext,
      );

      expect(updated.status).toBe('IN_PROGRESS');
      expect(updated.startedAt).not.toBeNull();
    });

    it('IN_PROGRESS -> COMPLETED sans actualCost échoue', async () => {
      const intervention = await insertIntervention();
      await transitionInterventionStatusTx(
        harness.db,
        intervention.id,
        'IN_PROGRESS',
        SEED_IDS.ownerA,
        null,
        ownerContext,
      );

      await expect(
        transitionInterventionStatusTx(
          harness.db,
          intervention.id,
          'COMPLETED',
          SEED_IDS.ownerA,
          null,
          ownerContext,
        ),
      ).rejects.toThrow(MissingActualCostError);
    });

    it('IN_PROGRESS -> COMPLETED avec actualCost renseigne completedAt', async () => {
      const intervention = await insertIntervention();
      await transitionInterventionStatusTx(
        harness.db,
        intervention.id,
        'IN_PROGRESS',
        SEED_IDS.ownerA,
        null,
        ownerContext,
      );

      const updated = await transitionInterventionStatusTx(
        harness.db,
        intervention.id,
        'COMPLETED',
        SEED_IDS.ownerA,
        null,
        ownerContext,
        125_000,
      );

      expect(updated.status).toBe('COMPLETED');
      expect(updated.completedAt).not.toBeNull();
      expect(updated.actualCost).toBe(125_000);
    });

    it('PLANNED -> CANCELLED sans motif échoue', async () => {
      const intervention = await insertIntervention();

      await expect(
        transitionInterventionStatusTx(
          harness.db,
          intervention.id,
          'CANCELLED',
          SEED_IDS.ownerA,
          null,
          ownerContext,
        ),
      ).rejects.toThrow(MissingReasonError);
    });

    it('PLANNED -> CANCELLED avec motif renseigne cancelledAt', async () => {
      const intervention = await insertIntervention();

      const updated = await transitionInterventionStatusTx(
        harness.db,
        intervention.id,
        'CANCELLED',
        SEED_IDS.ownerA,
        'Le locataire a annulé le rendez vous.',
        ownerContext,
      );

      expect(updated.status).toBe('CANCELLED');
      expect(updated.cancelledAt).not.toBeNull();
    });

    it('PLANNED -> COMPLETED directement échoue', async () => {
      const intervention = await insertIntervention();

      await expect(
        transitionInterventionStatusTx(
          harness.db,
          intervention.id,
          'COMPLETED',
          SEED_IDS.ownerA,
          null,
          ownerContext,
          100_000,
        ),
      ).rejects.toThrow(InvalidTransitionError);
    });

    it('COMPLETED -> IN_PROGRESS échoue', async () => {
      const intervention = await insertIntervention();
      await transitionInterventionStatusTx(
        harness.db,
        intervention.id,
        'IN_PROGRESS',
        SEED_IDS.ownerA,
        null,
        ownerContext,
      );
      await transitionInterventionStatusTx(
        harness.db,
        intervention.id,
        'COMPLETED',
        SEED_IDS.ownerA,
        null,
        ownerContext,
        100_000,
      );

      await expect(
        transitionInterventionStatusTx(
          harness.db,
          intervention.id,
          'IN_PROGRESS',
          SEED_IDS.ownerA,
          null,
          ownerContext,
        ),
      ).rejects.toThrow(InvalidTransitionError);
    });

    it('deux transitions successives vers le même statut : la seconde échoue', async () => {
      const intervention = await insertIntervention();
      await transitionInterventionStatusTx(
        harness.db,
        intervention.id,
        'IN_PROGRESS',
        SEED_IDS.ownerA,
        null,
        ownerContext,
      );

      await expect(
        transitionInterventionStatusTx(
          harness.db,
          intervention.id,
          'IN_PROGRESS',
          SEED_IDS.ownerA,
          null,
          ownerContext,
        ),
      ).rejects.toThrow(InvalidTransitionError);
    });
  });

  describe('Incident : listInterventionsForIncident', () => {
    it('retourne les interventions liées, filtrées par périmètre', async () => {
      const incident = await insertIncidentTx(harness.db, {
        organizationId: SEED_IDS.organizationA,
        propertyId: propertyInScope,
        apartmentId: lease.apartmentId,
        createdByUserId: lease.tenantUserId,
        title: 'Infiltration au plafond',
        description: 'Une tache apparaît au plafond du salon.',
        priority: 'NORMAL',
        category: 'OTHER',
      });
      const intervention = await insertIntervention({ incidentId: incident.id });

      const forOwner = await listInterventionsForIncident(
        harness.db,
        incident.id,
        ownerContext,
        'full',
      );
      expect(forOwner.map((row) => row.id)).toEqual([intervention.id]);

      const forOtherOwner = await listInterventionsForIncident(
        harness.db,
        incident.id,
        otherOwnerContext,
        'full',
      );
      expect(forOtherOwner).toEqual([]);
    });
  });

  describe('Historique : listInterventionStatusHistory', () => {
    it('retourne les entrées dans l ordre createdAt croissant', async () => {
      const intervention = await insertIntervention();
      await transitionInterventionStatusTx(
        harness.db,
        intervention.id,
        'IN_PROGRESS',
        SEED_IDS.ownerA,
        null,
        ownerContext,
      );
      await transitionInterventionStatusTx(
        harness.db,
        intervention.id,
        'COMPLETED',
        SEED_IDS.ownerA,
        null,
        ownerContext,
        50_000,
      );

      const history = await listInterventionStatusHistory(
        harness.db,
        intervention.id,
        ownerContext,
      );

      expect(history.map((entry) => entry.toStatus)).toEqual([
        'PLANNED',
        'IN_PROGRESS',
        'COMPLETED',
      ]);
    });

    it('un TENANT hors périmètre reçoit un tableau vide, pas d erreur', async () => {
      const intervention = await insertIntervention();
      const otherTenantContext = await contextOf(harness, otherLease.tenantUserId);

      const history = await listInterventionStatusHistory(
        harness.db,
        intervention.id,
        otherTenantContext,
      );

      expect(history).toEqual([]);
    });
  });
});
