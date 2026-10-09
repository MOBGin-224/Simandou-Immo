import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { cancelCharge } from '@/modules/charges';

/**
 * Annulation d'une charge (API section 29 « Annulation », BR-054).
 *
 * ```text
 * POST /api/v1/charges/:chargeId/cancel
 * ```
 *
 * « Passe la charge en `CANCELLED` et ses créances en `CANCELLED`, sans
 * supprimer ni les créances, ni les allocations de paiement déjà réalisées. »
 * Rien n'est donc effacé : les créances annulées sortent du total dû (BR-039) en
 * laissant visible l'argent déjà reçu, parce qu'un remboursement est une
 * décision humaine, hors MVP (DEC-016).
 *
 * **C'est aussi la façon de corriger une erreur de saisie**, un brouillon
 * s'annulant comme une charge publiée : aucune route de modification n'existe,
 * BR-053 interdisant la correction silencieuse. Une charge annulée puis recréée
 * laisse les deux versions dans l'historique, ce qu'une réécriture ferait
 * disparaître.
 *
 * **Aucune permission `charge.cancel` n'a été inventée** : le catalogue est
 * exhaustif pour le MVP (DEC-025), et une permission ne crée jamais une
 * fonctionnalité. L'annulation relève de `charge.publish`, la permission qui
 * gouverne l'existence des créances : qui peut les faire naître peut les
 * éteindre.
 *
 * Une charge déjà annulée répond `CONFLICT` : réécrire sa date d'annulation
 * ferait perdre la trace de la première.
 */
export async function POST(
  _request: Request,
  context: RouteContext<'/api/v1/charges/[chargeId]/cancel'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { chargeId } = await context.params;

    return dataResponse(await cancelCharge(getDb(), accessContext, chargeId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
