import { previewPublicInvitation } from '@/app/invitation/flow';
import { getCurrentUser } from '@/lib/auth';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';

/**
 * Aperçu d'une invitation, pour la page d'activation (API section 14).
 *
 * ```text
 * GET /api/v1/invitations/:token
 * ```
 *
 * Route PUBLIQUE : le jeton est la seule preuve. Elle ne modifie RIEN, de sorte
 * qu'un aperçu chargé par un navigateur ou par un lecteur de liens ne brûle pas
 * l'invitation.
 *
 * La réponse est ORIENTÉE SELON LE RÔLE porté par l'invitation (DEC-046) : elle
 * porte un champ `role`, puis la forme correspondante, les immeubles confiés pour
 * un gestionnaire, le logement pour un locataire. Un jeton d'un rôle que
 * l'appelant n'attendait pas reste indiscernable d'un jeton inconnu.
 *
 * Toute invitation inutilisable, inconnue, expirée, révoquée ou déjà acceptée,
 * reçoit la MÊME réponse 404 (ADR-008).
 *
 * La session éventuelle sert uniquement à dire à l'invité ce qu'il doit faire :
 * définir un mot de passe, confirmer, ou se connecter avec son compte.
 */
export async function GET(
  _request: Request,
  context: RouteContext<'/api/v1/invitations/[token]'>,
): Promise<Response> {
  try {
    const { token } = await context.params;
    const user = await getCurrentUser();

    return dataResponse(await previewPublicInvitation({ token, sessionUserId: user?.id ?? null }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
