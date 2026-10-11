import { z } from 'zod';
import { PAYMENT_METHODS } from './constants';

export const recordPaymentSchema = z.object({
  apartmentId: z.string().uuid(),
  tenantId: z.string().uuid(),
  amount: z.number().int().positive(),
  method: z.enum(PAYMENT_METHODS),
  paidAt: z.iso.date(),
  reference: z
    .string()
    .max(255)
    .optional()
    .transform((v) => v || undefined),
});

export type RecordPaymentInput = z.input<typeof recordPaymentSchema>;

export const cancelPaymentSchema = z.object({
  cancellationReason: z.string().min(3).max(1000),
});
