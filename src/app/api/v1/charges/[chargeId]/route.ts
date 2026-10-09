import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { getCharge } from '@/modules/charges';

/**
 * Charge unique, avec sa répartition (API section 27, MVP-BACKLOG-054).
 *
 * ```text
 * GET /api/v1/charges/:chargeId
 * ```
 *
 * La réponse porte la charge ET ses créances, dans l'ordre de la répartition :
 * une charge publiée ne se comprend pas sans voir ce qu'elle a produit, et c'est
 * la seule façon de relire l'arrondi, qui attribue un franc de plus aux
 * premières références (DEC-029).
 *
 * **Aucun PATCH, aucun DELETE.** Le montant vient de la facture et les parts du
 * calcul : les réécrire reviendrait à modifier en silence des créances déjà
 * annoncées à des locataires, ce que BR-053 interdit. Une charge se publie, puis
 * s'annule, et une correction se fait par une charge nouvelle (BR-054).
 *
 * Un LOCATAIRE reçoit 404 : une charge appartient à l'immeuble et non à une
 * personne. Il consulte SA part, qui est une créance, par `/api/v1/me/charges`.
 * L'inconnu et l'interdit restent indiscernables (ADR-008).
 */
export async function GET(
  _request: Request,
  context: RouteContext<'/api/v1/charges/[chargeId]'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { chargeId } = await context.params;

    return dataResponse(await getCharge(getDb(), accessContext, chargeId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
