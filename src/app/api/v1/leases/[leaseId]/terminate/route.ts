import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse, readJsonBody } from '@/lib/http/responses';
import { terminateLease } from '@/modules/leases';

/**
 * Clôture d'un bail (API section 17, MVP-BACKLOG-033).
 *
 * ```text
 * POST /api/v1/leases/:leaseId/terminate
 * ```
 *
 * Le corps porte `terminationDate`, qui devient la date de FIN du bail, et une
 * `reason` libre et facultative (BR-033). C'est cette date qui empêchera la
 * génération d'échéances au-delà, au Lot 9.
 *
 * **La clôture libère le logement et la personne** : un nouveau bail peut être
 * créé aussitôt sur le logement (BR-027), et la personne peut reprendre un autre
 * logement du même bailleur (DEC-049).
 *
 * **Elle ne touche PAS l'accès au produit du locataire.** Les deux opérations
 * sont distinctes, dans les deux sens : révoquer un accès ne termine aucun bail
 * (DEC-047), et clôturer un bail ne retire aucun accès.
 *
 * Permission `lease.terminate`, propriétaire comme gestionnaire. Un bail déjà
 * clôturé répond 409, et une date antérieure au début du bail est refusée.
 */
export async function POST(
  request: Request,
  context: RouteContext<'/api/v1/leases/[leaseId]/terminate'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { leaseId } = await context.params;
    const body = await readJsonBody(request);

    return dataResponse(await terminateLease(getDb(), accessContext, leaseId, body));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
