import { getDb } from '@/db/client';
import { getCurrentUser } from '@/lib/auth';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { previewInvitation } from '@/modules/managers';

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

    return dataResponse(
      await previewInvitation(getDb(), { token, sessionUserId: user?.id ?? null }),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
