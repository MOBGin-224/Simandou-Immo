import { z } from 'zod';

import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse, readJsonBody } from '@/lib/http/responses';
import { disputePayment, PaymentValidationError } from '@/modules/payments';

const disputeBodySchema = z.object({
  reason: z.string().min(3).max(1000),
  category: z.enum(['NOT_PAID', 'WRONG_AMOUNT', 'WRONG_DATE', 'WRONG_PERSON', 'OTHER']),
});

/** Conteste un paiement manuel déclaré, sans l'allouer (DEC-056). */
export async function POST(
  request: Request,
  routeContext: RouteContext<'/api/v1/payments/[id]/dispute'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { id } = await routeContext.params;
    const parsed = disputeBodySchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      throw new PaymentValidationError(
        z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      );
    }

    const payment = await disputePayment(
      getDb(),
      id,
      parsed.data.reason,
      parsed.data.category,
      accessContext,
    );

    return dataResponse(payment);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
