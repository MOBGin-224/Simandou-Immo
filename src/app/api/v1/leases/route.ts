import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import {
  apiErrorResponse,
  collectionResponse,
  dataResponse,
  readJsonBody,
} from '@/lib/http/responses';
import { createLease, listLeases } from '@/modules/leases';

/**
 * Baux (API section 17, MVP-BACKLOG-032 et 034).
 *
 * ```text
 * GET  /api/v1/leases    liste du périmètre, filtrable
 * POST /api/v1/leases    création
 * ```
 *
 * Le corps de la création porte le logement, le locataire, la période, le loyer,
 * le jour d'échéance et la caution. **Ni organisation ni immeuble** : ils se
 * déduisent du logement, et les recevoir de l'appelant ouvrirait la porte à un
 * couple incohérent.
 *
 * Deux refus en 409 lui sont propres : le logement a déjà un bail en cours
 * (BR-028), ou la personne a déjà une relation locative active dans
 * l'organisation (DEC-049). Le message dit lequel, car la correction diffère.
 *
 * Permissions `lease.read` et `lease.create`, propriétaire comme gestionnaire,
 * chacun sur son périmètre. Un locataire consulte SON contrat par son espace :
 * la liste lui répond 404, son rattachement étant lui-même et non un immeuble
 * (BR-021).
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const url = new URL(request.url);

    const collection = await listLeases(getDb(), context, {
      page: url.searchParams.get('page') ?? undefined,
      pageSize: url.searchParams.get('pageSize') ?? undefined,
      propertyId: url.searchParams.get('propertyId'),
      apartmentId: url.searchParams.get('apartmentId'),
      tenantId: url.searchParams.get('tenantId'),
      status: url.searchParams.get('status') ?? undefined,
    });

    return collectionResponse(collection.leases, collection.meta);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const created = await createLease(getDb(), context, await readJsonBody(request));

    return dataResponse(created, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
