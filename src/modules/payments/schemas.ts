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

export const listPaymentsQuerySchema = z.object({
  page: z.coerce.number('Numéro de page invalide.').int().min(1).default(1),
  status: z.enum(['PENDING', 'CONFIRMED', 'DISPUTED', 'CANCELLED']).optional(),
  apartmentId: z.uuid('Identifiant invalide.').optional(),
  tenantId: z.uuid('Identifiant invalide.').optional(),
});

export type ListPaymentsQuery = z.output<typeof listPaymentsQuerySchema>;
