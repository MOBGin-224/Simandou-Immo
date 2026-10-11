import { z } from 'zod';

import type { Payment } from '@/db/schema';
import {
  ResourceOutOfScopeError,
  requirePermission,
  type AccessContext,
} from '@/lib/authorization';
import type { ReceivablesDatabase } from '@/modules/receivables/service';
import { openChargeReceivablesForTenant } from '@/modules/charges';
import { openRentReceivablesForTenant } from '@/modules/rents';
import type { OutstandingReceivable } from '@/modules/receivables';
import { today } from '@/modules/receivables';

import { allocatePayment, type PaymentAllocationPlan } from './domain';
import { PaymentDateInFutureError, PaymentValidationError } from './errors';
import { findActiveLeaseForPayment, findApartmentForPayment, insertPaymentTx } from './repository';
import { recordPaymentSchema, type RecordPaymentInput } from './schemas';

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

export type PaymentServiceOptions = {
  now?: Date;
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

type OpenPaymentReceivable = OutstandingReceivable & {
  createdAt: string;
  currency: string;
};

/**
 * Enregistre un paiement manuel et alloue son montant aux créances ouvertes.
 */
export async function recordPayment(
  db: ReceivablesDatabase,
  input: RecordPaymentInput,
  context: AccessContext,
  options: PaymentServiceOptions = {},
): Promise<RecordPaymentResult> {
  const data = parseOrThrow(input);
  const todayDate = today(options);

  const apartment = await findApartmentForPayment(db, data.apartmentId);

  if (!apartment) throw new ResourceOutOfScopeError();

  requirePermission(context, 'payment.create', {
    organizationId: apartment.organizationId,
    propertyId: apartment.propertyId,
    ownerUserId: data.tenantId,
  });

  if (!(await findActiveLeaseForPayment(db, apartment.id, data.tenantId))) {
    throw new ResourceOutOfScopeError();
  }

  const [rentRows, chargeRows] = await Promise.all([
    openRentReceivablesForTenant(db, data.tenantId),
    openChargeReceivablesForTenant(db, data.tenantId),
  ]);

  const openReceivables: OpenPaymentReceivable[] = [
    ...rentRows
      .filter((row) => row.apartment.id === apartment.id && row.tenant.userId === data.tenantId)
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
      .filter((row) => row.apartment.id === apartment.id && row.tenant?.userId === data.tenantId)
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

  const allocationPlan = allocatePayment(data.amount, openReceivables);
  if (data.paidAt > todayDate) throw new PaymentDateInFutureError();

  const currency = openReceivables[0]?.currency ?? 'GNF';

  const inserted = await insertPaymentTx(db, {
    organizationId: apartment.organizationId,
    propertyId: apartment.propertyId,
    apartmentId: apartment.id,
    tenantId: data.tenantId,
    amount: data.amount,
    currency,
    method: data.method,
    reference: data.reference,
    paidAt: data.paidAt,
    confirmedAt: options.now ?? new Date(),
    recordedByUserId: context.userId,
    allocations: allocationPlan,
  });

  return {
    payment: inserted.payment,
    allocations: allocationPlan,
    newBalances: inserted.newBalances,
  };
}
