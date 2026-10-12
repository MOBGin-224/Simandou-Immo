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
import { GET } from '../../../src/app/api/v1/payments/[id]/route';
import { generateRents } from '../../../src/modules/rents/service';
import { generatePublicReference } from '../../../src/modules/payments';
import { createTestDatabase, type TestDatabase } from '../../helpers/database';
import {
  addApartment,
  addBillableLease,
  contextOf,
  freshPhone,
  NOW,
  passwordHasher,
} from '../../helpers/rents';

describe('GET /api/v1/payments/[id]', () => {
  let harness: TestDatabase;
  let ownerContext: Awaited<ReturnType<typeof contextOf>>;
  let managerContext: Awaited<ReturnType<typeof contextOf>>;
  let tenantContext: Awaited<ReturnType<typeof contextOf>>;
  let ownPaymentId: string;
  let otherTenantPaymentId: string;
  let otherOrganizationPaymentId: string;
  let tenantId: string;

  async function insertPayment(values: {
    organizationId: string;
    propertyId: string;
    apartmentId: string;
    tenantId: string;
    referenceNumber: string;
  }) {
    const [payment] = await harness.db
      .insert(harness.schema.payments)
      .values({
        ...values,
        amount: 100_000,
        currency: 'GNF',
        method: 'CASH',
        status: 'CONFIRMED',
        paidAt: '2026-10-01',
        declaredAt: NOW,
        createdBy: SEED_IDS.ownerA,
        publicReference: generatePublicReference(),
      })
      .returning();

    if (!payment) throw new Error('PAYMENT_FIXTURE_INSERT_RETURNED_NO_ROW');
    return payment;
  }

  async function get(paymentId: string) {
    return GET(new Request(`https://immo.test/api/v1/payments/${paymentId}`), {
      params: Promise.resolve({ id: paymentId }),
    });
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

    await generateRents(
      harness.db,
      ownerContext,
      { propertyId: SEED_IDS.propertyA, period: '2026-10' },
      { now: NOW },
    );
    const [installment] = await harness.db
      .select()
      .from(harness.schema.rentInstallments)
      .where(eq(harness.schema.rentInstallments.leaseId, lease.leaseId));
    if (!installment) throw new Error('PAYMENT_DETAIL_FIXTURE_INSTALLMENT_NOT_FOUND');

    const ownPayment = await insertPayment({
      organizationId: SEED_IDS.organizationA,
      propertyId: SEED_IDS.propertyA,
      apartmentId: SEED_IDS.apartmentA01,
      tenantId,
      referenceNumber: 'DETAIL-OWN',
    });
    ownPaymentId = ownPayment.id;
    await harness.db.insert(harness.schema.paymentAllocations).values({
      paymentId: ownPayment.id,
      rentInstallmentId: installment.id,
      chargeAllocationId: null,
      amount: 100_000,
      currency: 'GNF',
    });

    const otherTenantPayment = await insertPayment({
      organizationId: SEED_IDS.organizationA,
      propertyId: SEED_IDS.propertyA,
      apartmentId: SEED_IDS.apartmentA02,
      tenantId: SEED_IDS.ownerA,
      referenceNumber: 'DETAIL-OTHER-TENANT',
    });
    otherTenantPaymentId = otherTenantPayment.id;

    const apartmentBId = await addApartment(harness, SEED_IDS.propertyB, 'B01', {
      organizationId: SEED_IDS.organizationB,
    });
    const otherOrganizationPayment = await insertPayment({
      organizationId: SEED_IDS.organizationB,
      propertyId: SEED_IDS.propertyB,
      apartmentId: apartmentBId,
      tenantId: SEED_IDS.ownerB,
      referenceNumber: 'DETAIL-OTHER-ORG',
    });
    otherOrganizationPaymentId = otherOrganizationPayment.id;
  });

  beforeEach(() => {
    mocks.getDb.mockReset().mockReturnValue(harness.db);
    mocks.requireAccessContext.mockReset();
  });

  afterAll(async () => {
    await harness.close();
  });

  it('le propriétaire lit un paiement de son organisation et ses allocations', async () => {
    mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

    const response = await get(ownPaymentId);
    const result = (await response.json()) as {
      data: {
        payment: { id: string };
        allocations: Array<{ paymentId: string }>;
      };
    };

    expect(response.status).toBe(200);
    expect(result.data.payment.id).toBe(ownPaymentId);
    expect(result.data.allocations).toHaveLength(1);
    expect(result.data.allocations[0]?.paymentId).toBe(ownPaymentId);
  });

  it('le gestionnaire lit un paiement de son périmètre', async () => {
    mocks.requireAccessContext.mockResolvedValueOnce(managerContext);

    const response = await get(ownPaymentId);
    const result = (await response.json()) as { data: { payment: { id: string } } };

    expect(response.status).toBe(200);
    expect(result.data.payment.id).toBe(ownPaymentId);
  });

  it('le locataire lit son propre paiement', async () => {
    mocks.requireAccessContext.mockResolvedValueOnce(tenantContext);

    const response = await get(ownPaymentId);
    const result = (await response.json()) as { data: { payment: { tenantId: string } } };

    expect(response.status).toBe(200);
    expect(result.data.payment.tenantId).toBe(tenantId);
  });

  it('masque au locataire le paiement d’un autre', async () => {
    mocks.requireAccessContext.mockResolvedValueOnce(tenantContext);

    const response = await get(otherTenantPaymentId);

    expect(response.status).toBe(404);
  });

  it('masque au propriétaire le paiement d’une autre organisation', async () => {
    mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

    const response = await get(otherOrganizationPaymentId);

    expect(response.status).toBe(404);
  });

  it('répond 404 pour un paiement inexistant', async () => {
    mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

    const response = await get('00000000-0000-4000-8000-000000000001');

    expect(response.status).toBe(404);
  });

  it('répond 401 sans authentification', async () => {
    mocks.requireAccessContext.mockRejectedValueOnce(new UnauthenticatedError());

    const response = await get(ownPaymentId);
    const result = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(401);
    expect(result.error.code).toBe('UNAUTHORIZED');
  });
});
