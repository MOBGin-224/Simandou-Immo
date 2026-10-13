import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { validatePayment } from '@/modules/payments';

/** Valide un paiement manuel déclaré, avec allocation des créances (DEC-056). */
export async function POST(
  _request: Request,
  routeContext: RouteContext<'/api/v1/payments/[id]/validate'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { id } = await routeContext.params;
    const result = await validatePayment(getDb(), id, accessContext);

    return dataResponse(result.payment);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
