import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import {
  findLeaseReceiptById,
  findLeaseReceiptByLeaseAndPeriod,
  insertLeaseReceiptTx,
  invalidateReceiptVersionTx,
  listLeaseReceiptsForContext,
  type InsertLeaseReceiptPayload,
} from '../../src/modules/receipts/repository';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  addApartment,
  addBillableLease,
  addProperty,
  contextOf,
  freshPhone,
  NOW,
  passwordHasher,
} from '../helpers/rents';

type LeaseInfo = { leaseId: string; tenantUserId: string; apartmentId: string };

describe('Repository des quittances (DEC-058)', () => {
  let harness: TestDatabase;
  let ownerContext: Awaited<ReturnType<typeof contextOf>>;
  let managerContext: Awaited<ReturnType<typeof contextOf>>;
  let otherOwnerContext: Awaited<ReturnType<typeof contextOf>>;

  let periodCounter = 0;
  const freshPeriod = () => {
    const year = 2026 + Math.floor(periodCounter / 12);
    const month = (periodCounter % 12) + 1;
    periodCounter += 1;
    return `${year}-${String(month).padStart(2, '0')}-01`;
  };

  let refCounter = 0;
  const freshReferenceNumber = () => {
    refCounter += 1;
    return `RP-2026-${String(refCounter).padStart(4, '0')}`;
  };

  let publicRefCounter = 0;
  const freshPublicReference = () => {
    publicRefCounter += 1;
    return `Q-R${String(publicRefCounter).padStart(8, '0')}`;
  };

  const payloadFor = (
    lease: LeaseInfo,
    values: {
      organizationId: string;
      propertyId: string;
      periodStart?: string;
      totalAttested?: number;
    },
  ): InsertLeaseReceiptPayload => ({
    organizationId: values.organizationId,
    leaseId: lease.leaseId,
    propertyId: values.propertyId,
    apartmentId: lease.apartmentId,
    tenantUserId: lease.tenantUserId,
    periodStart: values.periodStart ?? freshPeriod(),
    referenceNumber: freshReferenceNumber(),
    publicReference: freshPublicReference(),
    totalAttested: values.totalAttested ?? 2_500_000,
    currency: 'GNF',
    emittedAt: NOW,
    emittedByUserId: null,
    frozenContent: { receivables: [] },
  });

  let apartmentCounter = 0;
  async function freshLease(propertyId: string, ownerContextForLease = ownerContext) {
    apartmentCounter += 1;
    const apartmentId = await addApartment(harness, propertyId, `R${String(apartmentCounter)}`);
    return addBillableLease(harness, {
      apartmentId,
      tenantApartmentId: apartmentId,
      ownerContext: ownerContextForLease,
      hashPassword: passwordHasher(harness),
      phone: freshPhone(),
      startDate: '2026-01-01',
    });
  }

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    ownerContext = await contextOf(harness, SEED_IDS.ownerA);
    managerContext = await contextOf(harness, SEED_IDS.managerA);
    otherOwnerContext = await contextOf(harness, SEED_IDS.ownerB);
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('insertLeaseReceiptTx', () => {
    it('crée la receipt et sa version 1 en EMISE', async () => {
      const lease = await freshLease(SEED_IDS.propertyA);
      const { receipt, version } = await insertLeaseReceiptTx(
        harness.db,
        payloadFor(lease, {
          organizationId: SEED_IDS.organizationA,
          propertyId: SEED_IDS.propertyA,
        }),
      );

      expect(receipt.currentVersionId).toBe(version.id);
      expect(version.version).toBe(1);
      expect(version.status).toBe('EMISE');

      const byKey = await findLeaseReceiptByLeaseAndPeriod(
        harness.db,
        lease.leaseId,
        receipt.periodStart,
      );
      expect(byKey?.id).toBe(receipt.id);
    });
  });

  describe('findLeaseReceiptById : périmètre d’accès', () => {
    let receiptId: string;
    let tenantContext: Awaited<ReturnType<typeof contextOf>>;

    beforeAll(async () => {
      const lease = await freshLease(SEED_IDS.propertyA);
      tenantContext = await contextOf(harness, lease.tenantUserId);
      const { receipt } = await insertLeaseReceiptTx(
        harness.db,
        payloadFor(lease, {
          organizationId: SEED_IDS.organizationA,
          propertyId: SEED_IDS.propertyA,
        }),
      );
      receiptId = receipt.id;
    });

    it('le propriétaire lit une quittance de son organisation', async () => {
      const result = await findLeaseReceiptById(harness.db, receiptId, ownerContext);
      expect(result?.receipt.id).toBe(receiptId);
      expect(result?.currentVersion?.status).toBe('EMISE');
    });

    it('le gestionnaire lit une quittance de son périmètre', async () => {
      const result = await findLeaseReceiptById(harness.db, receiptId, managerContext);
      expect(result?.receipt.id).toBe(receiptId);
    });

    it('le locataire lit sa propre quittance', async () => {
      const result = await findLeaseReceiptById(harness.db, receiptId, tenantContext);
      expect(result?.receipt.id).toBe(receiptId);
    });

    it('un autre locataire ne voit pas cette quittance', async () => {
      const otherLease = await freshLease(SEED_IDS.propertyA);
      const otherTenantContext = await contextOf(harness, otherLease.tenantUserId);

      const result = await findLeaseReceiptById(harness.db, receiptId, otherTenantContext);
      expect(result).toBeNull();
    });

    it('une autre organisation ne voit pas cette quittance', async () => {
      const result = await findLeaseReceiptById(harness.db, receiptId, otherOwnerContext);
      expect(result).toBeNull();
    });
  });

  describe('listLeaseReceiptsForContext', () => {
    it('filtre par statut', async () => {
      const lease = await freshLease(SEED_IDS.propertyA);
      const first = await insertLeaseReceiptTx(
        harness.db,
        payloadFor(lease, {
          organizationId: SEED_IDS.organizationA,
          propertyId: SEED_IDS.propertyA,
        }),
      );
      await insertLeaseReceiptTx(
        harness.db,
        payloadFor(lease, {
          organizationId: SEED_IDS.organizationA,
          propertyId: SEED_IDS.propertyA,
        }),
      );
      await invalidateReceiptVersionTx(harness.db, first.version.id, 'paiement annulé', null);

      const emises = await listLeaseReceiptsForContext(harness.db, ownerContext, {
        tenantUserId: lease.tenantUserId,
        status: 'EMISE',
      });
      const invalidees = await listLeaseReceiptsForContext(harness.db, ownerContext, {
        tenantUserId: lease.tenantUserId,
        status: 'INVALIDEE',
      });

      expect(emises.receipts).toHaveLength(1);
      expect(invalidees.receipts).toHaveLength(1);
      expect(invalidees.receipts[0]?.receipt.id).toBe(first.receipt.id);
    });

    it('filtre par immeuble', async () => {
      const otherProperty = await addProperty(harness, 'Résidence Repository Immeuble');
      const leaseOnPropertyA = await freshLease(SEED_IDS.propertyA);
      const leaseOnOtherProperty = await freshLease(otherProperty);

      await insertLeaseReceiptTx(
        harness.db,
        payloadFor(leaseOnPropertyA, {
          organizationId: SEED_IDS.organizationA,
          propertyId: SEED_IDS.propertyA,
        }),
      );
      await insertLeaseReceiptTx(
        harness.db,
        payloadFor(leaseOnOtherProperty, {
          organizationId: SEED_IDS.organizationA,
          propertyId: otherProperty,
        }),
      );

      const result = await listLeaseReceiptsForContext(harness.db, ownerContext, {
        propertyId: otherProperty,
      });

      expect(result.receipts.every((row) => row.receipt.propertyId === otherProperty)).toBe(true);
      expect(
        result.receipts.some((row) => row.receipt.leaseId === leaseOnOtherProperty.leaseId),
      ).toBe(true);
      expect(result.receipts.some((row) => row.receipt.leaseId === leaseOnPropertyA.leaseId)).toBe(
        false,
      );
    });

    it('filtre par locataire', async () => {
      const lease = await freshLease(SEED_IDS.propertyA);
      await insertLeaseReceiptTx(
        harness.db,
        payloadFor(lease, {
          organizationId: SEED_IDS.organizationA,
          propertyId: SEED_IDS.propertyA,
        }),
      );

      const result = await listLeaseReceiptsForContext(harness.db, ownerContext, {
        tenantUserId: lease.tenantUserId,
      });

      expect(result.receipts).toHaveLength(1);
      expect(result.receipts[0]?.receipt.tenantUserId).toBe(lease.tenantUserId);
    });

    it('pagine correctement', async () => {
      const lease = await freshLease(SEED_IDS.propertyA);

      for (let i = 0; i < 25; i++) {
        await insertLeaseReceiptTx(
          harness.db,
          payloadFor(lease, {
            organizationId: SEED_IDS.organizationA,
            propertyId: SEED_IDS.propertyA,
          }),
        );
      }

      const pageOne = await listLeaseReceiptsForContext(harness.db, ownerContext, {
        tenantUserId: lease.tenantUserId,
        page: 1,
      });
      const pageTwo = await listLeaseReceiptsForContext(harness.db, ownerContext, {
        tenantUserId: lease.tenantUserId,
        page: 2,
      });

      expect(pageOne.meta.total).toBe(25);
      expect(pageOne.receipts).toHaveLength(20);
      expect(pageTwo.receipts).toHaveLength(5);
    });
  });

  describe('invalidateReceiptVersionTx', () => {
    it('passe la version en INVALIDEE avec motif et date', async () => {
      const lease = await freshLease(SEED_IDS.propertyA);
      const { version } = await insertLeaseReceiptTx(
        harness.db,
        payloadFor(lease, {
          organizationId: SEED_IDS.organizationA,
          propertyId: SEED_IDS.propertyA,
        }),
      );

      const invalidated = await invalidateReceiptVersionTx(
        harness.db,
        version.id,
        'paiement annulé',
        null,
      );

      expect(invalidated.status).toBe('INVALIDEE');
      expect(invalidated.invalidationReason).toBe('paiement annulé');
      expect(invalidated.invalidatedAt).not.toBeNull();
    });
  });
});
