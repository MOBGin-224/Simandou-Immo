import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { getManager } from '@/modules/managers';

/**
 * Fiche d'un gestionnaire (MVP-BACKLOG-026, API section 13, PRD 10.2).
 *
 * ```text
 * GET /api/v1/managers/:managerId
 * ```
 *
 * `:managerId` est un `user_access.id`, celui d'un ACCÈS de gestionnaire. Une
 * invitation en attente n'a pas d'accès : elle a son identifiant propre, sous
 * `/manager-invitations` (DEC-041).
 *
 * Réservée au propriétaire. Un identifiant inconnu, mal formé, d'une autre
 * organisation, ou qui désigne un accès de propriétaire ou de locataire, répond la
 * MÊME réponse 404 : la distinction révélerait l'existence de données d'autrui
 * (ADR-007).
 */
export async function GET(
  _request: Request,
  context: RouteContext<'/api/v1/managers/[managerId]'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { managerId } = await context.params;

    return dataResponse(await getManager(getDb(), accessContext, managerId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
