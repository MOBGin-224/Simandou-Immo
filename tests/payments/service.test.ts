import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { PermissionDeniedError, ResourceOutOfScopeError } from '../../src/lib/authorization';
import {
  AmountExceedsOutstandingError,
  PaymentDateInFutureError,
} from '../../src/modules/payments';
import { recordPayment } from '../../src/modules/payments/service';
import { generateRents } from '../../src/modules/rents/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  addApartment,
  addBillableLease,
  addProperty,
  addScope,
  contextOf,
  freshPhone,
  NOW,
  passwordHasher,
  RENT_AMOUNT,
} from '../helpers/rents';

const OPTIONS = { now: NOW };

describe('Enregistrement des paiements', () => {
  let harness: TestDatabase;
  let owner: Awaited<ReturnType<typeof contextOf>>;
  let nextFixture = 0;

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);
    owner = await contextOf(harness, SEED_IDS.ownerA);
  });

  afterAll(async () => {
    await harness.close();
  });

  async function fixture() {
    nextFixture += 1;
    const propertyId = await addProperty(harness, `Paiements ${nextFixture}`, {
      organizationId: SEED_IDS.organizationA,
    });
    const apartmentId = await addApartment(harness, propertyId, `A${nextFixture}`, {
      organizationId: SEED_IDS.organizationA,
    });
    await addScope(harness, SEED_IDS.accessManagerA, propertyId);
    const lease = await addBillableLease(harness, {
      apartmentId,
      tenantApartmentId: apartmentId,
      ownerContext: owner,
      hashPassword: passwordHasher(harness),
      phone: freshPhone(),
    });

    await generateRents(harness.db, owner, { propertyId, period: '2026-10' }, OPTIONS);

    return {
      apartmentId,
      tenantId: lease.tenantUserId,
      leaseId: lease.leaseId,
      propertyId,
      manager: await contextOf(harness, SEED_IDS.managerA),
    };
  }

  function paymentInput(apartmentId: string, tenantId: string, amount = RENT_AMOUNT) {
    return {
      apartmentId,
      tenantId,
      amount,
      method: 'CASH' as const,
      paidAt: '2026-10-02',
    };
  }

  it('enregistre un paiement CONFIRMED avec confirmed_at renseigné', async () => {
    const current = await fixture();
    const result = await recordPayment(
      harness.db,
      paymentInput(current.apartmentId, current.tenantId, 100_000),
      owner,
      OPTIONS,
    );

    expect(result.payment.status).toBe('CONFIRMED');
    expect(result.payment.confirmedAt).toEqual(NOW);
    expect(result.payment.paidAt).toBe('2026-10-02');
  });

  it('refuse un appartement inexistant', async () => {
    await expect(
      recordPayment(
        harness.db,
        paymentInput('00000000-0000-4000-8000-000000000001', SEED_IDS.ownerA),
        owner,
        OPTIONS,
      ),
    ).rejects.toBeInstanceOf(ResourceOutOfScopeError);
  });

  it('refuse un appartement d’une autre organisation', async () => {
    const propertyId = await addProperty(harness, 'Paiement autre organisation', {
      organizationId: SEED_IDS.organizationB,
    });
    const apartmentId = await addApartment(harness, propertyId, 'B01', {
      organizationId: SEED_IDS.organizationB,
    });

    await expect(
      recordPayment(harness.db, paymentInput(apartmentId, SEED_IDS.ownerA), owner, OPTIONS),
    ).rejects.toBeInstanceOf(ResourceOutOfScopeError);
  });

  it('autorise un gestionnaire sur un appartement de son périmètre', async () => {
    const current = await fixture();
    const result = await recordPayment(
      harness.db,
      paymentInput(current.apartmentId, current.tenantId, 100_000),
      current.manager,
      OPTIONS,
    );

    expect(result.payment.recordedByUserId).toBe(SEED_IDS.managerA);
  });

  it('refuse au locataire le droit d’enregistrer un paiement', async () => {
    const current = await fixture();
    const tenant = await contextOf(harness, current.tenantId);

    await expect(
      recordPayment(
        harness.db,
        paymentInput(current.apartmentId, current.tenantId, 100_000),
        tenant,
        OPTIONS,
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it('refuse un montant supérieur au solde de l’appartement', async () => {
    const current = await fixture();

    await expect(
      recordPayment(
        harness.db,
        paymentInput(current.apartmentId, current.tenantId, RENT_AMOUNT + 1),
        owner,
        OPTIONS,
      ),
    ).rejects.toBeInstanceOf(AmountExceedsOutstandingError);
  });

  it('accepte un montant égal au solde exact et met à jour la créance', async () => {
    const current = await fixture();
    const result = await recordPayment(
      harness.db,
      paymentInput(current.apartmentId, current.tenantId),
      owner,
      OPTIONS,
    );
    const [installment] = await harness.db
      .select()
      .from(harness.schema.rentInstallments)
      .where(eq(harness.schema.rentInstallments.leaseId, current.leaseId));
    const allocations = await harness.db
      .select()
      .from(harness.schema.paymentAllocations)
      .where(eq(harness.schema.paymentAllocations.paymentId, result.payment.id));

    expect(installment?.balance).toBe(0);
    expect(installment?.status).toBe('PAID');
    expect(result.newBalances).toEqual([
      { receivableId: installment?.id, kind: 'RENT', balance: 0 },
    ]);
    expect(allocations.reduce((sum, allocation) => sum + allocation.amount, 0)).toBe(
      result.payment.amount,
    );
  });

  it('refuse une date de paiement future', async () => {
    const current = await fixture();

    await expect(
      recordPayment(
        harness.db,
        { ...paymentInput(current.apartmentId, current.tenantId), paidAt: '2026-10-03' },
        owner,
        OPTIONS,
      ),
    ).rejects.toBeInstanceOf(PaymentDateInFutureError);
  });

  it('vérifie le solde avant de rejeter une date future', async () => {
    const current = await fixture();

    await expect(
      recordPayment(
        harness.db,
        {
          ...paymentInput(current.apartmentId, current.tenantId, RENT_AMOUNT + 1),
          paidAt: '2026-10-03',
        },
        owner,
        OPTIONS,
      ),
    ).rejects.toBeInstanceOf(AmountExceedsOutstandingError);
  });

  it('accepte une date passée sans limite d’ancienneté', async () => {
    const current = await fixture();
    const result = await recordPayment(
      harness.db,
      { ...paymentInput(current.apartmentId, current.tenantId, 100_000), paidAt: '1990-01-01' },
      owner,
      OPTIONS,
    );

    expect(result.payment.paidAt).toBe('1990-01-01');
  });

  it('accepte la date du jour', async () => {
    const current = await fixture();
    const result = await recordPayment(
      harness.db,
      { ...paymentInput(current.apartmentId, current.tenantId, 100_000), paidAt: '2026-10-02' },
      owner,
      OPTIONS,
    );

    expect(result.payment.paidAt).toBe('2026-10-02');
  });
});
