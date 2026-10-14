/**
 * Surface publique du module Quittances (Lot 12, DEC-058).
 */
export { generateReceiptPublicReference, generateReceiptReference } from './sequences';

export type {
  EligibilityResult,
  EligibleAllocation,
  EligibleReceivable,
  MonthlyReceiptJobDetail,
  MonthlyReceiptJobResult,
  PublicReceiptVerificationData,
  ReceiptServiceOptions,
} from './service';
export {
  checkEligibility,
  emitReceipt,
  generateMonthlyReceiptsJob,
  getLeaseReceiptById,
  getPublicReceiptVerification,
  invalidateReceiptForPayment,
  listLeaseReceipts,
} from './service';

export type {
  LeaseReceiptListFilters,
  LeaseReceiptListResult,
  LeaseReceiptWithRelations,
} from './repository';

export {
  ReceiptAlreadyExistsError,
  ReceiptNotEligibleError,
  ReceiptNotFoundError,
  ReceiptValidationError,
  type FieldErrors,
} from './errors';

export { parseLeaseReceiptListQuery } from './schemas';

export { generateReceiptPdf, type ReceiptPdfData, type ReceiptPdfReceivable } from './receipt-pdf';
