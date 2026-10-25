import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse, readJsonBody } from '@/lib/http/responses';
import { getIntervention, updateIntervention } from '@/modules/interventions';

/**
 * Intervention unique (Lot 14, DEC-060).
 *
 * ```text
 * GET   /api/v1/interventions/:id    détail selon le périmètre et la projection (section 8.2)
 * PATCH /api/v1/interventions/:id    modification des champs autorisés (section 8.3)
 * ```
 *
 * Aucun DELETE : la suppression physique n'est pas une opération du produit
 * (DEC-020). Un identifiant inconnu et un identifiant hors périmètre renvoient
 * tous deux 404 : la distinction révélerait l'existence de données d'une
 * autre organisation (DEC-060, section 10.3).
 */
export async function GET(
  _request: Request,
  routeContext: RouteContext<'/api/v1/interventions/[id]'>,
): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const { id } = await routeContext.params;

    return dataResponse(await getIntervention(getDb(), id, context));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  routeContext: RouteContext<'/api/v1/interventions/[id]'>,
): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const { id } = await routeContext.params;
    const body = await readJsonBody(request);

    return dataResponse(await updateIntervention(getDb(), id, body, context));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
