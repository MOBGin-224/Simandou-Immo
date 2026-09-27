import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { archiveProperty } from '@/modules/properties';

/**
 * Archivage d'un immeuble (MVP-BACKLOG-017, BR-025, API section 65).
 *
 * ```text
 * POST /api/v1/properties/:propertyId/archive
 * ```
 *
 * Un verbe métier plutôt qu'un DELETE : l'immeuble sort de l'exploitation, son
 * historique reste intact. Réservé au propriétaire (DEC-025).
 *
 * Un second archivage répond 409 plutôt qu'un succès silencieux : l'interface
 * doit pouvoir dire ce qui s'est passé.
 */
export async function POST(
  _request: Request,
  context: RouteContext<'/api/v1/properties/[propertyId]/archive'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { propertyId } = await context.params;

    return dataResponse(await archiveProperty(getDb(), accessContext, propertyId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
