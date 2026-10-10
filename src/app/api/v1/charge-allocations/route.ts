import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, collectionResponse } from '@/lib/http/responses';
import { listChargeAllocations } from '@/modules/charges';

/**
 * Créances de charge (API section 26, DEC-005).
 *
 * ```text
 * GET /api/v1/charge-allocations    liste du périmètre, filtrable
 * ```
 *
 * Le pendant exact de `GET /api/v1/rents` pour la seconde créance du MVP, et
 * c'est voulu : les deux créances partagent leur énumération de statut
 * (DEC-015), donc les mêmes filtres de statut, les mêmes composites
 * `OUTSTANDING` et `UPCOMING`, et le même refus pour qui n'a aucun immeuble
 * lisible. Un paiement les soldera indifféremment (DEC-022), et deux listes qui
 * se liraient différemment rendraient cette symétrie invisible.
 *
 * **Aucun POST.** Une créance de charge n'est pas saisie : elle naît de la
 * PUBLICATION d'une charge (BR-052), et la seule porte d'écriture est
 * `/api/v1/charges/:id/publish`. C'est le même raisonnement que pour l'échéance
 * de loyer, générée et non créée à la main.
 *
 * Les six filtres de la section sont servis, `chargeId` compris, qui donne la
 * répartition complète d'une facture.
 *
 * Les créances d'un logement VACANT y figurent : elles restent visibles du
 * propriétaire et du gestionnaire, qui doivent savoir quelle part de la facture
 * reste à leur charge (BR-052). Elles n'apparaissent dans aucun espace
 * locataire, n'ayant aucune personne redevable.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const url = new URL(request.url);

    const collection = await listChargeAllocations(getDb(), context, {
      page: url.searchParams.get('page') ?? undefined,
      pageSize: url.searchParams.get('pageSize') ?? undefined,
      propertyId: url.searchParams.get('propertyId'),
      apartmentId: url.searchParams.get('apartmentId'),
      tenantId: url.searchParams.get('tenantId'),
      chargeId: url.searchParams.get('chargeId'),
      period: url.searchParams.get('period'),
      status: url.searchParams.get('status') ?? undefined,
    });

    return collectionResponse(collection.allocations, {
      ...collection.meta,
      totalOutstanding: collection.totalOutstanding,
      currency: collection.currency,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
