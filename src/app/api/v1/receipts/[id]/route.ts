import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { getLeaseReceiptById } from '@/modules/receipts';

/** Détail d'une quittance, selon le périmètre (DEC-058). */
export async function GET(
  _request: Request,
  routeContext: RouteContext<'/api/v1/receipts/[id]'>,
): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const { id } = await routeContext.params;

    return dataResponse(await getLeaseReceiptById(getDb(), id, context));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
