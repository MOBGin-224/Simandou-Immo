import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse, readJsonBody } from '@/lib/http/responses';
import { getApartment, updateApartment } from '@/modules/apartments';

/**
 * Appartement unique (MVP-BACKLOG-021, API section 12).
 *
 * ```text
 * GET   /api/v1/apartments/:apartmentId    consultation
 * PATCH /api/v1/apartments/:apartmentId    modification partielle
 * ```
 *
 * L'identifiant suffit ici, sans l'immeuble : un appartement n'appartient qu'à
 * un seul immeuble (BR-026), que le cas d'usage retrouve et contrôle. Répéter
 * l'immeuble dans l'URL n'ajouterait rien et ouvrirait la question d'un couple
 * incohérent.
 *
 * Aucun DELETE : la suppression physique n'est pas une opération du produit
 * (API section 65, BR-025, DEC-020).
 *
 * Un identifiant inconnu et un identifiant hors périmètre renvoient tous deux
 * 404 : la distinction révélerait l'existence de données d'une autre
 * organisation.
 */
export async function GET(
  _request: Request,
  context: RouteContext<'/api/v1/apartments/[apartmentId]'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { apartmentId } = await context.params;

    return dataResponse(await getApartment(getDb(), accessContext, apartmentId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<'/api/v1/apartments/[apartmentId]'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { apartmentId } = await context.params;
    const body = await readJsonBody(request);

    return dataResponse(await updateApartment(getDb(), accessContext, apartmentId, body));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
