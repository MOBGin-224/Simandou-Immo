import { compareOutstanding, type OutstandingReceivable } from '@/modules/receivables/domain';
import { AmountExceedsOutstandingError } from './errors';

export type PaymentAllocationPlan = {
  receivableId: string;
  kind: 'RENT' | 'CHARGE';
  amount: number;
};

/**
 * Calcule l'allocation d'un paiement sur les creances ouvertes.
 *
 * Applique DEC-022 :
 * 1. Trie les creances par date d'echeance, puis loyer avant charge.
 * 2. Impute le montant jusqu'a epuisement, ou jusqu'a epuisement des creances.
 *
 * Applique DEC-023 (BR-097) :
 * - Si le montant depasse le solde total, jette AmountExceedsOutstandingError.
 */
export function allocatePayment(
  paymentAmount: number,
  openReceivables: (OutstandingReceivable & { createdAt: string })[],
): PaymentAllocationPlan[] {
  const totalOutstanding = openReceivables.reduce((acc, r) => acc + r.balance, 0);
  if (paymentAmount > totalOutstanding) {
    throw new AmountExceedsOutstandingError();
  }

  // Copie et tri selon DEC-022
  const sorted = [...openReceivables].sort(compareOutstanding);

  const allocations: PaymentAllocationPlan[] = [];
  let remaining = paymentAmount;

  for (const receivable of sorted) {
    if (remaining <= 0) break;

    const toAllocate = Math.min(remaining, receivable.balance);
    if (toAllocate > 0) {
      allocations.push({
        receivableId: receivable.id,
        kind: receivable.kind,
        amount: toAllocate,
      });
      remaining -= toAllocate;
    }
  }

  return allocations;
}
