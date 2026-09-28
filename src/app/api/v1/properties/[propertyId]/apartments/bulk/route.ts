import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse, readJsonBody } from '@/lib/http/responses';
import { createApartmentsBulk } from '@/modules/apartments';

/**
 * Création groupée d'appartements (API section 12, parcours 3).
 *
 * ```text
 * POST /api/v1/properties/:propertyId/apartments/bulk
 * ```
 *
 * Elle existe pour l'onboarding d'un immeuble : le parcours 3 refuse d'imposer
 * vingt formulaires complets pour vingt logements. Chaque entrée ne porte que sa
 * référence, le reste se complétant ensuite.
 *
 * L'envoi est atomique : soit tout est créé, soit rien ne l'est. Un conflit de
 * référence refuse donc l'envoi entier, en nommant les références fautives.
 */
export async function POST(
  request: Request,
  context: RouteContext<'/api/v1/properties/[propertyId]/apartments/bulk'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { propertyId } = await context.params;
    const body = await readJsonBody(request);

    const created = await createApartmentsBulk(getDb(), accessContext, propertyId, body);

    return dataResponse(created, { status: 201, meta: { created: created.length } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
