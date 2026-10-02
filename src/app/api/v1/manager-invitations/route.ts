import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse, readJsonBody } from '@/lib/http/responses';
import { inviteManager } from '@/modules/managers';

/**
 * Invitation d'un gestionnaire (MVP-BACKLOG-025, API section 13).
 *
 * ```text
 * POST /api/v1/manager-invitations
 * ```
 *
 * Réservée au propriétaire (DEC-025) : un gestionnaire ou un locataire reçoit 404.
 *
 * La réponse porte le LIEN d'invitation, une seule fois. La base ne conserve que
 * le hachage du jeton, donc le lien ne peut pas être reconstitué ensuite : un lien
 * perdu se renvoie. Aucun envoi automatique n'a lieu au MVP (DEC-026).
 *
 * Aucune règle ici : l'autorisation, la validation et les règles métier vivent
 * dans le module, que la Server Action emprunte aussi (API-001).
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const issued = await inviteManager(getDb(), context, await readJsonBody(request));

    return dataResponse({ invitation: issued.invitation, link: issued.link }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
