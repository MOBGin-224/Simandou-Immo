import { z } from 'zod';

import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse, readJsonBody } from '@/lib/http/responses';
import { declarePayment, PaymentValidationError } from '@/modules/payments';
import { recordPaymentSchema } from '@/modules/payments/schemas';

/** Déclare un paiement manuel, en attente de validation croisée (DEC-056). */
export async function POST(request: Request): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const parsed = recordPaymentSchema.safeParse(await readJsonBody(request));

    if (!parsed.success) {
      throw new PaymentValidationError(
        z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      );
    }

    const result = await declarePayment(getDb(), parsed.data, context);

    return dataResponse(result.payment, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
