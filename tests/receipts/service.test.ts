import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import {
  checkEligibility,
  emitReceipt,
  getLeaseReceiptById,
  invalidateReceiptForPayment,
  listLeaseReceipts,
} from '../../src/modules/receipts/service';
import { ReceiptNotEligibleError } from '../../src/modules/receipts/errors';
import { ResourceOutOfScopeError } from '../../src/lib/authorization';
import {
  cancelPayment,
  declarePayment,
  disputePayment,
  validatePayment,
} from '../../src/modules/payments/service';
import { generateRents } from '../../src/modules/rents/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  addApartment,
  addBillableLease,
  contextOf,
  freshPhone,
  NOW,
  passwordHasher,
  RENT_AMOUNT,
} from '../helpers/rents';

/** Après la fenêtre de finalisation d'octobre 2026 (DEC-058, 3.2 : le 6 du mois suivant). */
const AFTER_FINALIZATION = new Date('2026-11-10T00:00:00.000Z');
const PERIOD = '2026-10-01';

describe('Service des quittances (DEC-058)', () => {
  let harness: TestDatabase;
  let ownerContext: Awaited<ReturnType<typeof contextOf>>;
  let managerContext: Awaited<ReturnType<typeof contextOf>>;
  let otherOwnerContext: Awaited<ReturnType<typeof contextOf>>;

  let apartmentCounter = 0;

  /** Bail frais sur l'immeuble A, avec l'échéance d'octobre 2026 déjà générée. */
  async function freshLeaseWithInstallment() {
    apartmentCounter += 1;
    const apartmentId = await addApartment(
      harness,
      SEED_IDS.propertyA,
      `SV${String(apartmentCounter)}`,
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

    const [installment] = await harness.db
      .select()
      .from(harness.schema.rentInstallments)
      .where(eq(harness.schema.rentInstallments.leaseId, lease.leaseId));
    if (!installment) throw new Error('Échéance de test introuvable.');

    return { lease, installment };
  }

  async function settleWithConfirmedPayment(
    leaseId: string,
    apartmentId: string,
    tenantId: string,
  ) {
    const tenantContext = await contextOf(harness, tenantId);
    const declared = await declarePayment(
      harness.db,
      {
        apartmentId,
        tenantId,
        amount: RENT_AMOUNT,
        method: 'CASH',
        paidAt: '2026-10-02',
      },
      tenantContext,
      { now: NOW },
    );
    await validatePayment(harness.db, declared.payment.id, managerContext, { now: NOW });
    return declared.payment.id;
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

  describe('checkEligibility', () => {
    it('bail sans créance sur la période → non éligible', async () => {
      const { lease } = await freshLeaseWithInstallment();

      const result = await checkEligibility(harness.db, lease.leaseId, '2026-01-01', {
        now: AFTER_FINALIZATION,
      });

      expect(result.eligible).toBe(false);
    });

    it('bail avec créance non soldée → non éligible', async () => {
      const { lease } = await freshLeaseWithInstallment();

      const result = await checkEligibility(harness.db, lease.leaseId, PERIOD, {
        now: AFTER_FINALIZATION,
      });

      expect(result.eligible).toBe(false);
    });

    it('bail soldé par un paiement CONFIRMED → éligible', async () => {
      const { lease } = await freshLeaseWithInstallment();
      await settleWithConfirmedPayment(lease.leaseId, lease.apartmentId, lease.tenantUserId);

      const result = await checkEligibility(harness.db, lease.leaseId, PERIOD, {
        now: AFTER_FINALIZATION,
      });

      expect(result.eligible).toBe(true);
      expect(result.receivables).toHaveLength(1);
      expect(result.receivables[0]?.amountDue).toBe(RENT_AMOUNT);
      expect(result.receivables[0]?.totalAlloue).toBe(RENT_AMOUNT);
    });

    it('créance soldée par un paiement devenu DISPUTED → non éligible', async () => {
      const { lease } = await freshLeaseWithInstallment();
      const tenantContext = await contextOf(harness, lease.tenantUserId);
      const declared = await declarePayment(
        harness.db,
        {
          apartmentId: lease.apartmentId,
          tenantId: lease.tenantUserId,
          amount: RENT_AMOUNT,
          method: 'CASH',
          paidAt: '2026-10-02',
        },
        tenantContext,
        { now: NOW },
      );
      await disputePayment(
        harness.db,
        declared.payment.id,
        'Je n’ai pas reçu ce paiement',
        'NOT_PAID',
        managerContext,
        { now: NOW },
      );

      const result = await checkEligibility(harness.db, lease.leaseId, PERIOD, {
        now: AFTER_FINALIZATION,
      });

      expect(result.eligible).toBe(false);
    });

    it('créance soldée puis libérée par un paiement CANCELLED → non éligible', async () => {
      const { lease } = await freshLeaseWithInstallment();
      const paymentId = await settleWithConfirmedPayment(
        lease.leaseId,
        lease.apartmentId,
        lease.tenantUserId,
      );
      await cancelPayment(harness.db, paymentId, 'Erreur de saisie', ownerContext, { now: NOW });

      const result = await checkEligibility(harness.db, lease.leaseId, PERIOD, {
        now: AFTER_FINALIZATION,
      });

      expect(result.eligible).toBe(false);
    });
  });

  describe('emitReceipt', () => {
    it('émet une quittance : version 1 EMISE, totalAttested correct', async () => {
      const { lease } = await freshLeaseWithInstallment();
      await settleWithConfirmedPayment(lease.leaseId, lease.apartmentId, lease.tenantUserId);

      const result = await emitReceipt(harness.db, lease.leaseId, PERIOD, {
        now: AFTER_FINALIZATION,
      });

      expect(result.receipt.totalAttested).toBe(RENT_AMOUNT);
      expect(result.currentVersion?.version).toBe(1);
      expect(result.currentVersion?.status).toBe('EMISE');
      expect(result.currentVersion?.emittedByUserId).toBeNull();
    });

    it('une deuxième émission sur la même période retourne l’existante, sans doublon', async () => {
      const { lease } = await freshLeaseWithInstallment();
      await settleWithConfirmedPayment(lease.leaseId, lease.apartmentId, lease.tenantUserId);

      const first = await emitReceipt(harness.db, lease.leaseId, PERIOD, {
        now: AFTER_FINALIZATION,
      });
      const second = await emitReceipt(harness.db, lease.leaseId, PERIOD, {
        now: AFTER_FINALIZATION,
      });

      expect(second.receipt.id).toBe(first.receipt.id);

      const rows = await harness.db
        .select()
        .from(harness.schema.leaseReceipts)
        .where(eq(harness.schema.leaseReceipts.leaseId, lease.leaseId));
      expect(rows).toHaveLength(1);
    });

    it('refuse l’émission pour un bail non éligible', async () => {
      const { lease } = await freshLeaseWithInstallment();

      await expect(
        emitReceipt(harness.db, lease.leaseId, PERIOD, { now: AFTER_FINALIZATION }),
      ).rejects.toThrow(ReceiptNotEligibleError);
    });
  });

  describe('invalidateReceiptForPayment', () => {
    it('invalide la version dont le paiement rattaché passe en CANCELLED', async () => {
      const { lease } = await freshLeaseWithInstallment();
      const paymentId = await settleWithConfirmedPayment(
        lease.leaseId,
        lease.apartmentId,
        lease.tenantUserId,
      );
      const emitted = await emitReceipt(harness.db, lease.leaseId, PERIOD, {
        now: AFTER_FINALIZATION,
      });

      const count = await invalidateReceiptForPayment(harness.db, paymentId, 'paiement annulé');

      expect(count).toBe(1);

      const [version] = await harness.db
        .select()
        .from(harness.schema.leaseReceiptVersions)
        .where(eq(harness.schema.leaseReceiptVersions.id, emitted.currentVersion!.id));
      expect(version?.status).toBe('INVALIDEE');
      expect(version?.invalidationReason).toBe('paiement annulé');
      expect(version?.invalidationTriggerPaymentId).toBe(paymentId);
    });

    it('n’invalide rien pour un paiement non rattaché', async () => {
      const { lease } = await freshLeaseWithInstallment();
      await settleWithConfirmedPayment(lease.leaseId, lease.apartmentId, lease.tenantUserId);
      await emitReceipt(harness.db, lease.leaseId, PERIOD, { now: AFTER_FINALIZATION });

      const count = await invalidateReceiptForPayment(
        harness.db,
        '00000000-0000-4000-8000-000000000099',
        'sans lien',
      );

      expect(count).toBe(0);
    });
  });

  describe('getLeaseReceiptById et listLeaseReceipts : périmètre', () => {
    it('respectent le périmètre comme le repository', async () => {
      const { lease } = await freshLeaseWithInstallment();
      await settleWithConfirmedPayment(lease.leaseId, lease.apartmentId, lease.tenantUserId);
      const emitted = await emitReceipt(harness.db, lease.leaseId, PERIOD, {
        now: AFTER_FINALIZATION,
      });

      await expect(
        getLeaseReceiptById(harness.db, emitted.receipt.id, ownerContext),
      ).resolves.toMatchObject({ receipt: { id: emitted.receipt.id } });

      await expect(
        getLeaseReceiptById(harness.db, emitted.receipt.id, otherOwnerContext),
      ).rejects.toThrow(ResourceOutOfScopeError);

      const list = await listLeaseReceipts(harness.db, ownerContext, {
        tenantUserId: lease.tenantUserId,
      });
      expect(list.receipts).toHaveLength(1);
      expect(list.receipts[0]?.receipt.id).toBe(emitted.receipt.id);
    });
  });
});
