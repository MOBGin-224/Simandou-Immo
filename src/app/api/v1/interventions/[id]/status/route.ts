import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse, readJsonBody } from '@/lib/http/responses';
import { transitionStatus } from '@/modules/interventions';

/**
 * Transition de statut d'une intervention (Lot 14, DEC-018, DEC-060
 * sections 4, 8.4 et 9).
 *
 * Réservée à MANAGER (sur périmètre) et OWNER, jamais au TENANT. Le corps
 * est transmis tel quel au service : `transitionStatus` le valide lui-même
 * avec `parseTransitionStatus` (`toStatus`, `reason` et `actualCost`
 * optionnels, dont le caractère obligatoire dépend de `toStatus`, DEC-060
 * 4.4 et 4.5).
 */
export async function PATCH(
  request: Request,
  routeContext: RouteContext<'/api/v1/interventions/[id]/status'>,
): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const { id } = await routeContext.params;
    const body = await readJsonBody(request);

    const intervention = await transitionStatus(getDb(), id, body, context);

    return dataResponse(intervention);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
