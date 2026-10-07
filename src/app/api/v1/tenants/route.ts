import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, collectionResponse } from '@/lib/http/responses';
import { listTenants } from '@/modules/tenants';

/**
 * Liste des locataires (API section 15, DEC-051).
 *
 * ```text
 * GET /api/v1/tenants
 * ```
 *
 * Réunit **toute personne qui a une relation locative** avec une organisation du
 * périmètre, qu'elle ait ou non un accès à l'application : une invitation, un
 * accès ou un bail suffit à l'y faire figurer. Un élément par couple personne et
 * organisation, dont l'identifiant est un `users.id`.
 *
 * Le `status` est DÉRIVÉ, jamais stocké, et distingue `NO_ACCESS` de `REVOKED` :
 * le premier n'a jamais eu de compte, le second en avait un qu'on lui a retiré.
 *
 * **Aucun `POST` ici** : une personne entre dans le produit par son invitation,
 * sous `/tenant-invitations`, ou par le bail qu'on lui crée (DEC-046, DEC-051).
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
