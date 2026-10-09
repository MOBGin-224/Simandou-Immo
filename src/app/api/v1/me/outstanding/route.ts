import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { getMyOutstanding } from '@/modules/receivables';

/**
 * Total dû de la personne connectée (API section 18).
 *
 * ```text
 * GET /api/v1/me/outstanding
 * ```
 *
 * C'est la route du LOCATAIRE : son périmètre est lui-même et non un immeuble
 * (BR-021), donc il n'a aucun identifiant à fournir, et la session suffit à dire
 * de qui on parle. La variante nommée, `/tenants/:id/outstanding`, sert la
 * personne qui gère.
 *
 * Elle agrège les DEUX types de créance (DEC-005), chaque élément portant son
 * `kind`. Depuis le Lot 10, les créances de charge y figurent aux côtés des
 * loyers, sans que la forme de la réponse ait changé : c'est l'exemple même de
 * la décision, « loyer 2 500 000 plus charge eau 300 000 égale 2 800 000 dû ».
 * Les créances sont rendues dans l'ordre d'allocation de DEC-022, échéance
 * croissante puis loyer avant charge.
 *
 * `totalOutstanding` est calculé par le serveur, la section l'impose : « le
 * frontend ne le recompose jamais ». C'est le montant qu'une personne lit avant
 * de payer, et deux calculs séparés finiraient par se contredire.
 *
 * Elle répond aussi à un propriétaire ou à un gestionnaire, qui obtient alors son
 * propre total, normalement nul : mieux vaut une liste vide qu'un refus sur une
 * route qui parle de soi.
 */
export async function GET(): Promise<Response> {
  try {
    const context = await requireAccessContext();

    return dataResponse(await getMyOutstanding(getDb(), context));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
