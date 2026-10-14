import { z } from 'zod';

import { ReceiptValidationError } from './errors';
import type { LeaseReceiptListFilters } from './repository';

const listLeaseReceiptsQuerySchema = z.object({
  page: z.coerce.number('Numéro de page invalide.').int().min(1).default(1),
  status: z.enum(['EMISE', 'INVALIDEE']).optional(),
  propertyId: z.uuid('Identifiant invalide.').optional(),
  tenantId: z.uuid('Identifiant invalide.').optional(),
  period: z
    .string()
    .regex(/^\d{4}-\d{2}-01$/, 'Période invalide.')
    .optional(),
});

/**
 * Valide et met en forme les paramètres de requête de la liste des
 * quittances. `tenantId`, nom du paramètre public, devient `tenantUserId`,
 * nom de la colonne (DEC-058) : cette correspondance vit ici et nulle part
 * ailleurs.
 */
export function parseLeaseReceiptListQuery(input: unknown): LeaseReceiptListFilters {
  const result = listLeaseReceiptsQuerySchema.safeParse(input);

  if (!result.success) {
    throw new ReceiptValidationError(
      z.flattenError(result.error).fieldErrors as Record<string, string[]>,
    );
  }

  const { tenantId, ...rest } = result.data;
  return { ...rest, tenantUserId: tenantId };
}
