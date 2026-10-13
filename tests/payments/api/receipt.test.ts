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
import { GET } from '../../../src/app/api/v1/payments/[id]/receipt/route';
import {
  cancelPayment,
  declarePayment,
  disputePayment,
  generatePublicReference,
  validatePayment,
} from '../../../src/modules/payments/service';
import { generateRents } from '../../../src/modules/rents/service';
import { createTestDatabase, type TestDatabase } from '../../helpers/database';
import {
  addApartment,
  addBillableLease,
  contextOf,
  freshPhone,
  NOW,
  passwordHasher,
} from '../../helpers/rents';

describe('GET /api/v1/payments/[id]/receipt', () => {
  let harness: TestDatabase;
  let ownerContext: Awaited<ReturnType<typeof contextOf>>;
  let managerContext: Awaited<ReturnType<typeof contextOf>>;
  let tenantContext: Awaited<ReturnType<typeof contextOf>>;
  let tenantId: string;

  const paymentInput = () => ({
    apartmentId: SEED_IDS.apartmentA01,
    tenantId,
    amount: 100_000,
    method: 'CASH' as const,
    paidAt: NOW.toISOString().slice(0, 10),
  });

  async function declaredByTenant() {
    return declarePayment(harness.db, paymentInput(), tenantContext, { now: NOW });
  }

  async function confirmedPayment() {
    const declared = await declaredByTenant();
    await validatePayment(harness.db, declared.payment.id, managerContext, { now: NOW });
    return declared.payment.id;
  }

  async function cancelledPayment() {
    const paymentId = await confirmedPayment();
    await cancelPayment(harness.db, paymentId, 'Annulation de test', ownerContext, { now: NOW });
    return paymentId;
  }

  async function pendingPayment() {
    const declared = await declaredByTenant();
    return declared.payment.id;
  }

  async function disputedPayment() {
    const declared = await declaredByTenant();
    await disputePayment(
      harness.db,
      declared.payment.id,
      'Le paiement n’a pas été reçu.',
      'NOT_PAID',
      managerContext,
      { now: NOW },
    );
    return declared.payment.id;
  }

  /** Paiement inséré directement, hors du périmètre lisible par le contexte courant. */
  async function insertOutOfScopePayment(values: {
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

    if (!payment) throw new Error('RECEIPT_FIXTURE_INSERT_RETURNED_NO_ROW');
    return payment.id;
  }

  async function get(paymentId: string) {
    return GET(new Request(`https://immo.test/api/v1/payments/${paymentId}/receipt`), {
      params: Promise.resolve({ id: paymentId }),
    });
  }

  function receiptVersionsOf(paymentId: string) {
    return harness.db
      .select()
      .from(harness.schema.paymentReceiptVersions)
      .where(eq(harness.schema.paymentReceiptVersions.paymentId, paymentId));
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
  });

  beforeEach(() => {
    mocks.getDb.mockReset().mockReturnValue(harness.db);
    mocks.requireAccessContext.mockReset();
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('cas nominaux', () => {
    it('le propriétaire télécharge le reçu d’un paiement confirmé de son organisation', async () => {
      const paymentId = await confirmedPayment();
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

      const response = await get(paymentId);
      const body = Buffer.from(await response.arrayBuffer());

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/pdf');
      expect(body.subarray(0, 4).toString('latin1')).toBe('%PDF');
    });

    it('le gestionnaire télécharge un reçu de son périmètre', async () => {
      const paymentId = await confirmedPayment();
      mocks.requireAccessContext.mockResolvedValueOnce(managerContext);

      const response = await get(paymentId);

      expect(response.status).toBe(200);
    });

    it('le locataire télécharge son propre reçu', async () => {
      const paymentId = await confirmedPayment();
      mocks.requireAccessContext.mockResolvedValueOnce(tenantContext);

      const response = await get(paymentId);

      expect(response.status).toBe(200);
    });

    it('le premier téléchargement crée la version 1 du reçu en base', async () => {
      const paymentId = await confirmedPayment();
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

      const response = await get(paymentId);
      const versions = await receiptVersionsOf(paymentId);

      expect(response.status).toBe(200);
      expect(versions).toHaveLength(1);
      expect(versions[0]?.version).toBe(1);
      expect(versions[0]?.isActive).toBe(true);
    });

    it('un deuxième téléchargement ne crée pas de nouvelle version', async () => {
      const paymentId = await confirmedPayment();
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      await get(paymentId);

      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);
      const response = await get(paymentId);
      const versions = await receiptVersionsOf(paymentId);

      expect(response.status).toBe(200);
      expect(versions).toHaveLength(1);
    });
  });

  describe('refus', () => {
    it('refuse un paiement PENDING → 422', async () => {
      const paymentId = await pendingPayment();
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

      const response = await get(paymentId);
      const result = (await response.json()) as { error: { code: string } };

      expect(response.status).toBe(422);
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    it('refuse un paiement DISPUTED → 422', async () => {
      const paymentId = await disputedPayment();
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

      const response = await get(paymentId);
      const result = (await response.json()) as { error: { code: string } };

      expect(response.status).toBe(422);
      expect(result.error.code).toBe('VALIDATION_ERROR');
    });

    it('masque au locataire le reçu d’un autre locataire', async () => {
      const otherTenantPaymentId = await insertOutOfScopePayment({
        organizationId: SEED_IDS.organizationA,
        propertyId: SEED_IDS.propertyA,
        apartmentId: SEED_IDS.apartmentA02,
        tenantId: SEED_IDS.ownerA,
        referenceNumber: 'RECEIPT-OTHER-TENANT',
      });
      mocks.requireAccessContext.mockResolvedValueOnce(tenantContext);

      const response = await get(otherTenantPaymentId);

      expect(response.status).toBe(404);
    });

    it('masque à une autre organisation le reçu d’un paiement', async () => {
      const apartmentBId = await addApartment(harness, SEED_IDS.propertyB, 'B01', {
        organizationId: SEED_IDS.organizationB,
      });
      const otherOrganizationPaymentId = await insertOutOfScopePayment({
        organizationId: SEED_IDS.organizationB,
        propertyId: SEED_IDS.propertyB,
        apartmentId: apartmentBId,
        tenantId: SEED_IDS.ownerB,
        referenceNumber: 'RECEIPT-OTHER-ORG',
      });
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

      const response = await get(otherOrganizationPaymentId);

      expect(response.status).toBe(404);
    });

    it('répond 401 sans authentification', async () => {
      mocks.requireAccessContext.mockRejectedValueOnce(new UnauthenticatedError());

      const response = await get('00000000-0000-4000-8000-000000000001');
      const result = (await response.json()) as { error: { code: string } };

      expect(response.status).toBe(401);
      expect(result.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('reçu annulé', () => {
    it('un paiement CANCELLED donne un reçu PDF → 200', async () => {
      const paymentId = await cancelledPayment();
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

      const response = await get(paymentId);
      const body = Buffer.from(await response.arrayBuffer());

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/pdf');
      expect(body.subarray(0, 4).toString('latin1')).toBe('%PDF');
    });
  });
});
