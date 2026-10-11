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

import { SEED_IDS, seed } from '../../../src/db/seed';
import { UnauthenticatedError } from '../../../src/lib/auth/session';
import { GET } from '../../../src/app/api/v1/payments/route';
import { createTestDatabase, type TestDatabase } from '../../helpers/database';
import {
  addApartment,
  addBillableLease,
  addProperty,
  contextOf,
  freshPhone,
  passwordHasher,
} from '../../helpers/rents';

describe('GET /api/v1/payments', () => {
  let harness: TestDatabase;
  let ownerContext: Awaited<ReturnType<typeof contextOf>>;
  let managerContext: Awaited<ReturnType<typeof contextOf>>;
  let tenantContext: Awaited<ReturnType<typeof contextOf>>;
  let tenantId: string;
  let outOfScopePropertyId: string;
  let outOfScopeApartmentId: string;

  async function insertPayment(values: {
    apartmentId: string;
    propertyId: string;
    tenantId: string;
    status: 'PENDING' | 'CONFIRMED' | 'DISPUTED';
    declaredAt: Date;
    referenceNumber: string;
  }) {
    const [payment] = await harness.db
      .insert(harness.schema.payments)
      .values({
        organizationId: SEED_IDS.organizationA,
        propertyId: values.propertyId,
        apartmentId: values.apartmentId,
        tenantId: values.tenantId,
        amount: 100_000,
        currency: 'GNF',
        method: 'CASH',
        status: values.status,
        paidAt: '2026-10-01',
        declaredAt: values.declaredAt,
        createdBy: SEED_IDS.ownerA,
        referenceNumber: values.referenceNumber,
      })
      .returning();

    if (!payment) throw new Error('PAYMENT_FIXTURE_INSERT_RETURNED_NO_ROW');
    return payment;
  }

  async function get(path = '/api/v1/payments') {
    return GET(new Request(`https://immo.test${path}`));
  }

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);
    ownerContext = await contextOf(harness, SEED_IDS.ownerA);
    managerContext = await contextOf(harness, SEED_IDS.managerA);

    const lease = await addBillableLease(harness, {
      apartmentId: SEED_IDS.apartmentA01,
      tenantApartmentId: SEED_IDS.apartmentA01,
      ownerContext,
      hashPassword: passwordHasher(harness),
      phone: freshPhone(),
    });
    tenantId = lease.tenantUserId;
    tenantContext = await contextOf(harness, tenantId);

    outOfScopePropertyId = await addProperty(harness, 'Immeuble hors périmètre', {
      organizationId: SEED_IDS.organizationA,
    });
    outOfScopeApartmentId = await addApartment(harness, outOfScopePropertyId, 'OUT-01', {
      organizationId: SEED_IDS.organizationA,
    });

    for (let index = 0; index < 21; index += 1) {
      await insertPayment({
        apartmentId: SEED_IDS.apartmentA01,
        propertyId: SEED_IDS.propertyA,
        tenantId: index === 0 ? tenantId : SEED_IDS.ownerA,
        status: index === 1 ? 'CONFIRMED' : 'PENDING',
        declaredAt: new Date(Date.UTC(2026, 9, 1, 0, index)),
        referenceNumber: `LIST-A-${index}`,
      });
    }

    await insertPayment({
      apartmentId: SEED_IDS.apartmentA02,
      propertyId: SEED_IDS.propertyA,
      tenantId: SEED_IDS.ownerA,
      status: 'CONFIRMED',
      declaredAt: new Date(Date.UTC(2026, 9, 1, 0, 21)),
      referenceNumber: 'LIST-A-21',
    });
    await insertPayment({
      apartmentId: outOfScopeApartmentId,
      propertyId: outOfScopePropertyId,
      tenantId: SEED_IDS.ownerA,
      status: 'DISPUTED',
      declaredAt: new Date(Date.UTC(2026, 9, 1, 0, 22)),
      referenceNumber: 'LIST-A-22',
    });
  });

  beforeEach(() => {
    mocks.getDb.mockReset().mockReturnValue(harness.db);
    mocks.requireAccessContext.mockReset();
  });

  afterAll(async () => {
    await harness.close();
  });

  it('le propriétaire voit tous les paiements de son organisation', async () => {
    mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

    const response = await get();
    const result = (await response.json()) as {
      data: Array<{ propertyId: string }>;
      meta: { total: number };
    };

    expect(response.status).toBe(200);
    expect(result.meta.total).toBe(23);
    expect(result.data).toHaveLength(20);
    expect(result.data.some((payment) => payment.propertyId === outOfScopePropertyId)).toBe(true);
  });

  it('le gestionnaire ne voit que les immeubles de son périmètre', async () => {
    mocks.requireAccessContext.mockResolvedValueOnce(managerContext);

    const response = await get();
    const result = (await response.json()) as {
      data: Array<{ propertyId: string }>;
      meta: { total: number };
    };

    expect(response.status).toBe(200);
    expect(result.meta.total).toBe(22);
    expect(result.data.every((payment) => payment.propertyId === SEED_IDS.propertyA)).toBe(true);
  });

  it('le locataire ne voit que ses propres paiements', async () => {
    mocks.requireAccessContext.mockResolvedValueOnce(tenantContext);

    const response = await get();
    const result = (await response.json()) as {
      data: Array<{ tenantId: string }>;
      meta: { total: number };
    };

    expect(response.status).toBe(200);
    expect(result.meta.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.tenantId).toBe(tenantId);
  });

  it('filtre par statut PENDING', async () => {
    mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

    const response = await get('/api/v1/payments?status=PENDING');
    const result = (await response.json()) as {
      data: Array<{ status: string }>;
    };

    expect(response.status).toBe(200);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.every((payment) => payment.status === 'PENDING')).toBe(true);
  });

  it('filtre par apartmentId', async () => {
    mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

    const response = await get(`/api/v1/payments?apartmentId=${SEED_IDS.apartmentA02}`);
    const result = (await response.json()) as {
      data: Array<{ apartmentId: string }>;
      meta: { total: number };
    };

    expect(response.status).toBe(200);
    expect(result.meta.total).toBe(1);
    expect(result.data[0]?.apartmentId).toBe(SEED_IDS.apartmentA02);
  });

  it('un locataire filtrant sur un autre tenant obtient une liste vide', async () => {
    mocks.requireAccessContext.mockResolvedValueOnce(tenantContext);

    const response = await get(`/api/v1/payments?tenantId=${SEED_IDS.ownerA}`);
    const result = (await response.json()) as {
      data: unknown[];
      meta: { total: number };
    };

    expect(response.status).toBe(200);
    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(0);
  });

  it('retourne la deuxième page', async () => {
    mocks.requireAccessContext.mockResolvedValueOnce(managerContext);

    const response = await get('/api/v1/payments?page=2');
    const result = (await response.json()) as {
      data: unknown[];
      meta: { total: number; page: number; pageSize: number };
    };

    expect(response.status).toBe(200);
    expect(result.meta).toEqual({ total: 22, page: 2, pageSize: 20 });
    expect(result.data).toHaveLength(2);
  });

  it('répond 401 sans authentification', async () => {
    mocks.requireAccessContext.mockRejectedValueOnce(new UnauthenticatedError());

    const response = await get();
    const result = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(401);
    expect(result.error.code).toBe('UNAUTHORIZED');
  });
});
