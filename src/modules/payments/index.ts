/**
 * Surface publique du module Paiements.
 *
 * Le repository et les détails d'allocation transactionnelle restent privés :
 * les autres modules utilisent uniquement ce cas d'usage.
 */

export type { PaymentNewBalance, PaymentServiceOptions, RecordPaymentResult } from './service';
export {
  cancelPayment,
  declarePayment,
  disputePayment,
  generatePublicReference,
  getPaymentById,
  getPaymentReceiptPdf,
  listPayments,
  validatePayment,
} from './service';
export type { ListPaymentsQuery, RecordPaymentInput } from './schemas';

export type { FieldErrors } from './errors';
export {
  AmountExceedsOutstandingError,
  PaymentDateInFutureError,
  PaymentValidationError,
  ReceiptNotAvailableError,
} from './errors';
