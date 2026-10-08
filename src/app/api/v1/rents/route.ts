import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, collectionResponse } from '@/lib/http/responses';
import { listRents } from '@/modules/rents';

/**
 * Créances de loyer (API section 18, MVP-BACKLOG-039).
 *
 * ```text
 * GET /api/v1/rents    liste du périmètre, filtrable
 * ```
 *
 * **Aucun POST.** Une échéance n'est pas saisie, elle est GÉNÉRÉE à partir des
 * baux actifs (BR-034) : la création manuelle d'une dette n'existe pas dans le
 * produit, et la seule porte d'écriture est `/api/v1/rents/generate`. C'est le
 * même raisonnement que pour l'occupation d'un logement, dérivée du bail et non
 * saisissable (DEC-050).
 *
 * Les cinq filtres de la section sont servis, plus `leaseId`, qui ouvre
 * l'historique d'un contrat sans passer par son locataire. `period` s'écrit
 * `AAAA-MM`, un mois, et non une date : c'est ainsi qu'une personne désigne le
 * loyer d'octobre.
 *
 * `meta` porte le total dû du résultat filtré, calculé côté serveur sur
 * l'ENSEMBLE du filtre et non sur la page : la section 18 interdit au frontend
 * de recomposer un total, et une somme des vingt lignes visibles annoncerait une
 * dette fausse.
 *
 * Permission `rent.read`, propriétaire comme gestionnaire, chacun sur son
 * périmètre. Un locataire la porte aussi, mais cette liste lui répond 404 : il
 * consulte SES loyers par `/api/v1/me/outstanding` et par son espace, son
 * rattachement étant lui-même et non un immeuble (BR-021).
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const url = new URL(request.url);

    const collection = await listRents(getDb(), context, {
      page: url.searchParams.get('page') ?? undefined,
      pageSize: url.searchParams.get('pageSize') ?? undefined,
      propertyId: url.searchParams.get('propertyId'),
      apartmentId: url.searchParams.get('apartmentId'),
      tenantId: url.searchParams.get('tenantId'),
      leaseId: url.searchParams.get('leaseId'),
      period: url.searchParams.get('period'),
      status: url.searchParams.get('status') ?? undefined,
    });

    return collectionResponse(collection.rents, {
      ...collection.meta,
      totalOutstanding: collection.totalOutstanding,
      currency: collection.currency,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
