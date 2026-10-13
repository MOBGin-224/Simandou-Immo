import { randomInt } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import {
  chargeAllocations,
  paymentAllocations,
  paymentSequences,
  payments,
  properties,
  rentInstallments,
  type Payment,
} from '@/db/schema';
import {
  PermissionDeniedError,
  ResourceOutOfScopeError,
  requirePermission,
  type AccessContext,
} from '@/lib/authorization';
import { openChargeReceivablesForTenant } from '@/modules/charges';
import { openRentReceivablesForTenant } from '@/modules/rents';
import {
  computeReceivableStatusAfterPayment,
  type OutstandingReceivable,
} from '@/modules/receivables/domain';
import { today } from '@/modules/receivables';
import type { ReceivablesDatabase } from '@/modules/receivables/service';

import { allocatePayment, type PaymentAllocationPlan } from './domain';
import {
  AmountExceedsOutstandingError,
  PaymentDateInFutureError,
  PaymentValidationError,
  ReceiptNotAvailableError,
} from './errors';
import {
  findActiveLeaseForPayment,
  findApartmentForPayment,
  findOrCreateActiveReceiptVersion,
  findPaymentByPublicReference,
  findPaymentWithAllocations,
  findPaymentWithNamesForReceipt,
  insertPaymentTx,
  listPaymentsForContext,
} from './repository';
import { generateReceiptPdf } from './receipt';
import {
  listPaymentsQuerySchema,
  recordPaymentSchema,
  type ListPaymentsQuery,
  type RecordPaymentInput,
} from './schemas';

export type PaymentNewBalance = {
  receivableId: string;
  kind: PaymentAllocationPlan['kind'];
  balance: number;
};

export type RecordPaymentResult = {
  payment: Payment;
  allocations: PaymentAllocationPlan[];
  newBalances: PaymentNewBalance[];
};

export type PublicVerificationData = {
  isRecognized: true;
  paymentStatus: 'PENDING' | 'CONFIRMED' | 'DISPUTED' | 'CANCELLED';
  documentStatus: 'actif' | 'remplacé' | 'invalidé';
  amount: number;
  currency: string;
  paidAt: string;
  validatedAt: string | null;
  version: number;
  verifiedAt: string;
};

export type PaymentServiceOptions = {
  now?: Date;
};

export async function getPublicVerification(
  db: ReceivablesDatabase,
  publicReference: string,
): Promise<PublicVerificationData | null> {
  const result = await findPaymentByPublicReference(db, publicReference);
  if (!result?.activeReceiptVersion) return null;

  const { payment, activeReceiptVersion } = result;
  if (payment.status === 'FAILED') return null;

  const documentStatus =
    payment.status === 'CANCELLED'
      ? 'invalidé'
      : activeReceiptVersion.isActive
        ? 'actif'
        : 'remplacé';

  return {
    isRecognized: true,
    paymentStatus: payment.status,
    documentStatus,
    amount: Number(payment.amount),
    currency: payment.currency,
    paidAt: payment.paidAt,
    validatedAt: payment.validatedAt?.toISOString() ?? null,
    version: activeReceiptVersion.version,
    verifiedAt: new Date().toISOString(),
  };
}

export async function listPayments(
  db: ReceivablesDatabase,
  context: AccessContext,
  input: unknown = {},
) {
  const result = listPaymentsQuerySchema.safeParse(input);

  if (!result.success) {
    throw new PaymentValidationError(
      z.flattenError(result.error).fieldErrors as Record<string, string[]>,
    );
  }

  const query: ListPaymentsQuery = result.data;

  return listPaymentsForContext(db, context, {
    page: query.page,
    status: query.status,
    apartmentId: query.apartmentId,
    tenantId: query.tenantId,
  });
}

export async function getPaymentById(
  db: ReceivablesDatabase,
  paymentId: string,
  context: AccessContext,
) {
  if (!z.uuid().safeParse(paymentId).success) throw new ResourceOutOfScopeError();

  const result = await findPaymentWithAllocations(db, paymentId, context);
  if (!result) throw new ResourceOutOfScopeError();

  return result;
}

type OpenPaymentReceivable = OutstandingReceivable & {
  createdAt: string;
  currency: string;
};

function parseOrThrow(input: unknown): RecordPaymentInput {
  const result = recordPaymentSchema.safeParse(input);
  if (!result.success) {
    throw new PaymentValidationError(
      z.flattenError(result.error).fieldErrors as Record<string, string[]>,
    );
  }
  return result.data;
}

function assertValidatorForPayment(
  payment: Pick<Payment, 'tenantId' | 'createdBy'>,
  context: AccessContext,
  organizationId: string,
  propertyId: string,
): void {
  if (context.userId === payment.createdBy) {
    throw new PermissionDeniedError('payment.create');
  }

  const isTenantValidator =
    context.userId === payment.tenantId &&
    context.memberships.some(
      (membership) => membership.organizationId === organizationId && membership.role === 'TENANT',
    );

  if (isTenantValidator) return;

  requirePermission(context, 'payment.create', {
    organizationId,
    propertyId,
    ownerUserId: payment.tenantId,
  });
}

async function openPaymentReceivables(
  db: ReceivablesDatabase,
  apartmentId: string,
  tenantId: string,
): Promise<OpenPaymentReceivable[]> {
  const [rentRows, chargeRows] = await Promise.all([
    openRentReceivablesForTenant(db, tenantId),
    openChargeReceivablesForTenant(db, tenantId),
  ]);

  return [
    ...rentRows
      .filter((row) => row.apartment.id === apartmentId && row.tenant.userId === tenantId)
      .map((row) => ({
        kind: 'RENT' as const,
        id: row.id,
        label: '',
        periodStart: row.periodStart,
        dueDate: row.dueDate,
        amountDue: row.amountDue,
        amountPaid: row.amountPaid,
        balance: row.balance,
        status: row.status,
        createdAt: row.createdAt,
        currency: row.currency,
      })),
    ...chargeRows
      .filter((row) => row.apartment.id === apartmentId && row.tenant?.userId === tenantId)
      .map((row) => ({
        kind: 'CHARGE' as const,
        id: row.id,
        label: '',
        periodStart: row.periodStart,
        dueDate: row.dueDate,
        amountDue: row.amountDue,
        amountPaid: row.amountPaid,
        balance: row.balance,
        status: row.status,
        createdAt: row.createdAt,
        currency: row.currency,
      })),
  ].filter((receivable) => receivable.balance > 0);
}

async function generatePaymentReference(
  db: ReceivablesDatabase,
  organizationId: string,
  propertyId: string,
  year: number,
): Promise<string> {
  return db.transaction(async (tx) => {
    const [property] = await tx
      .select({ code: properties.code })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);

    if (!property) throw new ResourceOutOfScopeError();

    const [existing] = await tx
      .select({ id: paymentSequences.id, lastValue: paymentSequences.lastValue })
      .from(paymentSequences)
      .where(
        and(
          eq(paymentSequences.organizationId, organizationId),
          eq(paymentSequences.propertyId, propertyId),
          eq(paymentSequences.year, year),
        ),
      )
      .for('update')
      .limit(1);

    if (existing) {
      const nextValue = existing.lastValue + 1;
      await tx
        .update(paymentSequences)
        .set({ lastValue: nextValue, updatedAt: new Date() })
        .where(eq(paymentSequences.id, existing.id));
      return `${property.code}-${String(year)}-${String(nextValue).padStart(4, '0')}`;
    }

    try {
      const [inserted] = await tx
        .insert(paymentSequences)
        .values({
          organizationId,
          propertyId,
          year,
          lastValue: 1,
        })
        .returning({ lastValue: paymentSequences.lastValue });

      return `${property.code}-${String(year)}-${String(inserted?.lastValue ?? 1).padStart(4, '0')}`;
    } catch (error) {
      const maybeUniqueViolation =
        typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';

      if (!maybeUniqueViolation) throw error;

      const [reloaded] = await tx
        .select({ id: paymentSequences.id, lastValue: paymentSequences.lastValue })
        .from(paymentSequences)
        .where(
          and(
            eq(paymentSequences.organizationId, organizationId),
            eq(paymentSequences.propertyId, propertyId),
            eq(paymentSequences.year, year),
          ),
        )
        .for('update')
        .limit(1);

      if (!reloaded) throw new Error('PAYMENT_SEQUENCE_NOT_FOUND');

      const nextValue = reloaded.lastValue + 1;
      await tx
        .update(paymentSequences)
        .set({ lastValue: nextValue, updatedAt: new Date() })
        .where(eq(paymentSequences.id, reloaded.id));

      return `${property.code}-${String(year)}-${String(nextValue).padStart(4, '0')}`;
    }
  });
}

async function applyAllocationToReceivable(
  tx: Parameters<ReceivablesDatabase['transaction']>[0] extends (arg: infer T) => unknown
    ? T
    : never,
  paymentId: string,
  paymentCurrency: string,
  allocation: PaymentAllocationPlan,
  now: Date,
): Promise<PaymentNewBalance> {
  const target =
    allocation.kind === 'RENT'
      ? {
          table: rentInstallments,
          idColumn: rentInstallments.id,
          select: () =>
            tx
              .select({
                status: rentInstallments.status,
                amountDue: rentInstallments.amountDue,
                balance: rentInstallments.balance,
              })
              .from(rentInstallments)
              .where(eq(rentInstallments.id, allocation.receivableId))
              .for('update')
              .limit(1),
        }
      : {
          table: chargeAllocations,
          idColumn: chargeAllocations.id,
          select: () =>
            tx
              .select({
                status: chargeAllocations.status,
                amountDue: chargeAllocations.amountDue,
                balance: chargeAllocations.balance,
              })
              .from(chargeAllocations)
              .where(eq(chargeAllocations.id, allocation.receivableId))
              .for('update')
              .limit(1),
        };

  const [current] = await target.select();
  if (!current) throw new ResourceOutOfScopeError();
  if (current.balance < allocation.amount) throw new AmountExceedsOutstandingError();

  const nextBalance = current.balance - allocation.amount;
  const nextAmountPaid = current.amountDue - nextBalance;
  const nextStatus = computeReceivableStatusAfterPayment(current.status, nextBalance);

  await tx.insert(paymentAllocations).values({
    paymentId,
    rentInstallmentId: allocation.kind === 'RENT' ? allocation.receivableId : null,
    chargeAllocationId: allocation.kind === 'CHARGE' ? allocation.receivableId : null,
    amount: allocation.amount,
    currency: paymentCurrency,
    createdAt: now,
  });

  await tx
    .update(target.table)
    .set({
      balance: nextBalance,
      amountPaid: nextAmountPaid,
      status: nextStatus,
      updatedAt: now,
    })
    .where(eq(target.idColumn, allocation.receivableId));

  return {
    receivableId: allocation.receivableId,
    kind: allocation.kind,
    balance: nextBalance,
  };
}

const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Génère une référence publique pour la vérification par un tiers (DEC-057, point 3.4).
 * Format : "R-" suivi de 10 caractères alphanumériques base62 (longueur totale 12).
 * Non séquentielle et imprévisible.
 */
export function generatePublicReference(): string {
  let result = 'R-';
  for (let i = 0; i < 10; i++) {
    result += BASE62_CHARS[randomInt(0, BASE62_CHARS.length)];
  }
  return result;
}

export async function declarePayment(
  db: ReceivablesDatabase,
  input: RecordPaymentInput,
  context: AccessContext,
  options: PaymentServiceOptions = {},
): Promise<RecordPaymentResult> {
  const data = parseOrThrow(input);
  const todayDate = today(options);

  const apartment = await findApartmentForPayment(db, data.apartmentId);
  if (!apartment) throw new ResourceOutOfScopeError();

  const tenantIsDeclarant = context.userId === data.tenantId;
  if (tenantIsDeclarant) {
    if (!(await findActiveLeaseForPayment(db, apartment.id, data.tenantId))) {
      throw new ResourceOutOfScopeError();
    }
  } else {
    requirePermission(context, 'payment.create', {
      organizationId: apartment.organizationId,
      propertyId: apartment.propertyId,
      ownerUserId: data.tenantId,
    });
  }

  const openReceivables = await openPaymentReceivables(db, apartment.id, data.tenantId);
  const totalOutstanding = openReceivables.reduce((sum, row) => sum + row.balance, 0);
  if (data.amount > totalOutstanding) {
    throw new AmountExceedsOutstandingError();
  }

  if (data.paidAt > todayDate) {
    throw new PaymentDateInFutureError();
  }

  const now = options.now ?? new Date();
  const referenceNumber = await generatePaymentReference(
    db,
    apartment.organizationId,
    apartment.propertyId,
    new Date(data.paidAt).getFullYear(),
  );

  let inserted: Awaited<ReturnType<typeof insertPaymentTx>> | null = null;
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const publicReference = generatePublicReference();
    try {
      inserted = await insertPaymentTx(db, {
        organizationId: apartment.organizationId,
        propertyId: apartment.propertyId,
        apartmentId: apartment.id,
        tenantId: data.tenantId,
        amount: data.amount,
        currency: openReceivables[0]?.currency ?? 'GNF',
        method: data.method,
        reference: data.reference,
        paidAt: data.paidAt,
        status: 'PENDING',
        declaredAt: now,
        confirmedAt: null,
        createdBy: context.userId,
        validatedByUserId: null,
        validatedAt: null,
        disputedByUserId: null,
        disputedAt: null,
        cancelledAt: null,
        cancellationReason: null,
        referenceNumber,
        publicReference,
        allocations: [],
      });
      break;
    } catch (error) {
      const isUniqueViolation =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === '23505';

      if (isUniqueViolation && attempt < maxAttempts - 1) {
        continue;
      }
      throw error;
    }
  }

  if (!inserted) {
    throw new Error('FAILED_TO_GENERATE_UNIQUE_PUBLIC_REFERENCE');
  }

  return {
    payment: inserted.payment,
    allocations: [],
    newBalances: inserted.newBalances,
  };
}

export async function validatePayment(
  db: ReceivablesDatabase,
  paymentId: string,
  context: AccessContext,
  options: PaymentServiceOptions = {},
): Promise<{
  payment: Payment;
  allocations: PaymentAllocationPlan[];
  newBalances: PaymentNewBalance[];
}> {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment) throw new ResourceOutOfScopeError();
  if (payment.status !== 'PENDING') {
    throw new PaymentValidationError({
      status: ['Le paiement doit être en attente de validation.'],
    });
  }

  const apartment = await findApartmentForPayment(db, payment.apartmentId);
  if (!apartment) throw new ResourceOutOfScopeError();

  assertValidatorForPayment(payment, context, apartment.organizationId, apartment.propertyId);

  const openReceivables = await openPaymentReceivables(db, apartment.id, payment.tenantId);
  const allocations = allocatePayment(Number(payment.amount), openReceivables);
  const now = options.now ?? new Date();

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(payments)
      .set({
        status: 'CONFIRMED',
        validatedByUserId: context.userId,
        validatedAt: now,
        confirmedAt: now,
        updatedAt: now,
      })
      .where(eq(payments.id, payment.id))
      .returning();

    if (!row) throw new Error('PAYMENT_VALIDATION_RETURNED_NO_ROW');

    const newBalances: PaymentNewBalance[] = [];
    for (const allocation of allocations) {
      newBalances.push(
        await applyAllocationToReceivable(tx, row.id, row.currency, allocation, now),
      );
    }

    return { payment: row, newBalances } as const;
  });

  return {
    payment: updated.payment,
    allocations,
    newBalances: updated.newBalances,
  };
}

export async function disputePayment(
  db: ReceivablesDatabase,
  paymentId: string,
  reason: string,
  category: string,
  context: AccessContext,
  options: PaymentServiceOptions = {},
): Promise<Payment> {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment) throw new ResourceOutOfScopeError();
  if (payment.status !== 'PENDING') {
    throw new PaymentValidationError({
      status: ['Le paiement doit être en attente de validation.'],
    });
  }

  const apartment = await findApartmentForPayment(db, payment.apartmentId);
  if (!apartment) throw new ResourceOutOfScopeError();

  assertValidatorForPayment(payment, context, apartment.organizationId, apartment.propertyId);

  const now = options.now ?? new Date();
  const [updated] = await db
    .update(payments)
    .set({
      status: 'DISPUTED',
      disputedByUserId: context.userId,
      disputedAt: now,
      disputeReason: reason,
      disputeCategory: category,
      updatedAt: now,
    })
    .where(eq(payments.id, payment.id))
    .returning();

  if (!updated) throw new Error('PAYMENT_DISPUTE_RETURNED_NO_ROW');
  return updated;
}

export async function cancelPayment(
  db: ReceivablesDatabase,
  paymentId: string,
  reason: string,
  context: AccessContext,
  options: PaymentServiceOptions = {},
): Promise<Payment> {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment) throw new ResourceOutOfScopeError();
  if (!['PENDING', 'CONFIRMED', 'DISPUTED'].includes(payment.status)) {
    throw new PaymentValidationError({
      status: ['Le paiement ne peut pas être annulé dans ce statut.'],
    });
  }

  requirePermission(context, 'payment.cancel', {
    organizationId: payment.organizationId,
    propertyId: payment.propertyId,
  });

  const now = options.now ?? new Date();

  if (payment.status === 'CONFIRMED') {
    return db.transaction(async (tx) => {
      const allocations = await tx
        .select()
        .from(paymentAllocations)
        .where(eq(paymentAllocations.paymentId, payment.id));

      for (const allocation of allocations) {
        if (allocation.rentInstallmentId) {
          const [receivable] = await tx
            .select({
              amountDue: rentInstallments.amountDue,
              balance: rentInstallments.balance,
              status: rentInstallments.status,
            })
            .from(rentInstallments)
            .where(eq(rentInstallments.id, allocation.rentInstallmentId))
            .for('update')
            .limit(1);

          if (receivable) {
            const nextBalance = receivable.balance + Number(allocation.amount);
            const nextAmountPaid = receivable.amountDue - nextBalance;
            const nextStatus = computeReceivableStatusAfterPayment(receivable.status, nextBalance);
            await tx
              .update(rentInstallments)
              .set({
                balance: nextBalance,
                amountPaid: nextAmountPaid,
                status: nextStatus,
                updatedAt: now,
              })
              .where(eq(rentInstallments.id, allocation.rentInstallmentId));
          }
        }

        if (allocation.chargeAllocationId) {
          const [receivable] = await tx
            .select({
              amountDue: chargeAllocations.amountDue,
              balance: chargeAllocations.balance,
              status: chargeAllocations.status,
            })
            .from(chargeAllocations)
            .where(eq(chargeAllocations.id, allocation.chargeAllocationId))
            .for('update')
            .limit(1);

          if (receivable) {
            const nextBalance = receivable.balance + Number(allocation.amount);
            const nextAmountPaid = receivable.amountDue - nextBalance;
            const nextStatus = computeReceivableStatusAfterPayment(receivable.status, nextBalance);
            await tx
              .update(chargeAllocations)
              .set({
                balance: nextBalance,
                amountPaid: nextAmountPaid,
                status: nextStatus,
                updatedAt: now,
              })
              .where(eq(chargeAllocations.id, allocation.chargeAllocationId));
          }
        }
      }

      const [updated] = await tx
        .update(payments)
        .set({
          status: 'CANCELLED',
          cancelledAt: now,
          cancellationReason: reason,
          updatedAt: now,
        })
        .where(eq(payments.id, payment.id))
        .returning();

      if (!updated) throw new Error('PAYMENT_CANCEL_RETURNED_NO_ROW');
      return updated;
    });
  }

  const [updated] = await db
    .update(payments)
    .set({
      status: 'CANCELLED',
      cancelledAt: now,
      cancellationReason: reason,
      updatedAt: now,
    })
    .where(eq(payments.id, payment.id))
    .returning();

  if (!updated) throw new Error('PAYMENT_CANCEL_RETURNED_NO_ROW');
  return updated;
}

/**
 * Génère le PDF de reçu d'un paiement (DEC-057).
 *
 * Seul un paiement CONFIRMED ou CANCELLED a un reçu (1.1, 1.2, 1.3). Une
 * réimpression réutilise la version active déjà enregistrée plutôt que d'en
 * créer une nouvelle (4.1) : c'est `findOrCreateActiveReceiptVersion` qui
 * porte cette règle.
 */
export async function getPaymentReceiptPdf(
  db: ReceivablesDatabase,
  paymentId: string,
  context: AccessContext,
  appUrl: string,
  options: PaymentServiceOptions = {},
): Promise<{ pdf: Uint8Array; payment: Payment }> {
  const result = await findPaymentWithNamesForReceipt(db, paymentId, context);
  if (!result) throw new ResourceOutOfScopeError();

  const { payment } = result;
  if (payment.status !== 'CONFIRMED' && payment.status !== 'CANCELLED') {
    throw new ReceiptNotAvailableError();
  }

  const version = await findOrCreateActiveReceiptVersion(db, payment.id, context.userId);
  const now = options.now ?? new Date();

  const pdf = await generateReceiptPdf({
    referenceNumber: payment.referenceNumber,
    publicReference: payment.publicReference,
    version: version.version,
    status: payment.status,
    amount: Number(payment.amount),
    currency: payment.currency,
    method: payment.method,
    reference: payment.reference ?? null,
    paidAt: payment.paidAt,
    declaredAt: payment.declaredAt.toISOString(),
    declaredBy: result.declaredByName ?? 'Non renseigné',
    validatedAt: payment.validatedAt ? payment.validatedAt.toISOString() : null,
    validatedBy: result.validatedByName,
    tenantName: result.tenantName,
    apartmentName: result.apartmentName,
    propertyName: result.propertyName,
    organizationName: result.organizationName,
    allocations: result.allocations.map((allocation) => ({
      kind: allocation.rentInstallmentId ? ('RENT' as const) : ('CHARGE' as const),
      amount: Number(allocation.amount),
      receivableId: (allocation.rentInstallmentId ?? allocation.chargeAllocationId) as string,
    })),
    appUrl,
    generatedAt: now.toISOString(),
  });

  return { pdf, payment };
}
