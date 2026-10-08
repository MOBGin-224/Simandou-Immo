import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { getRent } from '@/modules/rents';

/**
 * Créance de loyer unique (API section 18, « Consulter »).
 *
 * ```text
 * GET /api/v1/rents/:rentId
 * ```
 *
 * **Aucun PATCH, aucun DELETE.** Le montant attendu vient du contrat (BR-036) et
 * le statut vient de la situation financière (BR-037) : les deux sont dérivés,
 * donc les réécrire à la main reviendrait à mentir sur une dette. Une créance se
 * solde par un paiement, qui arrive au Lot 11, et s'éteint par une annulation,
 * qui laisse une trace d'audit (DEC-016).
 *
 * Le LOCATAIRE consulte sa propre créance : il porte `rent.read`, et c'est la
 * personne redevable de la ligne qui le lui ouvre, sans qu'il soit rattaché à
 * aucun immeuble (BR-021). Une créance qui n'est pas la sienne lui répond 404,
 * comme à tout appelant hors périmètre, l'inconnu et l'interdit devant rester
 * indiscernables (ADR-008).
 */
export async function GET(
  _request: Request,
  context: RouteContext<'/api/v1/rents/[rentId]'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { rentId } = await context.params;

    return dataResponse(await getRent(getDb(), accessContext, rentId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
