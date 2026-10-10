export class AmountExceedsOutstandingError extends Error {
  constructor() {
    super('AMOUNT_EXCEEDS_OUTSTANDING');
    this.name = 'AmountExceedsOutstandingError';
  }
}

export class PaymentAlreadyCancelledError extends Error {
  constructor() {
    super('PAYMENT_ALREADY_CANCELLED');
    this.name = 'PaymentAlreadyCancelledError';
  }
}
