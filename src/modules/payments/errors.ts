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

/** DEC-057, 1.1 et 1.2 : seul un paiement CONFIRMED ou CANCELLED a un reçu. */
export class ReceiptNotAvailableError extends Error {
  constructor() {
    super('Un reçu ne peut être généré que pour un paiement confirmé ou annulé');
    this.name = 'ReceiptNotAvailableError';
  }
}
