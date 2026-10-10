import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { publishCharge } from '@/modules/charges';

/**
 * Publication d'une charge (API section 29, MVP-BACKLOG-052, DEC-005).
 *
 * ```text
 * POST /api/v1/charges/:chargeId/publish
 * ```
 *
 * > **DEC-005** : la publication **crée des créances payables**, une par
 * > appartement concerné.
 *
 * C'est l'acte central du lot. Il est ATOMIQUE : soit toutes les créances sont
 * créées, soit aucune (BR-052). Et il n'est PAS rejouable : une seconde
 * publication répond `CONFLICT`, « y compris en cas de double-clic ou de requête
 * concurrente », ce que la section exige et que la condition `status = 'DRAFT'`
 * du verrou garantit, la contrainte `UNIQUE (charge_id, apartment_id)` restant
 * le dernier arbitre.
 *
 * **C'est la différence de fond avec la génération des loyers**, qui est
 * idempotente et peut être rejouée sans dommage (DEC-028) : un loyer naît d'un
 * contrat, une répartition est un acte unique, et la rejouer doublerait la
 * facture présentée à douze locataires.
 *
 * **200 et non 201**, bien que des créances naissent : la ressource visée
 * existait déjà, et l'appel change son ÉTAT. La réponse porte la charge
 * publiée, ses parts, et le nombre de créances créées.
 *
 * Permission `charge.publish`, propriétaire et gestionnaire. Un locataire ne la
 * porte pas : il ne fait pas naître sa propre dette.
 */
export async function POST(
  _request: Request,
  context: RouteContext<'/api/v1/charges/[chargeId]/publish'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { chargeId } = await context.params;

    return dataResponse(await publishCharge(getDb(), accessContext, chargeId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
