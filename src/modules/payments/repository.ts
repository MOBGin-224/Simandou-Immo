import { and, count, desc, eq, or } from 'drizzle-orm';
import type { ReceivablesDatabase } from '@/modules/receivables/service';
import {
  apartments,
  leases,
  payments,
  paymentAllocations,
  rentInstallments,
  chargeAllocations,
  properties,
  type Payment,
} from '@/db/schema';
import {
  propertyScopeCondition,
  readablePropertyScopes,
  type AccessContext,
} from '@/lib/authorization';
import type { PaymentMethod } from './constants';
import { computeReceivableStatusAfterPayment } from '@/modules/receivables/domain';
import type { ReceivableStatus } from '@/modules/receivables/constants';
import { AmountExceedsOutstandingError } from './errors';

export type PaymentAllocationInsert = {
  receivableId: string;
  kind: 'RENT' | 'CHARGE';
  amount: number;
};

/** État d'une créance avant paiement, nécessaire pour recalculer son statut. */
export type ReceivableState = {
  status: ReceivableStatus;
  balance: number;
  amountDue: number;
};

export type PaymentBalanceUpdate = {
  receivableId: string;
  kind: PaymentAllocationInsert['kind'];
  balance: number;
};

/** Transaction Drizzle : le type qu'on reçoit à l'intérieur de `db.transaction`. */
type Transaction = Parameters<Parameters<ReceivablesDatabase['transaction']>[0]>[0];

export type RecordPaymentPayload = {
  organizationId: string;
  propertyId: string;
  apartmentId: string;
  tenantId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  reference?: string;
  paidAt: string;
  status: 'PENDING' | 'CONFIRMED' | 'DISPUTED' | 'CANCELLED';
  declaredAt?: Date | null;
  confirmedAt?: Date | null;
  createdBy: string;
  validatedByUserId?: string | null;
  validatedAt?: Date | null;
  disputedByUserId?: string | null;
  disputedAt?: Date | null;
  cancelledAt?: Date | null;
  cancellationReason?: string | null;
  referenceNumber: string;
  publicReference: string;
  allocations: PaymentAllocationInsert[];
};

export type PaymentApartmentRow = {
  id: string;
  organizationId: string;
  propertyId: string;
};

export type PaymentListFilters = {
  page: number;
  status?: 'PENDING' | 'CONFIRMED' | 'DISPUTED' | 'CANCELLED';
  apartmentId?: string;
  tenantId?: string;
};

export type PaymentListResult = {
  payments: Payment[];
  meta: { total: number; page: number; pageSize: number };
};

type PaymentAllocation = typeof paymentAllocations.$inferSelect;

const PAYMENT_LIST_PAGE_SIZE = 20;

function paymentVisibilityCondition(context: AccessContext) {
  const scopes = readablePropertyScopes(context, 'payment.read');
  const propertyCondition = propertyScopeCondition(scopes, {
    organizationId: payments.organizationId,
    propertyId: payments.propertyId,
  });
  const tenantCondition = or(
    ...context.memberships
      .filter((membership) => membership.role === 'TENANT')
      .map((membership) =>
        and(
          eq(payments.organizationId, membership.organizationId),
          eq(payments.tenantId, context.userId),
        ),
      ),
  );
  return or(propertyCondition, tenantCondition);
}

export async function listPaymentsForContext(
  db: ReceivablesDatabase,
  context: AccessContext,
  filters: PaymentListFilters,
): Promise<PaymentListResult> {
  const visibilityCondition = paymentVisibilityCondition(context);

  if (!visibilityCondition) {
    return {
      payments: [],
      meta: { total: 0, page: filters.page, pageSize: PAYMENT_LIST_PAGE_SIZE },
    };
  }

  const where = and(
    visibilityCondition,
    filters.status ? eq(payments.status, filters.status) : undefined,
    filters.apartmentId ? eq(payments.apartmentId, filters.apartmentId) : undefined,
    filters.tenantId ? eq(payments.tenantId, filters.tenantId) : undefined,
  );
  const offset = (filters.page - 1) * PAYMENT_LIST_PAGE_SIZE;

  const [rows, [totalRow]] = await Promise.all([
    db
      .select()
      .from(payments)
      .where(where)
      .orderBy(desc(payments.declaredAt), desc(payments.createdAt), desc(payments.id))
      .limit(PAYMENT_LIST_PAGE_SIZE)
      .offset(offset),
    db.select({ total: count() }).from(payments).where(where),
  ]);

  return {
    payments: rows,
    meta: { total: totalRow?.total ?? 0, page: filters.page, pageSize: PAYMENT_LIST_PAGE_SIZE },
  };
}

export async function findPaymentWithAllocations(
  db: ReceivablesDatabase,
  paymentId: string,
  context: AccessContext,
): Promise<{ payment: Payment; allocations: PaymentAllocation[] } | null> {
  const visibilityCondition = paymentVisibilityCondition(context);
  if (!visibilityCondition) return null;

  const rows = await db
    .select({ payment: payments, allocation: paymentAllocations })
    .from(payments)
    .leftJoin(paymentAllocations, eq(paymentAllocations.paymentId, payments.id))
    .where(and(eq(payments.id, paymentId), visibilityCondition));

  if (rows.length === 0) return null;

  const payment = rows[0]?.payment;
  if (!payment) return null;

  return {
    payment,
    allocations: rows.flatMap((row) => (row.allocation ? [row.allocation] : [])),
  };
}

export async function findApartmentForPayment(
  db: ReceivablesDatabase,
  apartmentId: string,
): Promise<PaymentApartmentRow | undefined> {
  const [row] = await db
    .select({
      id: apartments.id,
      organizationId: apartments.organizationId,
      propertyId: apartments.propertyId,
    })
    .from(apartments)
    .innerJoin(properties, eq(properties.id, apartments.propertyId))
    .where(
      and(eq(apartments.id, apartmentId), eq(properties.organizationId, apartments.organizationId)),
    )
    .limit(1);

  return row;
}

export async function findActiveLeaseForPayment(
  db: ReceivablesDatabase,
  apartmentId: string,
  tenantId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: leases.id })
    .from(leases)
    .where(
      and(
        eq(leases.apartmentId, apartmentId),
        eq(leases.tenantUserId, tenantId),
        eq(leases.status, 'ACTIVE'),
      ),
    )
    .limit(1);

  return row !== undefined;
}

/**
 * Écrit une allocation et son effet sur la créance ciblée.
 *
 * Une allocation désigne exactement UNE créance, de type loyer ou charge
 * (contrainte `single_receivable_check`). Le `kind` de l'allocation décide donc
 * seule de la table touchée, et ce branchement est le SEUIL lieu où cette
 * décision est prise dans le module : toute écriture d'allocation passe ici.
 */
async function applyAllocation(
  tx: Transaction,
  paymentId: string,
  currency: string,
  alloc: PaymentAllocationInsert,
  before: ReceivableState,
): Promise<number> {
  await tx.insert(paymentAllocations).values({
    paymentId,
    rentInstallmentId: alloc.kind === 'RENT' ? alloc.receivableId : null,
    chargeAllocationId: alloc.kind === 'CHARGE' ? alloc.receivableId : null,
    amount: alloc.amount,
    currency,
  });

  const newBalance = before.balance - alloc.amount;
  const newAmountPaid = before.amountDue - newBalance;
  const newStatus = computeReceivableStatusAfterPayment(before.status, newBalance);

  const target =
    alloc.kind === 'RENT'
      ? { table: rentInstallments, id: alloc.receivableId }
      : { table: chargeAllocations, id: alloc.receivableId };

  await tx
    .update(target.table)
    .set({ balance: newBalance, amountPaid: newAmountPaid, status: newStatus })
    .where(eq(target.table.id, target.id));

  return newBalance;
}

/**
 * Enregistre un paiement et ses allocations de maniere atomique.
 * Met a jour les soldes et statuts des creances cibles.
 */
export async function insertPaymentTx(
  db: ReceivablesDatabase,
  payload: RecordPaymentPayload,
): Promise<{ payment: Payment; newBalances: PaymentBalanceUpdate[] }> {
  return await db.transaction(async (tx) => {
    const [insertedPayment] = await tx
      .insert(payments)
      .values({
        organizationId: payload.organizationId,
        propertyId: payload.propertyId,
        apartmentId: payload.apartmentId,
        tenantId: payload.tenantId,
        amount: payload.amount,
        currency: payload.currency,
        method: payload.method,
        reference: payload.reference,
        status: payload.status,
        paidAt: payload.paidAt,
        declaredAt: payload.declaredAt ?? new Date(),
        confirmedAt: payload.confirmedAt ?? null,
        createdBy: payload.createdBy,
        validatedByUserId: payload.validatedByUserId ?? null,
        validatedAt: payload.validatedAt ?? null,
        disputedByUserId: payload.disputedByUserId ?? null,
        disputedAt: payload.disputedAt ?? null,
        cancelledAt: payload.cancelledAt ?? null,
        cancellationReason: payload.cancellationReason ?? null,
        referenceNumber: payload.referenceNumber,
        publicReference: payload.publicReference,
      })
      .returning();

    if (!insertedPayment) {
      throw new Error('PAYMENT_INSERT_RETURNED_NO_ROW');
    }

    const paymentId = insertedPayment.id;

    // 2. Inserer les allocations et mettre a jour les creances
    const newBalances: PaymentBalanceUpdate[] = [];

    for (const alloc of payload.allocations) {
      const [current] =
        alloc.kind === 'RENT'
          ? await tx
              .select({
                status: rentInstallments.status,
                balance: rentInstallments.balance,
                amountDue: rentInstallments.amountDue,
              })
              .from(rentInstallments)
              .where(eq(rentInstallments.id, alloc.receivableId))
              .for('update')
          : await tx
              .select({
                status: chargeAllocations.status,
                balance: chargeAllocations.balance,
                amountDue: chargeAllocations.amountDue,
              })
              .from(chargeAllocations)
              .where(eq(chargeAllocations.id, alloc.receivableId))
              .for('update');

      if (!current || current.balance < alloc.amount) {
        throw new AmountExceedsOutstandingError();
      }

      const balance = await applyAllocation(tx, paymentId, payload.currency, alloc, current);
      newBalances.push({ receivableId: alloc.receivableId, kind: alloc.kind, balance });
    }

    return { payment: insertedPayment, newBalances };
  });
}
