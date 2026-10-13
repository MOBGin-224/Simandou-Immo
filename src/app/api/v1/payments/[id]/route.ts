import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { getPaymentById } from '@/modules/payments';

export async function GET(
  _request: Request,
  routeContext: RouteContext<'/api/v1/payments/[id]'>,
): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const { id } = await routeContext.params;

    return dataResponse(await getPaymentById(getDb(), id, context));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
