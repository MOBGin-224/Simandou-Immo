import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { generateMonthlyReceiptsJob } from '../../src/modules/receipts/service';
import { declarePayment, validatePayment } from '../../src/modules/payments/service';
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
/** Avant cette même fenêtre : le 6 novembre n'est pas encore atteint. */
const BEFORE_FINALIZATION = new Date('2026-11-03T00:00:00.000Z');
/** Longtemps après : la fenêtre reste ouverte, elle ne se referme jamais. */
const LONG_AFTER_FINALIZATION = new Date('2026-11-25T00:00:00.000Z');
const PERIOD = '2026-10-01';

describe('generateMonthlyReceiptsJob (DEC-058, 3.3)', () => {
  let harness: TestDatabase;
  let ownerContext: Awaited<ReturnType<typeof contextOf>>;
  let managerContext: Awaited<ReturnType<typeof contextOf>>;

  let apartmentCounter = 0;

  /** Bail frais sur l'immeuble A, avec l'échéance d'octobre 2026 déjà générée. */
  async function freshLeaseWithOctoberInstallment() {
    apartmentCounter += 1;
    const apartmentId = await addApartment(
      harness,
      SEED_IDS.propertyA,
      `JB${String(apartmentCounter)}`,
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

    return lease;
  }

  /** Bail frais sans aucune échéance générée, sur aucune période. */
  async function freshLeaseWithoutReceivable() {
    apartmentCounter += 1;
    const apartmentId = await addApartment(
      harness,
      SEED_IDS.propertyA,
      `JN${String(apartmentCounter)}`,
    );
    return addBillableLease(harness, {
      apartmentId,
      tenantApartmentId: apartmentId,
      ownerContext,
      hashPassword: passwordHasher(harness),
      phone: freshPhone(),
      startDate: '2026-01-01',
    });
  }

  async function settleWithConfirmedPayment(apartmentId: string, tenantId: string): Promise<void> {
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
  }

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    ownerContext = await contextOf(harness, SEED_IDS.ownerA);
    managerContext = await contextOf(harness, SEED_IDS.managerA);
  });

  afterAll(async () => {
    await harness.close();
  });

  it('émet une quittance pour un bail dont la créance d’octobre est soldée', async () => {
    const lease = await freshLeaseWithOctoberInstallment();
    await settleWithConfirmedPayment(lease.apartmentId, lease.tenantUserId);

    const result = await generateMonthlyReceiptsJob(harness.db, { now: AFTER_FINALIZATION });

    const detail = result.details.find((row) => row.leaseId === lease.leaseId);
    expect(detail?.status).toBe('EMITTED');
    expect(detail?.period).toBe(PERIOD);
    expect(result.emitted).toBeGreaterThanOrEqual(1);

    const rows = await harness.db
      .select()
      .from(harness.schema.leaseReceipts)
      .where(eq(harness.schema.leaseReceipts.leaseId, lease.leaseId));
    expect(rows).toHaveLength(1);
  });

  it('ignore un bail dont la créance d’octobre n’est pas soldée, avec une raison', async () => {
    const lease = await freshLeaseWithOctoberInstallment();

    const result = await generateMonthlyReceiptsJob(harness.db, { now: AFTER_FINALIZATION });

    const detail = result.details.find((row) => row.leaseId === lease.leaseId);
    expect(detail?.status).toBe('SKIPPED');
    expect(detail?.reason).toBeTruthy();
    expect(result.skipped).toBeGreaterThanOrEqual(1);
  });

  it('ne traite pas un bail sans créance sur la période', async () => {
    const lease = await freshLeaseWithoutReceivable();

    const result = await generateMonthlyReceiptsJob(harness.db, { now: AFTER_FINALIZATION });

    expect(result.details.some((row) => row.leaseId === lease.leaseId)).toBe(false);
  });

  it('ne fait rien si l’instant est avant le 6 du mois (fenêtre fermée)', async () => {
    const result = await generateMonthlyReceiptsJob(harness.db, { now: BEFORE_FINALIZATION });

    expect(result.emitted).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.details).toHaveLength(0);
  });

  it('traite la période écoulée même longtemps après le 6 du mois suivant', async () => {
    const lease = await freshLeaseWithOctoberInstallment();
    await settleWithConfirmedPayment(lease.apartmentId, lease.tenantUserId);

    const result = await generateMonthlyReceiptsJob(harness.db, {
      now: LONG_AFTER_FINALIZATION,
    });

    const detail = result.details.find((row) => row.leaseId === lease.leaseId);
    expect(detail?.status).toBe('EMITTED');
    expect(detail?.period).toBe(PERIOD);
  });
});
