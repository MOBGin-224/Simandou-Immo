import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse, readJsonBody } from '@/lib/http/responses';
import { getIncident, updateIncident } from '@/modules/incidents';

/**
 * Incident unique (Lot 13, DEC-059).
 *
 * ```text
 * GET   /api/v1/incidents/:id    détail selon le périmètre
 * PATCH /api/v1/incidents/:id    modification des champs descriptifs (section 4.5)
 * ```
 *
 * Aucun DELETE : la suppression physique n'est pas une opération du produit
 * (DEC-020). Un identifiant inconnu et un identifiant hors périmètre renvoient
 * tous deux 404 : la distinction révélerait l'existence de données d'une
 * autre organisation (DEC-059, section 9.3).
 */
export async function GET(
  _request: Request,
  routeContext: RouteContext<'/api/v1/incidents/[id]'>,
): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const { id } = await routeContext.params;

    return dataResponse(await getIncident(getDb(), id, context));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  routeContext: RouteContext<'/api/v1/incidents/[id]'>,
): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const { id } = await routeContext.params;
    const body = await readJsonBody(request);

    return dataResponse(await updateIncident(getDb(), id, body, context));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
