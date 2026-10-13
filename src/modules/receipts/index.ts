/**
 * Surface publique du module Quittances (Lot 12, DEC-058).
 */
export { generateReceiptPublicReference, generateReceiptReference } from './sequences';

export type {
  EligibilityResult,
  EligibleAllocation,
  EligibleReceivable,
  ReceiptServiceOptions,
} from './service';
export {
  checkEligibility,
  emitReceipt,
  getLeaseReceiptById,
  invalidateReceiptForPayment,
  listLeaseReceipts,
} from './service';

export type {
  LeaseReceiptListFilters,
  LeaseReceiptListResult,
  LeaseReceiptWithRelations,
} from './repository';

export { ReceiptAlreadyExistsError, ReceiptNotEligibleError, ReceiptNotFoundError } from './errors';
