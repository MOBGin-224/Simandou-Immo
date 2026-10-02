import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { resendManagerInvitation } from '@/modules/managers';

/**
 * Renvoi d'une invitation (MVP-BACKLOG-025, API section 13, BR-013).
 *
 * ```text
 * POST /api/v1/manager-invitations/:invitationId/resend
 * ```
 *
 * Régénère le jeton dans la MÊME invitation : l'ancien lien devient invalide à
 * l'instant de l'écriture, et la durée de validité repart de zéro. C'est aussi le
 * mécanisme de récupération d'un lien perdu ou périmé (ADR-008).
 *
 * Refusé (409) pour une invitation acceptée, révoquée ou remplacée. Un
 * identifiant inconnu, mal formé ou d'une autre organisation répond 404.
 */
export async function POST(
  _request: Request,
  context: RouteContext<'/api/v1/manager-invitations/[invitationId]/resend'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { invitationId } = await context.params;
    const issued = await resendManagerInvitation(getDb(), accessContext, invitationId);

    return dataResponse({ invitation: issued.invitation, link: issued.link });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
