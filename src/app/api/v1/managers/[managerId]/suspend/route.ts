import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { suspendManager } from '@/modules/managers';

/**
 * Suspension d'un gestionnaire (DEC-044, MVP-FEAT-021).
 *
 * ```text
 * POST /api/v1/managers/:managerId/suspend
 * ```
 *
 * Bloque l'accès à la requête suivante en CONSERVANT le périmètre : la réactivation
 * restitue exactement l'accès d'avant. Ne touche ni le compte, ni les sessions, ni
 * les accès de la personne chez d'autres propriétaires.
 *
 * Permission `manager.update`, propriétaire seul. Un accès déjà suspendu, ou révoqué,
 * répond 409 : un succès sur une suspension sans effet tromperait le propriétaire.
 */
export async function POST(
  _request: Request,
  context: RouteContext<'/api/v1/managers/[managerId]/suspend'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { managerId } = await context.params;

    return dataResponse(await suspendManager(getDb(), accessContext, managerId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
