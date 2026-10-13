/** DEC-058, 3.1 : les conditions d'émission ne sont pas réunies. */
export class ReceiptNotEligibleError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = 'ReceiptNotEligibleError';
  }
}

/**
 * Levée explicitement quand une création est forcée alors qu'une quittance
 * existe déjà pour (leaseId, periodStart). `emitReceipt` ne lève jamais
 * cette erreur de lui-même : il retourne la quittance existante (DEC-058,
 * 4.1, pas de doublon sur réémission).
 */
export class ReceiptAlreadyExistsError extends Error {
  constructor(leaseId: string, periodStart: string) {
    super(`Une quittance existe déjà pour le bail ${leaseId} et la période ${periodStart}.`);
    this.name = 'ReceiptAlreadyExistsError';
  }
}

export class ReceiptNotFoundError extends Error {
  constructor() {
    super('RECEIPT_NOT_FOUND');
    this.name = 'ReceiptNotFoundError';
  }
}
