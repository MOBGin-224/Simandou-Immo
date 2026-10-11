import { z } from 'zod';
import { PAYMENT_METHODS } from './constants';

export const recordPaymentSchema = z.object({
  organizationId: z.string().uuid(),
  propertyId: z.string().uuid(),
  tenantId: z.string().uuid(),
  amount: z.number().int().positive(),
  currency: z.literal('GNF'),
  method: z.enum(PAYMENT_METHODS),
  reference: z
    .string()
    .max(255)
    .optional()
    .transform((v) => v || undefined),
});

export type RecordPaymentParams = z.infer<typeof recordPaymentSchema>;

export const cancelPaymentSchema = z.object({
  cancellationReason: z.string().min(3).max(1000),
});
