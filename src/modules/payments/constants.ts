export const PAYMENT_STATUSES = ['PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'OTHER'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
