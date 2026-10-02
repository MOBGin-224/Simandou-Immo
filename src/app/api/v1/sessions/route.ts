import { AccountNotActiveError, InvalidCredentialsError, signInSession } from '@/lib/auth';
import { safeNextPath } from '@/lib/http/next-path';
import { redirectWithCookies } from '@/lib/http/redirect';

/**
 * Ouverture de session depuis le formulaire de connexion (DEC-032, ADR-006).
 *
 * ```text
 * POST /api/v1/sessions
 * ```
 *
 * Pourquoi un gestionnaire de route et non une Server Action : le formulaire doit
 * fonctionner SANS JavaScript, et une route écrit ses propres en-têtes, donc pose
 * le cookie de session sans greffon supplémentaire. C'est l'entrée la plus simple
 * qui tienne debout, et elle reste vraie si l'écran devient interactif plus tard.
 *
 * Better Auth expose déjà ses propres points d'entrée sous `/api/auth`, mais ils
 * attendent du JSON là où un formulaire HTML envoie un corps encodé. Cette route
 * est l'adaptateur entre les deux, et rien d'autre.
 *
 * En cas d'échec, redirection vers le formulaire avec un CODE dans l'URL, jamais
 * le message brut : l'écran décide de sa formulation, et aucun détail technique ne
 * transite par la barre d'adresse.
 */
const CONNEXION_PATH = '/connexion';

export async function POST(request: Request): Promise<Response> {
  const form = await request.formData();
  const phone = String(form.get('phone') ?? '').trim();
  const password = String(form.get('password') ?? '');

  // Destination demandée, limitée à une liste fermée : un lien d'invitation, pour
  // l'invité qui a déjà un compte. Toute autre valeur est ignorée (`safeNextPath`).
  const next = safeNextPath(form.get('suivant'));

  // L'échec conserve la destination : l'invité qui se trompe de mot de passe ne
  // doit pas perdre le chemin de son invitation.
  const refuse = (code: string) =>
    redirectWithCookies(
      request,
      `${CONNEXION_PATH}?erreur=${code}${next ? `&suivant=${encodeURIComponent(next)}` : ''}`,
      [],
    );

  if (phone.length === 0 || password.length === 0) return refuse('champs-manquants');

  try {
    const { cookies } = await signInSession({ phone, password });

    return redirectWithCookies(request, next ?? '/immeubles', cookies);
  } catch (error) {
    if (error instanceof InvalidCredentialsError) return refuse('identifiants');
    if (error instanceof AccountNotActiveError) return refuse('compte-inactif');

    // Toute autre erreur est technique : la traduire en « identifiants
    // invalides » ferait chercher un mot de passe pendant une panne.
    throw error;
  }
}
