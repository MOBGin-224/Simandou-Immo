import { eq } from 'drizzle-orm';
import type { ReceivablesDatabase } from '@/modules/receivables/service';
import { payments, paymentAllocations, rentInstallments, chargeAllocations } from '@/db/schema';
import type { PaymentMethod } from './constants';
import { computeReceivableStatusAfterPayment } from '@/modules/receivables/domain';
import type { ReceivableStatus } from '@/modules/receivables/constants';

export type PaymentAllocationInsert = {
  receivableId: string;
  kind: 'RENT' | 'CHARGE';
  amount: number;
};

export type RecordPaymentPayload = {
  organizationId: string;
  propertyId: string;
  tenantId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  reference?: string;
  recordedByUserId: string;
  recordedAt: Date;
  allocations: PaymentAllocationInsert[];
  // Requis pour recalculer le statut correctement
  receivablesBeforePayment: Record<
    string,
    { status: ReceivableStatus; balance: number; amountDue: number }
  >;
};

/**
 * Enregistre un paiement et ses allocations de maniere atomique.
 * Met a jour les soldes et statuts des creances cibles.
 */
export async function insertPaymentTx(
  db: ReceivablesDatabase,
  payload: RecordPaymentPayload,
): Promise<string> {
  return await db.transaction(async (tx) => {
    // 1. Inserer le paiement (DEC-055 : nait CONFIRMED)
    const [insertedPayment] = await tx
      .insert(payments)
      .values({
        organizationId: payload.organizationId,
        propertyId: payload.propertyId,
        tenantId: payload.tenantId,
        amount: payload.amount,
        currency: payload.currency,
        method: payload.method,
        reference: payload.reference,
        status: 'CONFIRMED',
        recordedByUserId: payload.recordedByUserId,
        recordedAt: payload.recordedAt,
      })
      .returning({ id: payments.id });

    if (!insertedPayment) {
      throw new Error('PAYMENT_INSERT_RETURNED_NO_ROW');
    }

    const paymentId = insertedPayment.id;

    // 2. Inserer les allocations et mettre a jour les creances
    for (const alloc of payload.allocations) {
      // Inserer l'allocation
      await tx.insert(paymentAllocations).values({
        paymentId,
        rentInstallmentId: alloc.kind === 'RENT' ? alloc.receivableId : null,
        chargeAllocationId: alloc.kind === 'CHARGE' ? alloc.receivableId : null,
        amount: alloc.amount,
        currency: payload.currency,
      });

      // Mettre a jour la creance
      const before = payload.receivablesBeforePayment[alloc.receivableId];
      if (!before) throw new Error(`Receivable state not provided for ${alloc.receivableId}`);

      const newBalance = before.balance - alloc.amount;
      const newAmountPaid = before.amountDue - newBalance;
      const newStatus = computeReceivableStatusAfterPayment(before.status, newBalance);

      if (alloc.kind === 'RENT') {
        await tx
          .update(rentInstallments)
          .set({
            balance: newBalance,
            amountPaid: newAmountPaid,
            status: newStatus,
          })
          .where(eq(rentInstallments.id, alloc.receivableId));
      } else {
        await tx
          .update(chargeAllocations)
          .set({
            balance: newBalance,
            amountPaid: newAmountPaid,
            status: newStatus,
          })
          .where(eq(chargeAllocations.id, alloc.receivableId));
      }
    }

    return paymentId;
  });
}
