import { signOutSession } from '@/lib/auth';
import { safeNextPath } from '@/lib/http/next-path';
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

  /*
   * Un invité connecté avec un AUTRE compte que celui de son invitation doit se
   * déconnecter, puis se connecter avec le bon : sans mémoire de sa destination, il
   * perdrait le chemin de son invitation. Comme à la connexion, la destination est
   * limitée à une liste fermée (`safeNextPath`) : toute autre valeur est ignorée.
   *
   * Le formulaire de l'en-tête n'envoie aucun champ : la lecture échoue alors sans
   * conséquence, et la déconnexion se fait quand même.
   */
  const form = await request.formData().catch(() => null);
  const next = safeNextPath(form?.get('suivant'));

  return redirectWithCookies(
    request,
    next ? `/connexion?suivant=${encodeURIComponent(next)}` : '/connexion',
    cookies,
  );
}
