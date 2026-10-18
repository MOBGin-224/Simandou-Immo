import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse, readJsonBody } from '@/lib/http/responses';
import { assignIncident, parseAssignIncident } from '@/modules/incidents';

/**
 * Affectation ou réaffectation d'un incident (Lot 13, DEC-059 section 4.4).
 *
 * Réservée à MANAGER (sur périmètre) et OWNER. Ne change pas le statut : le
 * passage à ASSIGNED passe par `PATCH /api/v1/incidents/[id]/status`.
 */
export async function PATCH(
  request: Request,
  routeContext: RouteContext<'/api/v1/incidents/[id]/assignment'>,
): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const { id } = await routeContext.params;
    const { assignedToUserId } = parseAssignIncident(await readJsonBody(request));

    const incident = await assignIncident(getDb(), id, assignedToUserId, context);

    return dataResponse(incident);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
