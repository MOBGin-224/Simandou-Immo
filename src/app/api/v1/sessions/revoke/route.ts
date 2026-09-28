import { signOutSession } from '@/lib/auth';
import { redirectWithCookies } from '@/lib/http/redirect';

/**
 * Fermeture de la session courante.
 *
 * ```text
 * POST /api/v1/sessions/revoke
 * ```
 *
 * Un verbe métier plutôt qu'un DELETE, comme partout ailleurs dans cette API
 * (section 65). Et un POST, jamais un GET : une déconnexion modifie l'état du
 * serveur, et un lien serait déclenché par un préchargement de navigateur, ce qui
 * déconnecterait l'utilisateur au survol.
 *
 * Idempotent : sans session, la redirection a lieu quand même. Un utilisateur qui
 * clique deux fois ne doit pas voir d'erreur.
 */
export async function POST(request: Request): Promise<Response> {
  const cookies = await signOutSession();

  return redirectWithCookies(request, '/connexion', cookies);
}
