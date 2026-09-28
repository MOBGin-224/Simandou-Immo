import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse, readJsonBody } from '@/lib/http/responses';
import { getProperty, updateProperty } from '@/modules/properties';

/**
 * Immeuble unique (MVP-BACKLOG-017, API section 11).
 *
 * ```text
 * GET   /api/v1/properties/:propertyId    consultation
 * PATCH /api/v1/properties/:propertyId    modification partielle
 * ```
 *
 * Aucun DELETE : la suppression physique n'est pas une opération du produit, un
 * immeuble s'archive (API section 65, BR-025).
 *
 * Un identifiant inconnu et un identifiant hors périmètre renvoient tous deux
 * 404 : la distinction révélerait l'existence de données d'une autre organisation.
 */
export async function GET(
  _request: Request,
  context: RouteContext<'/api/v1/properties/[propertyId]'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { propertyId } = await context.params;

    return dataResponse(await getProperty(getDb(), accessContext, propertyId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<'/api/v1/properties/[propertyId]'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { propertyId } = await context.params;
    const body = await readJsonBody(request);

    return dataResponse(await updateProperty(getDb(), accessContext, propertyId, body));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
