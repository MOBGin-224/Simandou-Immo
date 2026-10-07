import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { resendTenantInvitation } from '@/modules/tenants';

/**
 * Renvoi d'une invitation de locataire (DEC-045, API section 16).
 *
 * ```text
 * POST /api/v1/tenant-invitations/:invitationId/resend
 * ```
 *
 * Régénère le jeton dans la MÊME ligne : même identifiant, ancien lien invalidé
 * aussitôt, durée de validité repartie de zéro. C'est aussi, au MVP, le moyen de
 * récupérer un lien perdu ou périmé (ADR-008).
 *
 * La réponse porte le nouveau lien, une seule fois. Une invitation expirée se
 * renvoie, c'est précisément son usage ; une invitation acceptée, révoquée ou
 * remplacée répond 409.
 *
 * Permission `tenant.invite`.
 */
export async function POST(
  _request: Request,
  context: RouteContext<'/api/v1/tenant-invitations/[invitationId]/resend'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { invitationId } = await context.params;
    const issued = await resendTenantInvitation(getDb(), accessContext, invitationId);

    return dataResponse({ invitation: issued.invitation, link: issued.link });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
