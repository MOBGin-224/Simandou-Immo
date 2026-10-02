import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { archiveApartment } from '@/modules/apartments';

/**
 * Archivage d'un appartement (DEC-039, BR-025, API section 65).
 *
 * ```text
 * POST /api/v1/apartments/:apartmentId/archive
 * ```
 *
 * Un verbe métier plutôt qu'un DELETE : le logement sort de l'exploitation, son
 * historique reste intact. Réservé au propriétaire, confirmé le 28 septembre
 * 2026, pour le même motif patrimonial que l'archivage d'un immeuble.
 *
 * Un second archivage répond 409 plutôt qu'un succès silencieux : l'interface
 * doit pouvoir dire ce qui s'est passé.
 */
export async function POST(
  _request: Request,
  context: RouteContext<'/api/v1/apartments/[apartmentId]/archive'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { apartmentId } = await context.params;

    return dataResponse(await archiveApartment(getDb(), accessContext, apartmentId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
