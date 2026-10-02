import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { revokeManagerInvitation } from '@/modules/managers';

/**
 * Révocation d'une invitation (SEC-INV-005, DEC-041).
 *
 * ```text
 * POST /api/v1/manager-invitations/:invitationId/revoke
 * ```
 *
 * Annule une invitation qui n'a pas été acceptée : le lien devient inutilisable
 * aussitôt. Une invitation déjà acceptée répond 409 : c'est alors l'ACCÈS du
 * gestionnaire qu'il faut révoquer, ce qui est une autre opération.
 */
export async function POST(
  _request: Request,
  context: RouteContext<'/api/v1/manager-invitations/[invitationId]/revoke'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { invitationId } = await context.params;

    return dataResponse(await revokeManagerInvitation(getDb(), accessContext, invitationId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
