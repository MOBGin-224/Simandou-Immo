import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  requireAccessContext: vi.fn(),
}));

vi.mock('@/db/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/db/client')>()),
  getDb: mocks.getDb,
}));

vi.mock('@/lib/authorization', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/authorization')>()),
  requireAccessContext: mocks.requireAccessContext,
}));

import { SEED_IDS, seed } from '../../src/db/seed';
import { UnauthenticatedError } from '../../src/lib/auth/session';
import { GET as GET_BY_INCIDENT } from '../../src/app/api/v1/interventions/by-incident/[incidentId]/route';
import { GET as GET_DETAIL, PATCH } from '../../src/app/api/v1/interventions/[id]/route';
import { GET as GET_HISTORY } from '../../src/app/api/v1/interventions/[id]/history/route';
import { PATCH as PATCH_STATUS } from '../../src/app/api/v1/interventions/[id]/status/route';
import { GET as GET_LIST, POST } from '../../src/app/api/v1/interventions/route';
import { insertIncidentTx } from '../../src/modules/incidents/repository';
import { transitionStatus } from '../../src/modules/interventions/service';
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
type InterventionBody = {
  id: string;
  status: string;
  propertyId: string;
  apartmentId: string | null;
  incidentId: string | null;
  providerName: string | null;
  providerPhone: string | null;
  estimatedCost: number | null;
  actualCost: number | null;
  assignedToUserId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
};
type HistoryEntry = { fromStatus: string | null; toStatus: string };

/**
 * API des interventions (Lot 14, DEC-060).
 *
 * Même méthode que `tests/incidents/api.test.ts` : mock de `getDb` et de
 * `requireAccessContext`, PGlite derrière, et jamais de ligne insérée à la
 * main pour une situation que le vrai chemin peut produire.
 */
describe('API des interventions (DEC-060)', () => {
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
    const apartmentId = await addApartment(harness, propertyId, `API${String(apartmentCounter)}`);
    return addBillableLease(harness, {
      apartmentId,
      tenantApartmentId: apartmentId,
      ownerContext,
      hashPassword: passwordHasher(harness),
      phone: freshPhone(),
      startDate: '2026-01-01',
    });
  }

  const validBody = (overrides: Partial<Record<string, unknown>> = {}) => ({
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

  const postRequest = (body: unknown) =>
    new Request('https://immo.test/api/v1/interventions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  async function createViaApi(body: unknown) {
    const response = await POST(postRequest(body));
    const payload = (await response.json()) as {
      data?: InterventionBody;
      error?: { code: string };
    };
    return { response, payload };
  }

  function listRequest(query: string = '') {
    return new Request(`https://immo.test/api/v1/interventions${query}`);
  }

  async function list(query: string = '') {
    const response = await GET_LIST(listRequest(query));
    const payload = (await response.json()) as {
      data?: InterventionBody[];
      meta?: { total: number };
      error?: { code: string };
    };
    return { response, payload };
  }

  async function detail(id: string) {
    const response = await GET_DETAIL(new Request(`https://immo.test/api/v1/interventions/${id}`), {
      params: Promise.resolve({ id }),
    });
    const payload = (await response.json()) as {
      data?: InterventionBody;
      error?: { code: string };
    };
    return { response, payload };
  }

  async function patch(id: string, body: unknown) {
    const response = await PATCH(
      new Request(`https://immo.test/api/v1/interventions/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id }) },
    );
    const payload = (await response.json()) as {
      data?: InterventionBody;
      error?: { code: string };
    };
    return { response, payload };
  }

  async function patchStatus(id: string, body: unknown) {
    const response = await PATCH_STATUS(
      new Request(`https://immo.test/api/v1/interventions/${id}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id }) },
    );
    const payload = (await response.json()) as {
      data?: InterventionBody;
      error?: { code: string };
    };
    return { response, payload };
  }

  async function getHistory(id: string) {
    const response = await GET_HISTORY(
      new Request(`https://immo.test/api/v1/interventions/${id}/history`),
      { params: Promise.resolve({ id }) },
    );
    const payload = (await response.json()) as {
      data?: HistoryEntry[];
      error?: { code: string };
    };
    return { response, payload };
  }

  async function listByIncident(incidentId: string) {
    const response = await GET_BY_INCIDENT(
      new Request(`https://immo.test/api/v1/interventions/by-incident/${incidentId}`),
      { params: Promise.resolve({ incidentId }) },
    );
    const payload = (await response.json()) as {
      data?: InterventionBody[];
      error?: { code: string };
    };
    return { response, payload };
  }

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    ownerContext = await contextOf(harness, SEED_IDS.ownerA);
    managerContext = await contextOf(harness, SEED_IDS.managerA);
    otherOwnerContext = await contextOf(harness, SEED_IDS.ownerB);

    propertyInScope = SEED_IDS.propertyA;
    propertyOutOfScope = await addProperty(harness, 'Résidence API hors périmètre');

    lease = await freshLease(propertyInScope);
    otherLease = await freshLease(propertyOutOfScope);
  });

  beforeEach(() => {
    mocks.getDb.mockReset().mockReturnValue(harness.db);
    mocks.requireAccessContext.mockReset();
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('POST /api/v1/interventions', () => {
    it('le OWNER crée une intervention autonome -> 201 PLANNED', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

      const { response, payload } = await createViaApi(validBody());

      expect(response.status).toBe(201);
      expect(payload.data?.status).toBe('PLANNED');
    });

    it('le MANAGER sur son périmètre crée -> 201', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(managerContext);

      const { response } = await createViaApi(validBody());

      expect(response.status).toBe(201);
    });

    it('un TENANT qui tente de créer répond 403', async () => {
      const tenantContext = await contextOf(harness, lease.tenantUserId);
      mocks.requireAccessContext.mockResolvedValueOnce(tenantContext);

      const { response } = await createViaApi(validBody());

      expect(response.status).toBe(403);
    });

    it('un incidentId d un autre immeuble répond 422', async () => {
      const incident = await insertIncidentTx(harness.db, {
        organizationId: SEED_IDS.organizationA,
        propertyId: propertyOutOfScope,
        apartmentId: otherLease.apartmentId,
        createdByUserId: SEED_IDS.ownerA,
        title: 'Incident sur un autre immeuble',
        description: 'Sert à vérifier la cohérence côté API.',
        priority: 'NORMAL',
        category: 'OTHER',
      });

      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const { response, payload } = await createViaApi(validBody({ incidentId: incident.id }));

      expect(response.status).toBe(422);
      expect(payload.error?.code).toBe('VALIDATION_ERROR');
    });

    it('répond 401 sans authentification', async () => {
      mocks.requireAccessContext.mockRejectedValueOnce(new UnauthenticatedError());

      const { response } = await createViaApi(validBody());

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/interventions', () => {
    it('le OWNER voit toutes les interventions de son organisation', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      await createViaApi(validBody());
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

      const { response, payload } = await list();

      expect(response.status).toBe(200);
      expect(payload.data?.length ?? 0).toBeGreaterThan(0);
    });

    it('le MANAGER voit les interventions de son périmètre', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(managerContext);
      await createViaApi(validBody());
      mocks.requireAccessContext.mockResolvedValueOnce(managerContext);

      const { response, payload } = await list();

      expect(response.status).toBe(200);
      expect(payload.data?.length ?? 0).toBeGreaterThan(0);
    });

    it('le TENANT ne voit que les interventions liées à son bail, en version minimale', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      await createViaApi(validBody({ providerName: 'Plomberie Conakry', estimatedCost: 70_000 }));

      const tenantContext = await contextOf(harness, lease.tenantUserId);
      mocks.requireAccessContext.mockResolvedValueOnce(tenantContext);

      const { response, payload } = await list();

      expect(response.status).toBe(200);
      expect(payload.data?.length ?? 0).toBeGreaterThan(0);
      for (const row of payload.data ?? []) {
        expect(row).not.toHaveProperty('providerName');
        expect(row).not.toHaveProperty('estimatedCost');
      }
    });

    it('le filtre status=IN_PROGRESS fonctionne', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const created = await createViaApi(validBody());
      const id = created.payload.data?.id as string;
      await transitionStatus(harness.db, id, { toStatus: 'IN_PROGRESS' }, ownerContext);

      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const { response, payload } = await list('?status=IN_PROGRESS');

      expect(response.status).toBe(200);
      expect(payload.data?.every((row) => row.status === 'IN_PROGRESS')).toBe(true);
      expect(payload.data?.some((row) => row.id === id)).toBe(true);
    });

    it('le filtre incidentId fonctionne', async () => {
      const incident = await insertIncidentTx(harness.db, {
        organizationId: SEED_IDS.organizationA,
        propertyId: propertyInScope,
        apartmentId: lease.apartmentId,
        createdByUserId: SEED_IDS.ownerA,
        title: 'Incident pour le filtre de liste',
        description: 'Sert à vérifier le filtre incidentId.',
        priority: 'NORMAL',
        category: 'OTHER',
      });
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const created = await createViaApi(validBody({ incidentId: incident.id }));
      const id = created.payload.data?.id as string;

      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const { response, payload } = await list(`?incidentId=${incident.id}`);

      expect(response.status).toBe(200);
      expect(payload.data?.map((row) => row.id)).toEqual([id]);
    });

    it('la pagination ?page=2 fonctionne', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      for (let i = 0; i < 3; i += 1) {
        await createViaApi(validBody());
        mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      }

      const { response, payload } = await list('?page=2&pageSize=2');

      expect(response.status).toBe(200);
      expect(payload.meta?.total).toBeGreaterThanOrEqual(3);
    });

    it('répond 401 sans authentification', async () => {
      mocks.requireAccessContext.mockRejectedValueOnce(new UnauthenticatedError());

      const { response } = await list();

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/interventions/[id]', () => {
    it('le OWNER lit une intervention de son organisation avec tous les champs', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const created = await createViaApi(
        validBody({ providerName: 'Plomberie Conakry', estimatedCost: 60_000 }),
      );
      const id = created.payload.data?.id as string;

      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const { response, payload } = await detail(id);

      expect(response.status).toBe(200);
      expect(payload.data?.providerName).toBe('Plomberie Conakry');
      expect(payload.data?.estimatedCost).toBe(60_000);
    });

    it('le TENANT lit une intervention de son logement sans les coûts', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const created = await createViaApi(
        validBody({ providerName: 'Plomberie Conakry', estimatedCost: 60_000 }),
      );
      const id = created.payload.data?.id as string;

      const tenantContext = await contextOf(harness, lease.tenantUserId);
      mocks.requireAccessContext.mockResolvedValueOnce(tenantContext);
      const { response, payload } = await detail(id);

      expect(response.status).toBe(200);
      expect(payload.data).not.toHaveProperty('providerName');
      expect(payload.data).not.toHaveProperty('estimatedCost');
    });

    it('une autre organisation répond 404', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const created = await createViaApi(validBody());
      const id = created.payload.data?.id as string;

      mocks.requireAccessContext.mockResolvedValueOnce(otherOwnerContext);
      const { response } = await detail(id);

      expect(response.status).toBe(404);
    });

    it('une intervention inexistante répond 404', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

      const { response } = await detail('00000000-0000-4000-8000-000000000000');

      expect(response.status).toBe(404);
    });

    it('répond 401 sans authentification', async () => {
      mocks.requireAccessContext.mockRejectedValueOnce(new UnauthenticatedError());

      const { response } = await detail('00000000-0000-4000-8000-000000000000');

      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/v1/interventions/[id]', () => {
    it('le OWNER modifie en PLANNED -> 200', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const created = await createViaApi(validBody());
      const id = created.payload.data?.id as string;

      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const { response, payload } = await patch(id, { title: 'Robinet remplacé' });

      expect(response.status).toBe(200);
      expect(payload.data?.id).toBe(id);
    });

    it('en IN_PROGRESS, modifier title répond 422', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const created = await createViaApi(validBody());
      const id = created.payload.data?.id as string;
      await transitionStatus(harness.db, id, { toStatus: 'IN_PROGRESS' }, ownerContext);

      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const { response, payload } = await patch(id, { title: 'Nouveau titre' });

      expect(response.status).toBe(422);
      expect(payload.error?.code).toBe('VALIDATION_ERROR');
    });

    it('en COMPLETED, toute modification répond 422', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const created = await createViaApi(validBody());
      const id = created.payload.data?.id as string;
      await transitionStatus(harness.db, id, { toStatus: 'IN_PROGRESS' }, ownerContext);
      await transitionStatus(
        harness.db,
        id,
        { toStatus: 'COMPLETED', actualCost: 30_000 },
        ownerContext,
      );

      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const { response, payload } = await patch(id, { providerName: 'Autre prestataire' });

      expect(response.status).toBe(422);
      expect(payload.error?.code).toBe('VALIDATION_ERROR');
    });

    it('une autre organisation répond 404', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const created = await createViaApi(validBody());
      const id = created.payload.data?.id as string;

      mocks.requireAccessContext.mockResolvedValueOnce(otherOwnerContext);
      const { response } = await patch(id, { title: 'Intrusion' });

      expect(response.status).toBe(404);
    });

    it('répond 401 sans authentification', async () => {
      mocks.requireAccessContext.mockRejectedValueOnce(new UnauthenticatedError());

      const { response } = await patch('00000000-0000-4000-8000-000000000000', {
        title: 'Peu importe',
      });

      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/v1/interventions/[id]/status', () => {
    it('PLANNED -> IN_PROGRESS -> 200', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const created = await createViaApi(validBody());
      const id = created.payload.data?.id as string;

      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const { response, payload } = await patchStatus(id, { toStatus: 'IN_PROGRESS' });

      expect(response.status).toBe(200);
      expect(payload.data?.status).toBe('IN_PROGRESS');
    });

    it('PLANNED -> COMPLETED directement répond 422', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const created = await createViaApi(validBody());
      const id = created.payload.data?.id as string;

      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const { response, payload } = await patchStatus(id, {
        toStatus: 'COMPLETED',
        actualCost: 10_000,
      });

      expect(response.status).toBe(422);
      expect(payload.error?.code).toBe('VALIDATION_ERROR');
    });

    it('IN_PROGRESS -> COMPLETED sans actualCost répond 422', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const created = await createViaApi(validBody());
      const id = created.payload.data?.id as string;
      await transitionStatus(harness.db, id, { toStatus: 'IN_PROGRESS' }, ownerContext);

      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const { response, payload } = await patchStatus(id, { toStatus: 'COMPLETED' });

      expect(response.status).toBe(422);
      expect(payload.error?.code).toBe('VALIDATION_ERROR');
    });

    it('IN_PROGRESS -> COMPLETED avec actualCost répond 200 et persiste le coût', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const created = await createViaApi(validBody());
      const id = created.payload.data?.id as string;
      await transitionStatus(harness.db, id, { toStatus: 'IN_PROGRESS' }, ownerContext);

      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const { response, payload } = await patchStatus(id, {
        toStatus: 'COMPLETED',
        actualCost: 95_000,
      });

      expect(response.status).toBe(200);
      expect(payload.data?.status).toBe('COMPLETED');
      expect(payload.data?.actualCost).toBe(95_000);
    });

    it('PLANNED -> CANCELLED sans reason répond 422', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const created = await createViaApi(validBody());
      const id = created.payload.data?.id as string;

      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const { response, payload } = await patchStatus(id, { toStatus: 'CANCELLED' });

      expect(response.status).toBe(422);
      expect(payload.error?.code).toBe('VALIDATION_ERROR');
    });

    it('PLANNED -> CANCELLED avec reason répond 200', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const created = await createViaApi(validBody());
      const id = created.payload.data?.id as string;

      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const { response, payload } = await patchStatus(id, {
        toStatus: 'CANCELLED',
        reason: 'Le locataire a annulé le rendez vous.',
      });

      expect(response.status).toBe(200);
      expect(payload.data?.status).toBe('CANCELLED');
    });

    it('un TENANT qui tente une transition répond 403', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const created = await createViaApi(validBody());
      const id = created.payload.data?.id as string;

      const tenantContext = await contextOf(harness, lease.tenantUserId);
      mocks.requireAccessContext.mockResolvedValueOnce(tenantContext);
      const { response } = await patchStatus(id, { toStatus: 'IN_PROGRESS' });

      expect(response.status).toBe(403);
    });

    it('répond 401 sans authentification', async () => {
      mocks.requireAccessContext.mockRejectedValueOnce(new UnauthenticatedError());

      const { response } = await patchStatus('00000000-0000-4000-8000-000000000000', {
        toStatus: 'IN_PROGRESS',
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/interventions/[id]/history', () => {
    it("le OWNER lit l'historique avec les transitions", async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const created = await createViaApi(validBody());
      const id = created.payload.data?.id as string;
      await transitionStatus(harness.db, id, { toStatus: 'IN_PROGRESS' }, ownerContext);

      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const { response, payload } = await getHistory(id);

      expect(response.status).toBe(200);
      expect(payload.data?.map((entry) => entry.toStatus)).toEqual(['PLANNED', 'IN_PROGRESS']);
    });

    it('une autre organisation répond 404', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const created = await createViaApi(validBody());
      const id = created.payload.data?.id as string;

      mocks.requireAccessContext.mockResolvedValueOnce(otherOwnerContext);
      const { response } = await getHistory(id);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/v1/interventions/by-incident/[incidentId]', () => {
    it("le OWNER liste les interventions d'un incident", async () => {
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
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const created = await createViaApi(validBody({ incidentId: incident.id }));
      const id = created.payload.data?.id as string;

      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const { response, payload } = await listByIncident(incident.id);

      expect(response.status).toBe(200);
      expect(payload.data?.map((row) => row.id)).toEqual([id]);
    });

    it('un incident hors périmètre répond 404', async () => {
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

      mocks.requireAccessContext.mockResolvedValueOnce(otherOwnerContext);
      const { response } = await listByIncident(incident.id);

      expect(response.status).toBe(404);
    });

    it('répond 401 sans authentification', async () => {
      mocks.requireAccessContext.mockRejectedValueOnce(new UnauthenticatedError());

      const { response } = await listByIncident('00000000-0000-4000-8000-000000000000');

      expect(response.status).toBe(401);
    });
  });
});
