import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { getTenantInvitation } from '@/modules/tenants';

/**
 * Invitation de locataire unique (API section 16).
 *
 * ```text
 * GET /api/v1/tenant-invitations/:invitationId
 * ```
 *
 * `:invitationId` est un `invitations.id`. C'est le second identifiant du double
 * identifiant de DEC-041 : une invitation en attente n'a pas encore d'accès,
 * donc pas encore de `user_access.id`.
 *
 * La réponse ne porte JAMAIS le lien : la base ne conserve que le hachage du
 * jeton (SEC-INV-002), donc il ne peut pas être restitué. Un lien perdu se
 * renvoie, par `/resend`.
 *
 * Permission `tenant.read`, résolue par l'immeuble du logement que l'invitation
 * porte. Un identifiant inconnu, mal formé, d'une invitation de gestionnaire ou
 * hors périmètre répond la MÊME réponse 404 (ADR-007).
 */
export async function GET(
  _request: Request,
  context: RouteContext<'/api/v1/tenant-invitations/[invitationId]'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { invitationId } = await context.params;

    return dataResponse(await getTenantInvitation(getDb(), accessContext, invitationId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
