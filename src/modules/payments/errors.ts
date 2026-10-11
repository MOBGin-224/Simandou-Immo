export type FieldErrors = Record<string, string[]>;

export class PaymentValidationError extends Error {
  constructor(readonly fieldErrors: FieldErrors) {
    super('Les données fournies sont invalides.');
    this.name = 'PaymentValidationError';
  }
}

export class AmountExceedsOutstandingError extends Error {
  constructor() {
    super('AMOUNT_EXCEEDS_OUTSTANDING');
    this.name = 'AmountExceedsOutstandingError';
  }
}

export class PaymentDateInFutureError extends Error {
  constructor() {
    super('La date du paiement ne peut pas être dans le futur.');
    this.name = 'PaymentDateInFutureError';
  }
}

export class PaymentAlreadyCancelledError extends Error {
  constructor() {
    super('PAYMENT_ALREADY_CANCELLED');
    this.name = 'PaymentAlreadyCancelledError';
  }
}
