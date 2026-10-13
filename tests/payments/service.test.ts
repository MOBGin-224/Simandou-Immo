import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { PermissionDeniedError, ResourceOutOfScopeError } from '../../src/lib/authorization';
import {
  AmountExceedsOutstandingError,
  PaymentDateInFutureError,
} from '../../src/modules/payments';
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
  addProperty,
  addScope,
  contextOf,
  freshPhone,
  NOW,
  passwordHasher,
  RENT_AMOUNT,
} from '../helpers/rents';

const OPTIONS = { now: NOW };

describe('Paiements DEC-056', () => {
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
      ownerContext: owner,
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

  it('déclare un paiement en PENDING sans allocation', async () => {
    const current = await fixture();
    const result = await declarePayment(
      harness.db,
      paymentInput(current.apartmentId, current.tenantId, 100_000),
      owner,
      OPTIONS,
    );

    expect(result.payment.status).toBe('PENDING');
    expect(result.payment.confirmedAt).toBeNull();
    expect(result.payment.createdBy).toBe(SEED_IDS.ownerA);
    expect(result.payment.referenceNumber).toMatch(/^[A-Z]+-\d{4}-\d{4}$/);
    expect(result.allocations).toHaveLength(0);
    expect(result.newBalances).toEqual([]);
  });

  it('autorise un locataire à déclarer son propre paiement', async () => {
    const current = await fixture();
    const tenant = await contextOf(harness, current.tenantId);
    const result = await declarePayment(
      harness.db,
      paymentInput(current.apartmentId, current.tenantId, 100_000),
      tenant,
      OPTIONS,
    );

    expect(result.payment.status).toBe('PENDING');
    expect(result.payment.createdBy).toBe(current.tenantId);
  });

  it('refuse au locataire le droit d’enregistrer un paiement au nom d’un autre', async () => {
    const current = await fixture();
    const tenant = await contextOf(harness, current.tenantId);

    await expect(
      declarePayment(
        harness.db,
        paymentInput(current.apartmentId, SEED_IDS.ownerA, 100_000),
        tenant,
        OPTIONS,
      ),
    ).rejects.toBeInstanceOf(ResourceOutOfScopeError);
  });

  it('validation confirme le paiement et alloue les soldes', async () => {
    const current = await fixture();
    const declared = await declarePayment(
      harness.db,
      paymentInput(current.apartmentId, current.tenantId, 100_000),
      current.ownerContext,
      OPTIONS,
    );

    const validated = await validatePayment(
      harness.db,
      declared.payment.id,
      current.manager,
      OPTIONS,
    );

    expect(validated.payment.status).toBe('CONFIRMED');
    expect(validated.payment.validatedByUserId).toBe(SEED_IDS.managerA);
    expect(validated.payment.confirmedAt).toEqual(NOW);
    expect(validated.allocations.length).toBeGreaterThan(0);
    expect(validated.newBalances.length).toBeGreaterThan(0);
  });

  it('refuse la validation quand le validateur est le déclarant', async () => {
    const current = await fixture();
    const declared = await declarePayment(
      harness.db,
      paymentInput(current.apartmentId, current.tenantId, 100_000),
      current.ownerContext,
      OPTIONS,
    );

    await expect(
      validatePayment(harness.db, declared.payment.id, current.ownerContext, OPTIONS),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it('déclare un paiement contesté en DISPUTED', async () => {
    const current = await fixture();
    const declared = await declarePayment(
      harness.db,
      paymentInput(current.apartmentId, current.tenantId, 100_000),
      current.ownerContext,
      OPTIONS,
    );

    const disputed = await disputePayment(
      harness.db,
      declared.payment.id,
      'WRONG_AMOUNT',
      'NOT_PAID',
      current.manager,
      OPTIONS,
    );

    expect(disputed.status).toBe('DISPUTED');
    expect(disputed.disputedByUserId).toBe(SEED_IDS.managerA);
  });

  it('annule un paiement confirmé en remettant les soldes à zéro', async () => {
    const current = await fixture();
    const declared = await declarePayment(
      harness.db,
      paymentInput(current.apartmentId, current.tenantId, 100_000),
      current.ownerContext,
      OPTIONS,
    );
    const validated = await validatePayment(
      harness.db,
      declared.payment.id,
      current.manager,
      OPTIONS,
    );
    const cancelled = await cancelPayment(
      harness.db,
      validated.payment.id,
      'Erreur de saisie',
      current.ownerContext,
      OPTIONS,
    );

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancellationReason).toBe('Erreur de saisie');
  });

  it('refuse un montant supérieur au solde de l’appartement', async () => {
    const current = await fixture();

    await expect(
      declarePayment(
        harness.db,
        paymentInput(current.apartmentId, current.tenantId, RENT_AMOUNT + 1),
        owner,
        OPTIONS,
      ),
    ).rejects.toBeInstanceOf(AmountExceedsOutstandingError);
  });

  it('refuse une date de paiement future', async () => {
    const current = await fixture();

    await expect(
      declarePayment(
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
      declarePayment(
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
    const result = await declarePayment(
      harness.db,
      { ...paymentInput(current.apartmentId, current.tenantId, 100_000), paidAt: '1990-01-01' },
      owner,
      OPTIONS,
    );

    expect(result.payment.paidAt).toBe('1990-01-01');
  });

  it('accepte la date du jour', async () => {
    const current = await fixture();
    const result = await declarePayment(
      harness.db,
      { ...paymentInput(current.apartmentId, current.tenantId, 100_000), paidAt: '2026-10-02' },
      owner,
      OPTIONS,
    );

    expect(result.payment.paidAt).toBe('2026-10-02');
  });

  describe('Reçus et référence publique DEC-057', () => {
    it('declarePayment produit un paiement avec publicReference non nulle et bien persistée', async () => {
      const current = await fixture();
      const result = await declarePayment(
        harness.db,
        paymentInput(current.apartmentId, current.tenantId, 50_000),
        owner,
        OPTIONS,
      );

      expect(result.payment.publicReference).toBeDefined();
      expect(result.payment.publicReference).toMatch(/^R-[0-9A-Za-z]{10}$/);

      const [stored] = await harness.db
        .select()
        .from(harness.schema.payments)
        .where(eq(harness.schema.payments.id, result.payment.id))
        .limit(1);

      expect(stored?.publicReference).toBe(result.payment.publicReference);
    });

    it('deux declarePayment successifs produisent deux publicReference différentes', async () => {
      const current = await fixture();
      const p1 = await declarePayment(
        harness.db,
        paymentInput(current.apartmentId, current.tenantId, 25_000),
        owner,
        OPTIONS,
      );
      const p2 = await declarePayment(
        harness.db,
        paymentInput(current.apartmentId, current.tenantId, 25_000),
        owner,
        OPTIONS,
      );

      expect(p1.payment.publicReference).not.toBe(p2.payment.publicReference);
    });

    it('insérer une version active dans payment_receipt_versions fonctionne', async () => {
      const current = await fixture();
      const p = await declarePayment(
        harness.db,
        paymentInput(current.apartmentId, current.tenantId, 10_000),
        owner,
        OPTIONS,
      );

      const [inserted] = await harness.db
        .insert(harness.schema.paymentReceiptVersions)
        .values({
          paymentId: p.payment.id,
          version: 1,
          isActive: true,
          generatedByUserId: SEED_IDS.ownerA,
        })
        .returning();

      expect(inserted).toBeDefined();
      expect(inserted!.version).toBe(1);
      expect(inserted!.isActive).toBe(true);
    });

    it('insérer deux versions avec isActive=true pour le même paiement échoue (index unique partiel)', async () => {
      const current = await fixture();
      const p = await declarePayment(
        harness.db,
        paymentInput(current.apartmentId, current.tenantId, 10_000),
        owner,
        OPTIONS,
      );

      await harness.db.insert(harness.schema.paymentReceiptVersions).values({
        paymentId: p.payment.id,
        version: 1,
        isActive: true,
        generatedByUserId: SEED_IDS.ownerA,
      });

      await expect(
        harness.db.insert(harness.schema.paymentReceiptVersions).values({
          paymentId: p.payment.id,
          version: 2,
          isActive: true,
          generatedByUserId: SEED_IDS.ownerA,
        }),
      ).rejects.toThrow();
    });

    it('insérer deux versions avec des numéros différents et au plus une active fonctionne', async () => {
      const current = await fixture();
      const p = await declarePayment(
        harness.db,
        paymentInput(current.apartmentId, current.tenantId, 10_000),
        owner,
        OPTIONS,
      );

      await harness.db.insert(harness.schema.paymentReceiptVersions).values({
        paymentId: p.payment.id,
        version: 1,
        isActive: false,
        generatedByUserId: SEED_IDS.ownerA,
        replacementReason: 'Remplacé par la version 2',
      });

      const [v2] = await harness.db
        .insert(harness.schema.paymentReceiptVersions)
        .values({
          paymentId: p.payment.id,
          version: 2,
          isActive: true,
          generatedByUserId: SEED_IDS.ownerA,
        })
        .returning();

      expect(v2).toBeDefined();
      expect(v2!.version).toBe(2);
      expect(v2!.isActive).toBe(true);
    });
  });
});
