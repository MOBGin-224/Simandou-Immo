import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse, readJsonBody } from '@/lib/http/responses';
import { getLease, updateLease } from '@/modules/leases';

/**
 * Bail unique (API section 17).
 *
 * ```text
 * GET   /api/v1/leases/:leaseId    consultation
 * PATCH /api/v1/leases/:leaseId    modification partielle
 * ```
 *
 * Le `PATCH` ne touche ni le logement ni le locataire : ils DÉFINISSENT la
 * relation locative, et en changer un ferait un autre bail. Pour déplacer un
 * locataire, on clôture et on recrée, ce qui conserve l'historique du logement
 * (BR-027).
 *
 * Un bail clôturé ne se modifie plus et répond 409 : son contenu décrit ce qui a
 * eu lieu, et le réécrire effacerait l'historique.
 *
 * Aucun DELETE : la suppression physique n'est pas une opération du produit
 * (API section 65). Un bail se clôture, par `/terminate`.
 *
 * Le locataire CONSULTE son contrat (BR-021) mais ne le modifie pas : il ne porte
 * pas `lease.update`, les données financières de référence n'étant pas les
 * siennes (BR-022).
 */
export async function GET(
  _request: Request,
  context: RouteContext<'/api/v1/leases/[leaseId]'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { leaseId } = await context.params;

    return dataResponse(await getLease(getDb(), accessContext, leaseId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<'/api/v1/leases/[leaseId]'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { leaseId } = await context.params;
    const body = await readJsonBody(request);

    return dataResponse(await updateLease(getDb(), accessContext, leaseId, body));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
