import { describe, expect, it } from 'vitest';

import type { OutstandingReceivable } from '../../src/modules/receivables/domain';
import { AmountExceedsOutstandingError } from '../../src/modules/payments/errors';
import { allocatePayment } from '../../src/modules/payments/domain';

function receivable(
  id: string,
  values: Partial<OutstandingReceivable & { createdAt: string }> = {},
): OutstandingReceivable & { createdAt: string } {
  return {
    kind: 'RENT',
    id,
    label: id,
    periodStart: '2026-09-01',
    dueDate: '2026-09-10',
    amountDue: 100,
    amountPaid: 0,
    balance: 100,
    status: 'UNPAID',
    createdAt: '2026-09-01T00:00:00.000Z',
    ...values,
  };
}

describe('Allocation des paiements', () => {
  it('alloue partiellement à la créance la plus ancienne', () => {
    const allocations = allocatePayment(40, [
      receivable('newer', { dueDate: '2026-10-10' }),
      receivable('older', { dueDate: '2026-09-10' }),
    ]);

    expect(allocations).toEqual([{ receivableId: 'older', kind: 'RENT', amount: 40 }]);
  });

  it('solde la première créance sans toucher à la suivante quand les montants sont égaux', () => {
    const allocations = allocatePayment(100, [
      receivable('first', { dueDate: '2026-09-10' }),
      receivable('second', { dueDate: '2026-10-10' }),
    ]);

    expect(allocations).toEqual([{ receivableId: 'first', kind: 'RENT', amount: 100 }]);
  });

  it('alloue dans l’ordre lorsque le montant couvre plusieurs créances', () => {
    const allocations = allocatePayment(150, [
      receivable('second', { dueDate: '2026-10-10' }),
      receivable('first', { dueDate: '2026-09-10' }),
    ]);

    expect(allocations).toEqual([
      { receivableId: 'first', kind: 'RENT', amount: 100 },
      { receivableId: 'second', kind: 'RENT', amount: 50 },
    ]);
  });

  it('priorise le loyer sur la charge à échéance égale', () => {
    const allocations = allocatePayment(100, [
      receivable('charge', { kind: 'CHARGE' }),
      receivable('rent', { kind: 'RENT' }),
    ]);

    expect(allocations).toEqual([{ receivableId: 'rent', kind: 'RENT', amount: 100 }]);
  });

  it('priorise la créance la plus ancienne à échéance et type égaux', () => {
    const allocations = allocatePayment(100, [
      receivable('created-later', { createdAt: '2026-09-02T00:00:00.000Z' }),
      receivable('created-first', { createdAt: '2026-09-01T00:00:00.000Z' }),
    ]);

    expect(allocations).toEqual([{ receivableId: 'created-first', kind: 'RENT', amount: 100 }]);
  });

  it('accepte le montant exact du solde total', () => {
    expect(() => allocatePayment(200, [receivable('one'), receivable('two')])).not.toThrow();
  });

  it('refuse un montant supérieur au solde total', () => {
    expect(() => allocatePayment(201, [receivable('one'), receivable('two')])).toThrow(
      AmountExceedsOutstandingError,
    );
  });
});
