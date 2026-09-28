import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import {
  apiErrorResponse,
  collectionResponse,
  dataResponse,
  readJsonBody,
} from '@/lib/http/responses';
import { createApartment, listApartments } from '@/modules/apartments';

/**
 * Appartements d'un immeuble (MVP-BACKLOG-021, API section 12).
 *
 * ```text
 * GET  /api/v1/properties/:propertyId/apartments    liste de l'immeuble
 * POST /api/v1/properties/:propertyId/apartments    création
 * ```
 *
 * L'immeuble est dans le CHEMIN et non dans le corps : il est impossible de
 * créer un logement dans un immeuble différent de celui que l'URL désigne, et
 * l'autorisation porte sur cet immeuble-là.
 *
 * Ces routes ne portent AUCUNE règle : elles lisent la requête, appellent le cas
 * d'usage et traduisent le résultat. L'autorisation, la validation et les règles
 * métier vivent dans le module, de sorte qu'une Server Action emprunte exactement
 * le même chemin (API-001).
 */

/** Paramètre de requête, absent plutôt que nul. */
function param(url: URL, name: string): string | undefined {
  return url.searchParams.get(name) ?? undefined;
}

export async function GET(
  request: Request,
  context: RouteContext<'/api/v1/properties/[propertyId]/apartments'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { propertyId } = await context.params;
    const url = new URL(request.url);

    const collection = await listApartments(getDb(), accessContext, propertyId, {
      page: param(url, 'page'),
      pageSize: param(url, 'pageSize'),
      search: param(url, 'search'),
      status: param(url, 'status'),
      includeArchived: param(url, 'includeArchived'),
    });

    return collectionResponse(collection.apartments, collection.meta);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: RouteContext<'/api/v1/properties/[propertyId]/apartments'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { propertyId } = await context.params;
    const body = await readJsonBody(request);

    const apartment = await createApartment(getDb(), accessContext, propertyId, body);

    return dataResponse(apartment, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
