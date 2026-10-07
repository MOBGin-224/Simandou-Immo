import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, collectionResponse } from '@/lib/http/responses';
import { listTenants } from '@/modules/tenants';

/**
 * Liste des locataires (API section 15, DEC-046).
 *
 * ```text
 * GET /api/v1/tenants
 * ```
 *
 * Réunit les locataires, de tout statut, et les invitations en attente ou
 * expirées. Chaque élément porte un type : `ACCESS` ou `INVITATION`. Le `status`
 * est DÉRIVÉ, jamais stocké.
 *
 * **Aucun `POST` ici** : un locataire se crée par son invitation, sous
 * `/tenant-invitations`, qui porte le logement visé (DEC-046). Le périmètre d'un
 * gestionnaire sur un locataire ne se résout que par le logement, et seule
 * l'invitation le porte au Lot 7.
 *
 * Permission `tenant.read`. Un gestionnaire ne voit que les locataires des
 * logements de son périmètre ; un locataire ne voit pas cette liste et reçoit
 * 404 (DEC-047).
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const url = new URL(request.url);

    const collection = await listTenants(getDb(), context, {
      page: url.searchParams.get('page') ?? undefined,
      pageSize: url.searchParams.get('pageSize') ?? undefined,
      propertyId: url.searchParams.get('propertyId'),
      apartmentId: url.searchParams.get('apartmentId'),
      status: url.searchParams.get('status') ?? undefined,
      search: url.searchParams.get('search'),
    });

    return collectionResponse(collection.tenants, collection.meta);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
