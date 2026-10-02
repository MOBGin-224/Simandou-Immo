import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { revokeManager } from '@/modules/managers';

/**
 * Révocation de l'accès d'un gestionnaire (MVP-FEAT-022, BR-019, DEC-013).
 *
 * ```text
 * POST /api/v1/managers/:managerId/revoke
 * ```
 *
 * Effet, en une seule transaction :
 *
 *   - l'accès est bloqué à la requête suivante ;
 *   - TOUT son périmètre est révoqué avec lui ;
 *   - ses sessions sont coupées, mais seulement s'il n'a plus aucun accès actif
 *     ailleurs.
 *
 * L'historique est CONSERVÉ : rien n'est supprimé, et les actions passées restent
 * attribuées à la personne. Possible depuis un accès actif comme suspendu. Un accès
 * déjà révoqué répond 409. Permission `manager.revoke`, propriétaire seul.
 */
export async function POST(
  _request: Request,
  context: RouteContext<'/api/v1/managers/[managerId]/revoke'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { managerId } = await context.params;

    return dataResponse(await revokeManager(getDb(), accessContext, managerId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
