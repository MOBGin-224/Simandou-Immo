import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, collectionResponse } from '@/lib/http/responses';
import { listInterventionsForIncident } from '@/modules/interventions';

/**
 * Interventions liées à un incident (Lot 14, DEC-060 section 3.5).
 *
 * N'est pas listée par DEC-060, mais nécessaire à la section « Interventions
 * liées » de l'écran `/incidents/[id]` prévue en 12.3 : elle complète l'API
 * sans la contredire.
 *
 * `listInterventionsForIncident` du service lève `ResourceOutOfScopeError`
 * (404) si l'incident est hors périmètre ou inexistant, avant de lister ses
 * interventions. Pas de pagination : une seule intervention à la fois ne
 * justifie pas d'en imposer une, et la section 11 ne la prévoit que pour la
 * collection générale.
 */
export async function GET(
  _request: Request,
  routeContext: RouteContext<'/api/v1/interventions/by-incident/[incidentId]'>,
): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const { incidentId } = await routeContext.params;

    const interventions = await listInterventionsForIncident(getDb(), incidentId, context);

    return collectionResponse(interventions, {});
  } catch (error) {
    return apiErrorResponse(error);
  }
}
