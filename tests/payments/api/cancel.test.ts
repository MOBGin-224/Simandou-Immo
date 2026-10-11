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
import { UnauthenticatedError } from '../../../src/lib/auth/session';
import { POST } from '../../../src/app/api/v1/payments/[id]/cancel/route';
import { declarePayment, validatePayment } from '../../../src/modules/payments/service';
import { generateRents } from '../../../src/modules/rents/service';
import { createTestDatabase, type TestDatabase } from '../../helpers/database';
import { addBillableLease, contextOf, freshPhone, NOW, passwordHasher } from '../../helpers/rents';

describe('POST /api/v1/payments/[id]/cancel', () => {
  let harness: TestDatabase;
  let ownerContext: Awaited<ReturnType<typeof contextOf>>;
  let managerContext: Awaited<ReturnType<typeof contextOf>>;
  let tenantContext: Awaited<ReturnType<typeof contextOf>>;
  let tenantId: string;
  let leaseId: string;

  const paymentInput = () => ({
    apartmentId: SEED_IDS.apartmentA01,
    tenantId,
    amount: 100_000,
    method: 'CASH' as const,
    paidAt: NOW.toISOString().slice(0, 10),
  });

  const cancelBody = { reason: 'Annulation de test' };

  const request = (body: unknown) =>
    new Request('https://immo.test/api/v1/payments/00000000-0000-4000-8000-000000000001/cancel', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  async function declaredBy(context: Awaited<ReturnType<typeof contextOf>>) {
    return declarePayment(harness.db, paymentInput(), context, { now: NOW });
  }

  async function post(paymentId: string, body: unknown = cancelBody) {
    const response = await POST(request(body), { params: Promise.resolve({ id: paymentId }) });
    return {
      response,
      result: (await response.json()) as {
        data?: { status: string };
        error?: { code: string };
      },
    };
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
    leaseId = lease.leaseId;
    tenantContext = await contextOf(harness, tenantId);

    await generateRents(
      harness.db,
      ownerContext,
      { propertyId: SEED_IDS.propertyA, period: '2026-10' },
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

  it('annule un paiement PENDING par propriétaire → 200 + CANCELLED', async () => {
    const declared = await declaredBy(tenantContext);
    mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

    const { response, result } = await post(declared.payment.id);

    expect(response.status).toBe(200);
    expect(result.data?.status).toBe('CANCELLED');
  });

  it('annule un paiement CONFIRMED et restaure les allocations', async () => {
    const declared = await declaredBy(tenantContext);
    await validatePayment(harness.db, declared.payment.id, managerContext, { now: NOW });
    const allocationsBefore = await harness.db
      .select()
      .from(harness.schema.paymentAllocations)
      .where(eq(harness.schema.paymentAllocations.paymentId, declared.payment.id));
    const [installmentBefore] = await harness.db
      .select()
      .from(harness.schema.rentInstallments)
      .where(eq(harness.schema.rentInstallments.leaseId, leaseId));
    mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

    const { response, result } = await post(declared.payment.id);
    const allocationsAfter = await harness.db
      .select()
      .from(harness.schema.paymentAllocations)
      .where(eq(harness.schema.paymentAllocations.paymentId, declared.payment.id));
    const [installmentAfter] = await harness.db
      .select()
      .from(harness.schema.rentInstallments)
      .where(eq(harness.schema.rentInstallments.leaseId, leaseId));

    expect(response.status).toBe(200);
    expect(result.data?.status).toBe('CANCELLED');
    expect(allocationsBefore.length).toBeGreaterThan(0);
    expect(allocationsAfter).toHaveLength(0);
    expect(installmentAfter?.balance).toBe(installmentBefore?.amountDue);
  });

  it('annule un paiement PENDING par gestionnaire dans son périmètre → 200', async () => {
    const declared = await declaredBy(tenantContext);
    mocks.requireAccessContext.mockResolvedValueOnce(managerContext);

    const { response, result } = await post(declared.payment.id);

    expect(response.status).toBe(200);
    expect(result.data?.status).toBe('CANCELLED');
  });

  it('refuse au locataire de tenter une annulation → 403', async () => {
    const declared = await declaredBy(tenantContext);
    mocks.requireAccessContext.mockResolvedValueOnce(tenantContext);

    const { response, result } = await post(declared.payment.id);

    expect(response.status).toBe(403);
    expect(result.error?.code).toBe('FORBIDDEN');
  });

  it('refuse un motif vide → 422', async () => {
    mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

    const { response, result } = await post('00000000-0000-4000-8000-000000000001', {
      reason: '',
    });

    expect(response.status).toBe(422);
    expect(result.error?.code).toBe('VALIDATION_ERROR');
  });

  it('refuse un paiement déjà CANCELLED → 422', async () => {
    const declared = await declaredBy(tenantContext);
    mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
    await post(declared.payment.id);
    mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

    const { response, result } = await post(declared.payment.id);

    expect(response.status).toBe(422);
    expect(result.error?.code).toBe('VALIDATION_ERROR');
  });

  it('répond 404 si le paiement n’existe pas', async () => {
    mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

    const { response, result } = await post('00000000-0000-4000-8000-000000000001');

    expect(response.status).toBe(404);
    expect(result.error?.code).toBe('NOT_FOUND');
  });

  it('répond 401 sans authentification', async () => {
    mocks.requireAccessContext.mockRejectedValueOnce(new UnauthenticatedError());

    const { response, result } = await post('00000000-0000-4000-8000-000000000001');

    expect(response.status).toBe(401);
    expect(result.error?.code).toBe('UNAUTHORIZED');
  });
});
