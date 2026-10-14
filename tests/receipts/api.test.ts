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
import { GET as GET_LIST } from '../../src/app/api/v1/receipts/route';
import { GET as GET_DETAIL } from '../../src/app/api/v1/receipts/[id]/route';
import { GET as GET_PDF } from '../../src/app/api/v1/receipts/[id]/pdf/route';
import { GET as GET_VERIFY } from '../../src/app/api/v1/public/verify/[publicReference]/route';
import { declarePayment, validatePayment } from '../../src/modules/payments/service';
import { emitReceipt, generateReceiptPublicReference } from '../../src/modules/receipts';
import { generateRents } from '../../src/modules/rents/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  addApartment,
  addBillableLease,
  addProperty,
  contextOf,
  freshPhone,
  NOW,
  passwordHasher,
  RENT_AMOUNT,
} from '../helpers/rents';

/** Après la fenêtre de finalisation d'octobre 2026 (DEC-058, 3.2 : le 6 du mois suivant). */
const AFTER_FINALIZATION = new Date('2026-11-10T00:00:00.000Z');
const PERIOD = '2026-10-01';

describe('API des quittances (DEC-058)', () => {
  let harness: TestDatabase;
  let ownerContext: Awaited<ReturnType<typeof contextOf>>;
  let managerContext: Awaited<ReturnType<typeof contextOf>>;
  let otherOwnerContext: Awaited<ReturnType<typeof contextOf>>;

  let tenantContext: Awaited<ReturnType<typeof contextOf>>;
  let receiptId: string;
  let publicReference: string;

  let otherTenantReceiptId: string;

  let otherOrgReceiptId: string;

  let apartmentCounter = 0;

  async function freshSettledLease() {
    apartmentCounter += 1;
    const apartmentId = await addApartment(
      harness,
      SEED_IDS.propertyA,
      `AP${String(apartmentCounter)}`,
    );
    const lease = await addBillableLease(harness, {
      apartmentId,
      tenantApartmentId: apartmentId,
      ownerContext,
      hashPassword: passwordHasher(harness),
      phone: freshPhone(),
      startDate: '2026-01-01',
    });

    await generateRents(
      harness.db,
      ownerContext,
      { propertyId: SEED_IDS.propertyA, period: '2026-10' },
      { now: NOW },
    );

    const tenant = await contextOf(harness, lease.tenantUserId);
    const declared = await declarePayment(
      harness.db,
      {
        apartmentId: lease.apartmentId,
        tenantId: lease.tenantUserId,
        amount: RENT_AMOUNT,
        method: 'CASH',
        paidAt: '2026-10-02',
      },
      tenant,
      { now: NOW },
    );
    await validatePayment(harness.db, declared.payment.id, managerContext, { now: NOW });

    const emitted = await emitReceipt(harness.db, lease.leaseId, PERIOD, {
      now: AFTER_FINALIZATION,
    });

    return { lease, tenant, emitted };
  }

  function requestFor(url: string) {
    return new Request(url);
  }

  async function list(query: string = '') {
    const response = await GET_LIST(requestFor(`https://immo.test/api/v1/receipts${query}`));
    return {
      response,
      body: (await response.json()) as {
        data?: unknown[];
        meta?: { total: number };
        error?: { code: string };
      },
    };
  }

  async function detail(id: string) {
    const response = await GET_DETAIL(requestFor(`https://immo.test/api/v1/receipts/${id}`), {
      params: Promise.resolve({ id }),
    });
    return {
      response,
      body: (await response.json()) as {
        data?: { receipt: { id: string } };
        error?: { code: string };
      },
    };
  }

  async function pdf(id: string) {
    const response = await GET_PDF(requestFor(`https://immo.test/api/v1/receipts/${id}/pdf`), {
      params: Promise.resolve({ id }),
    });
    return response;
  }

  async function verify(ref: string) {
    const response = await GET_VERIFY(requestFor(`https://immo.test/api/v1/public/verify/${ref}`), {
      params: Promise.resolve({ publicReference: ref }),
    });
    return {
      response,
      body: (await response.json()) as {
        recognized: boolean;
        kind?: string;
        data?: Record<string, unknown>;
      },
    };
  }

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    ownerContext = await contextOf(harness, SEED_IDS.ownerA);
    managerContext = await contextOf(harness, SEED_IDS.managerA);
    otherOwnerContext = await contextOf(harness, SEED_IDS.ownerB);

    const own = await freshSettledLease();
    tenantContext = own.tenant;
    receiptId = own.emitted.receipt.id;
    publicReference = own.emitted.receipt.publicReference;

    const other = await freshSettledLease();
    otherTenantReceiptId = other.emitted.receipt.id;

    const otherOrgProperty = await addProperty(harness, 'Résidence API quittances B', {
      organizationId: SEED_IDS.organizationB,
    });
    const otherOrgApartmentId = await addApartment(harness, otherOrgProperty, 'OB1', {
      organizationId: SEED_IDS.organizationB,
    });
    const otherOrgLease = await addBillableLease(harness, {
      apartmentId: otherOrgApartmentId,
      tenantApartmentId: otherOrgApartmentId,
      ownerContext: otherOwnerContext,
      hashPassword: passwordHasher(harness),
      phone: freshPhone(),
      startDate: '2026-01-01',
    });
    const [otherOrgReceipt] = await harness.db
      .insert(harness.schema.leaseReceipts)
      .values({
        organizationId: SEED_IDS.organizationB,
        leaseId: otherOrgLease.leaseId,
        propertyId: otherOrgProperty,
        apartmentId: otherOrgApartmentId,
        tenantUserId: otherOrgLease.tenantUserId,
        periodStart: PERIOD,
        referenceNumber: 'OB-2026-10-0001',
        publicReference: generateReceiptPublicReference(),
        totalAttested: 1_000_000,
        currency: 'GNF',
      })
      .returning();
    if (!otherOrgReceipt) throw new Error('OTHER_ORG_RECEIPT_FIXTURE_NOT_CREATED');
    otherOrgReceiptId = otherOrgReceipt.id;
  });

  beforeEach(() => {
    mocks.getDb.mockReset().mockReturnValue(harness.db);
    mocks.requireAccessContext.mockReset();
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('GET /api/v1/receipts', () => {
    it('le propriétaire voit ses quittances', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

      const { response, body } = await list();

      expect(response.status).toBe(200);
      expect(
        body.data?.some((row) => (row as { receipt: { id: string } }).receipt.id === receiptId),
      ).toBe(true);
    });

    it('le gestionnaire voit celles de son périmètre', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(managerContext);

      const { response, body } = await list();

      expect(response.status).toBe(200);
      expect(
        body.data?.some((row) => (row as { receipt: { id: string } }).receipt.id === receiptId),
      ).toBe(true);
    });

    it('le locataire ne voit que les siennes', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(tenantContext);

      const { response, body } = await list();

      expect(response.status).toBe(200);
      const rows = (body.data ?? []) as Array<{ receipt: { tenantUserId: string } }>;
      expect(rows.every((row) => row.receipt.tenantUserId === tenantContext.userId)).toBe(true);
    });

    it('répond 401 sans authentification', async () => {
      mocks.requireAccessContext.mockRejectedValueOnce(new UnauthenticatedError());

      const { response, body } = await list();

      expect(response.status).toBe(401);
      expect(body.error?.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/v1/receipts/[id]', () => {
    it('le propriétaire lit une quittance de son organisation', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

      const { response, body } = await detail(receiptId);

      expect(response.status).toBe(200);
      expect(body.data?.receipt.id).toBe(receiptId);
    });

    it('le locataire lit sa propre quittance', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(tenantContext);

      const { response, body } = await detail(receiptId);

      expect(response.status).toBe(200);
      expect(body.data?.receipt.id).toBe(receiptId);
    });

    it('le locataire ne lit pas celle d’un autre', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(tenantContext);

      const { response } = await detail(otherTenantReceiptId);

      expect(response.status).toBe(404);
    });

    it('une autre organisation ne la lit pas', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(otherOwnerContext);

      const { response } = await detail(receiptId);

      expect(response.status).toBe(404);
    });

    it('répond 401 sans authentification', async () => {
      mocks.requireAccessContext.mockRejectedValueOnce(new UnauthenticatedError());

      const { response } = await detail(receiptId);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/receipts/[id]/pdf', () => {
    it('le propriétaire télécharge le PDF', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

      const response = await pdf(receiptId);
      const body = Buffer.from(await response.arrayBuffer());

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/pdf');
      expect(body.subarray(0, 4).toString('latin1')).toBe('%PDF');
    });

    it('le locataire télécharge sa propre quittance', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(tenantContext);

      const response = await pdf(receiptId);

      expect(response.status).toBe(200);
    });

    it('un tiers reçoit 404', async () => {
      mocks.requireAccessContext.mockResolvedValueOnce(otherOwnerContext);

      const response = await pdf(receiptId);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/v1/public/verify/[ref] avec une référence Q-', () => {
    it('reconnaît une référence valide et expose les données de quittance', async () => {
      const { response, body } = await verify(publicReference);

      expect(response.status).toBe(200);
      expect(body.recognized).toBe(true);
      expect(body.kind).toBe('receipt');
      expect(body.data).toMatchObject({ status: 'EMISE', referenceNumber: expect.any(String) });
    });

    it('ne reconnaît pas un format invalide', async () => {
      const { response, body } = await verify('Q-tropcourt');

      expect(response.status).toBe(200);
      expect(body.recognized).toBe(false);
    });

    it('ne reconnaît pas une référence inexistante au bon format', async () => {
      const { response, body } = await verify('Q-0000000000');

      expect(response.status).toBe(200);
      expect(body.recognized).toBe(false);
    });
  });

  it('la quittance d’une autre organisation reste inaccessible au détail', async () => {
    mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

    const { response } = await detail(otherOrgReceiptId);

    expect(response.status).toBe(404);
  });
});
