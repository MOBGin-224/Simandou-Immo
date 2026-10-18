import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { getIncident, listHistory } from '@/modules/incidents';

/**
 * Historique des transitions de statut d'un incident (Lot 13, DEC-059
 * sections 2.2 et 6).
 *
 * `listHistory` du dépôt rend un tableau vide pour un incident hors
 * périmètre, sans lever d'erreur (même raison que pour les commentaires,
 * voir `comments/route.ts`) : `getIncident`, déjà exporté et inchangé, porte
 * ici la vérification de périmètre qui donne 404 plutôt que 200 et vide.
 */
export async function GET(
  _request: Request,
  routeContext: RouteContext<'/api/v1/incidents/[id]/history'>,
): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const { id } = await routeContext.params;

    await getIncident(getDb(), id, context);

    return dataResponse(await listHistory(getDb(), id, context));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
