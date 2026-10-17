import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse, readJsonBody } from '@/lib/http/responses';
import { parseTransitionStatus, transitionStatus } from '@/modules/incidents';

/**
 * Transition de statut d'un incident (Lot 13, DEC-017, DEC-059 section 4.3).
 *
 * Réservée à MANAGER (sur périmètre) et OWNER, jamais au TENANT.
 */
export async function PATCH(
  request: Request,
  routeContext: RouteContext<'/api/v1/incidents/[id]/status'>,
): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const { id } = await routeContext.params;
    const { toStatus, reason } = parseTransitionStatus(await readJsonBody(request));

    const incident = await transitionStatus(getDb(), id, toStatus, reason ?? null, context);

    return dataResponse(incident);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
