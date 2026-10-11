import { z } from 'zod';

import { getDb } from '@/db/client';
import {
  PermissionDeniedError,
  requireAccessContext,
  roleHasPermission,
} from '@/lib/authorization';
import { apiErrorResponse, dataResponse, readJsonBody } from '@/lib/http/responses';
import { cancelPayment, PaymentValidationError } from '@/modules/payments';

const cancelBodySchema = z.object({
  reason: z.string().min(3).max(1000),
});

/** Annule un paiement manuel et restaure ses créances s'il était confirmé. */
export async function POST(
  request: Request,
  routeContext: RouteContext<'/api/v1/payments/[id]/cancel'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    if (
      accessContext.memberships.length > 0 &&
      !accessContext.memberships.some((membership) =>
        roleHasPermission(membership.role, 'payment.cancel'),
      )
    ) {
      throw new PermissionDeniedError('payment.cancel');
    }

    const { id } = await routeContext.params;
    const parsed = cancelBodySchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      throw new PaymentValidationError(
        z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      );
    }

    const payment = await cancelPayment(getDb(), id, parsed.data.reason, accessContext);

    return dataResponse(payment);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
