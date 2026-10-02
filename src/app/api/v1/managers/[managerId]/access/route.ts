import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse, readJsonBody } from '@/lib/http/responses';
import { updateManagerScope } from '@/modules/managers';

/**
 * Modification du périmètre d'un gestionnaire (MVP-FEAT-021, API section 13).
 *
 * ```text
 * PATCH /api/v1/managers/:managerId/access
 * { "propertyIds": ["…", "…"] }
 * ```
 *
 * Ne modifie QUE la liste des immeubles : les permissions découlent du rôle
 * (DEC-025), et aucun champ de permission n'est lu. La liste fournie REMPLACE la
 * précédente, avec au moins un immeuble (DEC-042). L'effet est immédiat.
 *
 * Réservée au propriétaire (`manager.update`). Un accès révoqué répond 409 : on le
 * réinvite, avec un périmètre neuf (DEC-043).
 */
export async function PATCH(
  request: Request,
  context: RouteContext<'/api/v1/managers/[managerId]/access'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { managerId } = await context.params;
    const body = await readJsonBody(request);

    return dataResponse(await updateManagerScope(getDb(), accessContext, managerId, body));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
