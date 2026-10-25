import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { listHistory } from '@/modules/interventions';

/**
 * Historique des transitions de statut d'une intervention (Lot 14, DEC-060
 * sections 2.2 et 9).
 *
 * `listHistory` du service vérifie lui-même la visibilité de l'intervention
 * et lève `InterventionNotFoundError` (404) si elle est hors périmètre ou
 * inexistante, avant de lire l'historique.
 */
export async function GET(
  _request: Request,
  routeContext: RouteContext<'/api/v1/interventions/[id]/history'>,
): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const { id } = await routeContext.params;

    return dataResponse(await listHistory(getDb(), id, context));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
