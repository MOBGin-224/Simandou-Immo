import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

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
import { POST as cancelRoute } from '../../../src/app/api/v1/payments/[id]/cancel/route';
import { POST as disputeRoute } from '../../../src/app/api/v1/payments/[id]/dispute/route';
import { GET as detailRoute } from '../../../src/app/api/v1/payments/[id]/route';
import { POST as validateRoute } from '../../../src/app/api/v1/payments/[id]/validate/route';
import { GET as listRoute } from '../../../src/app/api/v1/payments/route';
import { POST as declareRoute } from '../../../src/app/api/v1/payments/manual/route';
import { generateRents } from '../../../src/modules/rents/service';
import { createTestDatabase, type TestDatabase } from '../../helpers/database';
import {
  addBillableLease,
  contextOf,
  freshPhone,
  NOW,
  passwordHasher,
  RENT_AMOUNT,
} from '../../helpers/rents';

const PAYMENT_AMOUNT = 100_000;

describe('workflow HTTP complet DEC-056', () => {
  let harness: TestDatabase;
  let ownerContext: Awaited<ReturnType<typeof contextOf>>;
  let managerContext: Awaited<ReturnType<typeof contextOf>>;
  let tenantContext: Awaited<ReturnType<typeof contextOf>>;
  let otherOrganizationContext: Awaited<ReturnType<typeof contextOf>>;
  let tenantId: string;
  let leaseId: string;

  const paidAt = NOW.toISOString().slice(0, 10);

  function paymentInput() {
    return {
      apartmentId: SEED_IDS.apartmentA01,
      tenantId,
      amount: PAYMENT_AMOUNT,
      method: 'CASH',
      paidAt,
    };
  }

  function request(path: string, body?: unknown) {
    return new Request(`https://immo.test${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      ...(body === undefined
        ? {}
        : {
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          }),
    });
  }

  async function declare(context: Awaited<ReturnType<typeof contextOf>> = tenantContext) {
    mocks.requireAccessContext.mockResolvedValueOnce(context);
    const response = await declareRoute(request('/api/v1/payments/manual', paymentInput()));
    return {
      response,
      result: (await response.json()) as {
        data?: { id: string; status: string };
        error?: { code: string };
      },
    };
  }

  async function list(context: Awaited<ReturnType<typeof contextOf>>, query = '') {
    mocks.requireAccessContext.mockResolvedValueOnce(context);
    const response = await listRoute(request(`/api/v1/payments${query ? `?${query}` : ''}`));
    return {
      response,
      result: (await response.json()) as {
        data?: Array<{ id: string; status: string }>;
        meta?: { total: number };
        error?: { code: string };
      },
    };
  }

  async function detail(paymentId: string, context: Awaited<ReturnType<typeof contextOf>>) {
    mocks.requireAccessContext.mockResolvedValueOnce(context);
    const response = await detailRoute(request(`/api/v1/payments/${paymentId}`), {
      params: Promise.resolve({ id: paymentId }),
    });
    return {
      response,
      result: (await response.json()) as {
        data?: {
          payment: { id: string; status: string };
          allocations: Array<{ paymentId: string; amount: number }>;
        };
        error?: { code: string };
      },
    };
  }

  async function validate(paymentId: string, context: Awaited<ReturnType<typeof contextOf>>) {
    mocks.requireAccessContext.mockResolvedValueOnce(context);
    const response = await validateRoute(request(`/api/v1/payments/${paymentId}/validate`), {
      params: Promise.resolve({ id: paymentId }),
    });
    return {
      response,
      result: (await response.json()) as {
        data?: { id: string; status: string };
        error?: { code: string };
      },
    };
  }

  async function dispute(paymentId: string) {
    mocks.requireAccessContext.mockResolvedValueOnce(managerContext);
    const response = await disputeRoute(
      request(`/api/v1/payments/${paymentId}/dispute`, {
        reason: 'NOT_PAID',
        category: 'NOT_PAID',
      }),
      { params: Promise.resolve({ id: paymentId }) },
    );
    return {
      response,
      result: (await response.json()) as {
        data?: { id: string; status: string };
        error?: { code: string };
      },
    };
  }

  async function cancel(paymentId: string, context: Awaited<ReturnType<typeof contextOf>>) {
    mocks.requireAccessContext.mockResolvedValueOnce(context);
    const response = await cancelRoute(
      request(`/api/v1/payments/${paymentId}/cancel`, { reason: 'Annulation de test' }),
      { params: Promise.resolve({ id: paymentId }) },
    );
    return {
      response,
      result: (await response.json()) as {
        data?: { id: string; status: string };
        error?: { code: string };
      },
    };
  }

  async function rentBalance() {
    const [installment] = await harness.db
      .select({ balance: harness.schema.rentInstallments.balance })
      .from(harness.schema.rentInstallments)
      .where(eq(harness.schema.rentInstallments.leaseId, leaseId));
    if (!installment) throw new Error('PAYMENT_WORKFLOW_RENT_INSTALLMENT_NOT_FOUND');
    return installment.balance;
  }

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);
    ownerContext = await contextOf(harness, SEED_IDS.ownerA);
    managerContext = await contextOf(harness, SEED_IDS.managerA);
    otherOrganizationContext = await contextOf(harness, SEED_IDS.ownerB);

    const lease = await addBillableLease(harness, {
      apartmentId: SEED_IDS.apartmentA01,
      tenantApartmentId: SEED_IDS.apartmentA01,
      ownerContext,
      hashPassword: passwordHasher(harness),
      phone: freshPhone(),
    });
    tenantId = lease.tenantUserId;
    leaseId = lease.leaseId;
    tenantContext = await contextOf(harness, tenantId);

    await generateRents(
      harness.db,
      ownerContext,
      { propertyId: SEED_IDS.propertyA, period: paidAt.slice(0, 7) },
      { now: NOW },
    );
  });

  beforeEach(() => {
    mocks.getDb.mockReset().mockReturnValue(harness.db);
    mocks.requireAccessContext.mockReset();
  });

  afterAll(async () => {
    await harness.close();
  });

  it('workflow nominal: locataire déclare, gestionnaire valide, locataire consulte', async () => {
    const initialBalance = await rentBalance();
    expect(initialBalance).toBe(RENT_AMOUNT);

    const declaration = await declare();
    expect(declaration.response.status).toBe(201);
    expect(declaration.result.data?.status).toBe('PENDING');
    const paymentId = declaration.result.data?.id;
    expect(paymentId).toBeDefined();
    if (!paymentId) throw new Error('PAYMENT_WORKFLOW_DECLARATION_MISSING_ID');

    const tenantList = await list(tenantContext);
    expect(tenantList.response.status).toBe(200);
    expect(tenantList.result.meta?.total).toBe(1);
    expect(tenantList.result.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: paymentId, status: 'PENDING' })]),
    );

    const managerDetail = await detail(paymentId, managerContext);
    expect(managerDetail.response.status).toBe(200);
    expect(managerDetail.result.data?.payment.id).toBe(paymentId);

    const validation = await validate(paymentId, managerContext);
    expect(validation.response.status).toBe(200);
    expect(validation.result.data?.status).toBe('CONFIRMED');
    expect(await rentBalance()).toBe(initialBalance - PAYMENT_AMOUNT);

    const tenantDetail = await detail(paymentId, tenantContext);
    expect(tenantDetail.response.status).toBe(200);
    expect(tenantDetail.result.data?.payment.status).toBe('CONFIRMED');
    expect(tenantDetail.result.data?.allocations.length).toBeGreaterThan(0);
  });

  it('contestation : le paiement reste non alloué et les créances inchangées', async () => {
    const balanceBefore = await rentBalance();
    const declaration = await declare();
    const paymentId = declaration.result.data?.id;
    expect(paymentId).toBeDefined();
    if (!paymentId) throw new Error('PAYMENT_WORKFLOW_DECLARATION_MISSING_ID');

    const contestation = await dispute(paymentId);

    expect(contestation.response.status).toBe(200);
    expect(contestation.result.data?.status).toBe('DISPUTED');
    expect(await rentBalance()).toBe(balanceBefore);
  });

  it('annulation d’un paiement confirmé : restaure les créances et conserve les allocations', async () => {
    const initialBalance = await rentBalance();
    const declaration = await declare();
    const paymentId = declaration.result.data?.id;
    expect(paymentId).toBeDefined();
    if (!paymentId) throw new Error('PAYMENT_WORKFLOW_DECLARATION_MISSING_ID');

    const validation = await validate(paymentId, managerContext);
    expect(validation.response.status).toBe(200);
    expect(validation.result.data?.status).toBe('CONFIRMED');
    expect(await rentBalance()).toBe(initialBalance - PAYMENT_AMOUNT);

    const allocationsBefore = await harness.db
      .select()
      .from(harness.schema.paymentAllocations)
      .where(eq(harness.schema.paymentAllocations.paymentId, paymentId));
    expect(allocationsBefore.length).toBeGreaterThan(0);

    const cancellation = await cancel(paymentId, ownerContext);
    expect(cancellation.response.status).toBe(200);
    expect(cancellation.result.data?.status).toBe('CANCELLED');
    expect(await rentBalance()).toBe(initialBalance);

    const allocationsAfter = await harness.db
      .select()
      .from(harness.schema.paymentAllocations)
      .where(eq(harness.schema.paymentAllocations.paymentId, paymentId));
    expect(allocationsAfter).toHaveLength(allocationsBefore.length);
    expect(allocationsAfter.every((allocation) => allocation.paymentId === paymentId)).toBe(true);
  });

  it('refuse les validations propres, les lectures hors organisation et annulations locataire', async () => {
    const tenantDeclared = await declare();
    const tenantPaymentId = tenantDeclared.result.data?.id;
    expect(tenantPaymentId).toBeDefined();
    if (!tenantPaymentId) throw new Error('PAYMENT_WORKFLOW_DECLARATION_MISSING_ID');

    const tenantSelfValidation = await validate(tenantPaymentId, tenantContext);
    expect(tenantSelfValidation.response.status).toBe(403);

    const managerDeclared = await declare(managerContext);
    const managerPaymentId = managerDeclared.result.data?.id;
    expect(managerDeclared.response.status).toBe(201);
    expect(managerPaymentId).toBeDefined();
    if (!managerPaymentId) throw new Error('PAYMENT_WORKFLOW_DECLARATION_MISSING_ID');

    const managerSelfValidation = await validate(managerPaymentId, managerContext);
    expect(managerSelfValidation.response.status).toBe(403);

    const otherOrganizationRead = await detail(tenantPaymentId, otherOrganizationContext);
    expect(otherOrganizationRead.response.status).toBe(404);

    const tenantCancellation = await cancel(tenantPaymentId, tenantContext);
    expect(tenantCancellation.response.status).toBe(403);
  });
});
