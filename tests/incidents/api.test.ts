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
import { GET as GET_LIST, POST } from '../../src/app/api/v1/incidents/route';
import { GET as GET_DETAIL, PATCH } from '../../src/app/api/v1/incidents/[id]/route';
import { assignIncident, transitionStatus } from '../../src/modules/incidents/service';
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
type IncidentBody = {
  incident: { id: string; status: string; createdByUserId: string; apartmentId: string };
};

/**
 * API des incidents, routes CRUD de base (Lot 13, DEC-059).
 *
 * Même méthode que `tests/receipts/api.test.ts` : mock de `getDb` et de
 * `requireAccessContext`, PGlite derrière, et jamais de ligne insérée à la
 * main pour une situation que le vrai chemin peut produire.
 */
describe('API des incidents (DEC-059), routes CRUD de base', () => {
  let harness: TestDatabase;
  let ownerContext: Awaited<ReturnType<typeof contextOf>>;
  let managerContext: Awaited<ReturnType<typeof contextOf>>;
  let otherOwnerContext: Awaited<ReturnType<typeof contextOf>>;

  let propertyInScope: string;
  let propertyOutOfScope: string;
  let lease: LeaseInfo;
  let otherLease: LeaseInfo;
  let secondManagerUserId: string;

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

  const postRequest = (body: unknown) =>
    new Request('https://immo.test/api/v1/incidents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  const validBody = (overrides: Partial<Record<string, unknown>> = {}) => ({
    title: 'Fuite d eau',
    description: 'De l eau s accumule sous l evier.',
    priority: 'NORMAL',
    category: 'PLUMBING',
    apartmentId: lease.apartmentId,
    ...overrides,
  });

  async function createViaApi(body: unknown) {
    const response = await POST(postRequest(body));
    const payload = (await response.json()) as {
      data?: IncidentBody;
      error?: { code: string };
    };
    return { response, payload };
  }

  function listRequest(query: string = '') {
    return new Request(`https://immo.test/api/v1/incidents${query}`);
  }

  async function list(query: string = '') {
    const response = await GET_LIST(listRequest(query));
    const payload = (await response.json()) as {
      data?: IncidentBody[];
      meta?: { total: number };
      error?: { code: string };
    };
    return { response, payload };
  }

  async function detail(id: string) {
    const response = await GET_DETAIL(new Request(`https://immo.test/api/v1/incidents/${id}`), {
      params: Promise.resolve({ id }),
    });
    const payload = (await response.json()) as {
      data?: IncidentBody;
      error?: { code: string };
    };
    return { response, payload };
  }

  async function patch(id: string, body: unknown) {
    const response = await PATCH(
      new Request(`https://immo.test/api/v1/incidents/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id }) },
    );
    const payload = (await response.json()) as {
      data?: IncidentBody;
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
    otherLease = await freshLease(propertyInScope);

    const secondManager = await addUser(harness, { fullName: 'Gestionnaire API' });
    secondManagerUserId = secondManager.id;
    await addAccess(harness, { userId: secondManagerUserId, role: 'MANAGER' });
  });

  beforeEach(() => {
    mocks.getDb.mockReset().mockReturnValue(harness.db);
    mocks.requireAccessContext.mockReset();
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('POST /api/v1/incidents', () => {
    it('le OWNER crée un incident OPEN', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

      const { response, payload } = await createViaApi(validBody());

      expect(response.status).toBe(201);
      expect(payload.data?.incident.status).toBe('OPEN');
    });

    it('le MANAGER sur son périmètre crée un incident', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(managerContext);

      const { response } = await createViaApi(validBody());

      expect(response.status).toBe(201);
    });

    it('un TENANT avec bail actif crée un incident', async () => {
      const tenantContext = await contextOf(harness, lease.tenantUserId);
      mocks.requireAccessContext.mockResolvedValueOnce(tenantContext);

      const { response, payload } = await createViaApi(validBody());

      expect(response.status).toBe(201);
      expect(payload.data?.incident.createdByUserId).toBe(lease.tenantUserId);
    });

    it('un TENANT sans bail sur le logement est refusé', async () => {
      const tenantContext = await contextOf(harness, lease.tenantUserId);
      mocks.requireAccessContext.mockResolvedValueOnce(tenantContext);
      const otherApartmentId = await addApartment(harness, propertyOutOfScope, 'NOLEASE1');

      const { response } = await createViaApi(validBody({ apartmentId: otherApartmentId }));

      expect([403, 404]).toContain(response.status);
    });

    it('un titre trop court répond 422', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

      const { response, payload } = await createViaApi(validBody({ title: 'X' }));

      expect(response.status).toBe(422);
      expect(payload.error?.code).toBe('VALIDATION_ERROR');
    });

    it('répond 401 sans authentification', async () => {
      mocks.requireAccessContext.mockRejectedValueOnce(new UnauthenticatedError());

      const { response } = await createViaApi(validBody());

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/incidents', () => {
    it('le OWNER voit tous les incidents de son organisation', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      await createViaApi(validBody());
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

      const { response, payload } = await list();

      expect(response.status).toBe(200);
      expect(payload.data?.length ?? 0).toBeGreaterThan(0);
    });

    it('le MANAGER voit les incidents de son périmètre', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(managerContext);
      await createViaApi(validBody());
      mocks.requireAccessContext.mockResolvedValueOnce(managerContext);

      const { response, payload } = await list();

      expect(response.status).toBe(200);
      expect(payload.data?.length ?? 0).toBeGreaterThan(0);
    });

    it('le TENANT ne voit que ses propres incidents', async () => {
      const tenantContext = await contextOf(harness, lease.tenantUserId);
      mocks.requireAccessContext.mockResolvedValueOnce(tenantContext);
      await createViaApi(validBody());
      mocks.requireAccessContext.mockResolvedValueOnce(tenantContext);

      const { response, payload } = await list();

      expect(response.status).toBe(200);
      expect(
        payload.data?.every(
          (row) =>
            row.incident.createdByUserId === lease.tenantUserId ||
            row.incident.apartmentId === lease.apartmentId,
        ),
      ).toBe(true);
    });

    it('le filtre status=OPEN fonctionne', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      await createViaApi(validBody());
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

      const { response, payload } = await list('?status=OPEN');

      expect(response.status).toBe(200);
      expect(payload.data?.every((row) => row.incident.status === 'OPEN')).toBe(true);
    });

    it('le filtre priority=URGENT fonctionne', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      await createViaApi(validBody({ priority: 'URGENT' }));
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

      const { response, payload } = await list('?priority=URGENT');

      expect(response.status).toBe(200);
      expect(payload.data?.length ?? 0).toBeGreaterThan(0);
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

  describe('GET /api/v1/incidents/[id]', () => {
    it('le OWNER lit un incident de son organisation', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const created = await createViaApi(validBody());
      const id = created.payload.data?.incident.id as string;

      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const { response, payload } = await detail(id);

      expect(response.status).toBe(200);
      expect(payload.data?.incident.id).toBe(id);
    });

    it('le locataire lit son propre incident', async () => {
      const tenantContext = await contextOf(harness, lease.tenantUserId);
      mocks.requireAccessContext.mockResolvedValueOnce(tenantContext);
      const created = await createViaApi(validBody());
      const id = created.payload.data?.incident.id as string;

      mocks.requireAccessContext.mockResolvedValueOnce(tenantContext);
      const { response } = await detail(id);

      expect(response.status).toBe(200);
    });

    it('le locataire ne lit pas l incident d un autre', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const created = await createViaApi(validBody({ apartmentId: otherLease.apartmentId }));
      const id = created.payload.data?.incident.id as string;

      const tenantContext = await contextOf(harness, lease.tenantUserId);
      mocks.requireAccessContext.mockResolvedValueOnce(tenantContext);
      const { response } = await detail(id);

      expect(response.status).toBe(404);
    });

    it('une autre organisation ne la lit pas', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const created = await createViaApi(validBody());
      const id = created.payload.data?.incident.id as string;

      mocks.requireAccessContext.mockResolvedValueOnce(otherOwnerContext);
      const { response } = await detail(id);

      expect(response.status).toBe(404);
    });

    it('un incident inexistant répond 404', async () => {
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

  describe('PATCH /api/v1/incidents/[id]', () => {
    it('le OWNER modifie un incident de son organisation', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const created = await createViaApi(validBody());
      const id = created.payload.data?.incident.id as string;

      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const { response, payload } = await patch(id, { title: 'Titre corrige par le proprietaire' });

      expect(response.status).toBe(200);
      expect(payload.data?.incident.id).toBe(id);
    });

    it('le TENANT créateur modifie son incident OPEN', async () => {
      const tenantContext = await contextOf(harness, lease.tenantUserId);
      mocks.requireAccessContext.mockResolvedValueOnce(tenantContext);
      const created = await createViaApi(validBody());
      const id = created.payload.data?.incident.id as string;

      mocks.requireAccessContext.mockResolvedValueOnce(tenantContext);
      const { response } = await patch(id, { title: 'Titre corrige par le locataire' });

      expect(response.status).toBe(200);
    });

    it('le TENANT créateur est refusé une fois l incident ASSIGNED', async () => {
      const tenantContext = await contextOf(harness, lease.tenantUserId);
      mocks.requireAccessContext.mockResolvedValueOnce(tenantContext);
      const created = await createViaApi(validBody());
      const id = created.payload.data?.incident.id as string;

      await assignIncident(harness.db, id, secondManagerUserId, ownerContext);
      await transitionStatus(harness.db, id, 'ASSIGNED', null, ownerContext);

      mocks.requireAccessContext.mockResolvedValueOnce(tenantContext);
      const { response } = await patch(id, { title: 'Nouvelle tentative' });

      expect(response.status).toBe(403);
    });

    it('un incident CLOSED répond 422', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const created = await createViaApi(validBody());
      const id = created.payload.data?.incident.id as string;

      await transitionStatus(harness.db, id, 'CLOSED', null, ownerContext);

      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const { response, payload } = await patch(id, { title: 'Nouvelle tentative' });

      expect(response.status).toBe(422);
      expect(payload.error?.code).toBe('VALIDATION_ERROR');
    });

    it('une autre organisation ne modifie pas l incident', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const created = await createViaApi(validBody());
      const id = created.payload.data?.incident.id as string;

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
});
