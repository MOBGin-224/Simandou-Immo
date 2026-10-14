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
import { emitReceipt } from '../../../src/modules/receipts';
import { getTenantOutstanding } from '../../../src/modules/receivables/service';
import { generateRents } from '../../../src/modules/rents/service';
import { createTestDatabase, type TestDatabase } from '../../helpers/database';
import {
  addApartment,
  addBillableLease,
  contextOf,
  freshPhone,
  NOW,
  passwordHasher,
  RENT_AMOUNT,
} from '../../helpers/rents';

/** Après la fenêtre de finalisation d'octobre 2026 (DEC-058, 3.2 : le 6 du mois suivant). */
const AFTER_FINALIZATION = new Date('2026-11-10T00:00:00.000Z');

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
    const outstanding = await getTenantOutstanding(harness.db, ownerContext, tenantId, {
      now: NOW,
    });

    expect(response.status).toBe(200);
    expect(result.data?.status).toBe('CANCELLED');
    expect(allocationsBefore.length).toBeGreaterThan(0);
    expect(allocationsAfter).toHaveLength(allocationsBefore.length);
    expect(
      allocationsAfter.every((allocation) => allocation.paymentId === declared.payment.id),
    ).toBe(true);
    expect(installmentAfter?.balance).toBe(installmentBefore?.amountDue);
    expect(outstanding.totalOutstanding).toBe(RENT_AMOUNT);
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

  it('invalide la quittance active lors de l’annulation d’un paiement CONFIRMED (DEC-058)', async () => {
    const apartmentId = await addApartment(harness, SEED_IDS.propertyA, 'CXL1');
    const lease2 = await addBillableLease(harness, {
      apartmentId,
      tenantApartmentId: apartmentId,
      ownerContext,
      hashPassword: passwordHasher(harness),
      phone: freshPhone(),
      startDate: '2026-01-01',
    });
    const tenant2Context = await contextOf(harness, lease2.tenantUserId);

    await generateRents(
      harness.db,
      ownerContext,
      { propertyId: SEED_IDS.propertyA, period: '2026-10' },
      { now: NOW },
    );

    const declared = await declarePayment(
      harness.db,
      {
        apartmentId: lease2.apartmentId,
        tenantId: lease2.tenantUserId,
        amount: RENT_AMOUNT,
        method: 'CASH',
        paidAt: NOW.toISOString().slice(0, 10),
      },
      tenant2Context,
      { now: NOW },
    );
    await validatePayment(harness.db, declared.payment.id, managerContext, { now: NOW });

    const emitted = await emitReceipt(harness.db, lease2.leaseId, '2026-10-01', {
      now: AFTER_FINALIZATION,
    });

    mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
    const { response } = await post(declared.payment.id);

    expect(response.status).toBe(200);

    const [version] = await harness.db
      .select()
      .from(harness.schema.leaseReceiptVersions)
      .where(eq(harness.schema.leaseReceiptVersions.id, emitted.currentVersion!.id));

    expect(version?.status).toBe('INVALIDEE');
    expect(version?.invalidationReason).toBe('Paiement annulé');
    expect(version?.invalidationTriggerPaymentId).toBe(declared.payment.id);
  });

  it('annule un paiement CONFIRMED sans quittance associée sans erreur', async () => {
    const declared = await declaredBy(tenantContext);
    await validatePayment(harness.db, declared.payment.id, managerContext, { now: NOW });
    mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

    const { response, result } = await post(declared.payment.id);

    expect(response.status).toBe(200);
    expect(result.data?.status).toBe('CANCELLED');
  });
});
