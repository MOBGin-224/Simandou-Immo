import { getDb } from '@/db/client';
import { getCurrentUser, hashPassword, signInSession } from '@/lib/auth';
import { redirectWithCookies } from '@/lib/http/redirect';
import { apiErrorResponse, dataResponse, readJsonBody } from '@/lib/http/responses';
import { invitationPath } from '@/modules/invitations';
import {
  InvitationInvalidError,
  InvitationLoginRequiredError,
  ManagerValidationError,
  acceptManagerInvitation,
  type AcceptedInvitation,
} from '@/modules/managers';
import { passwordConfirmationError } from '@/modules/managers/form';

/**
 * Acceptation d'une invitation de gestionnaire (MVP-BACKLOG-025, API section 14).
 *
 * ```text
 * POST /api/v1/invitations/:token/accept
 * ```
 *
 * Route PUBLIQUE : le jeton est la seule preuve. Elle sert deux appelants.
 *
 *   JSON      l'enveloppe habituelle, `{ "password": "…" }`
 *   formulaire  la page d'activation, qui doit fonctionner SANS JavaScript : la
 *             réponse est une redirection, cookies de session compris
 *
 * La page passe par ici plutôt que par une Server Action pour la même raison que
 * la connexion : une route écrit ses propres en-têtes, donc pose le cookie de
 * session sans greffon supplémentaire.
 *
 * **Un lien ne définit JAMAIS le mot de passe d'un compte déjà actif.** Pour un
 * tel compte, la route exige une session de ce compte et ne lit aucun mot de
 * passe : c'est le cas d'usage qui l'impose, pas cette route.
 *
 * Une session est ouverte après l'activation d'un NOUVEAU compte (parcours 5,
 * étape 6). Un compte déjà actif a déjà la sienne.
 */

/** Code d'erreur porté par l'URL du formulaire, jamais le message brut. */
type FormFailure = 'mot-de-passe' | 'confirmation' | 'connexion';

export async function POST(
  request: Request,
  context: RouteContext<'/api/v1/invitations/[token]/accept'>,
): Promise<Response> {
  const { token } = await context.params;
  const wantsJson = (request.headers.get('content-type') ?? '').includes('application/json');

  const backToPage = (failure?: FormFailure) =>
    redirectWithCookies(
      request,
      failure ? `${invitationPath(token)}?erreur=${failure}` : invitationPath(token),
      [],
    );

  try {
    const user = await getCurrentUser();
    let password: unknown;

    if (wantsJson) {
      const body = await readJsonBody(request);

      password =
        typeof body === 'object' && body !== null
          ? (body as { password?: unknown }).password
          : undefined;
    } else {
      const form = await request.formData();

      // La confirmation n'existe que dans le formulaire : elle protège d'une faute
      // de frappe sur un secret qu'on ne voit pas, et ne fait pas partie du contrat
      // de l'API. Elle se contrôle AVANT l'acceptation : un lien n'est pas consommé
      // pour une faute de frappe.
      if (passwordConfirmationError(form) !== null) return backToPage('confirmation');

      password = form.get('password');
    }

    const accepted = await acceptManagerInvitation(
      getDb(),
      { hashPassword },
      { token, password, sessionUserId: user?.id ?? null },
    );

    // Un compte qui vient d'être activé n'a pas encore de session : on l'ouvre.
    const cookies = await openSession(accepted, password);

    if (wantsJson) {
      const response = dataResponse(accepted);

      for (const cookie of cookies) response.headers.append('set-cookie', cookie);

      return response;
    }

    return redirectWithCookies(request, '/immeubles', cookies);
  } catch (error) {
    if (wantsJson) return apiErrorResponse(error);

    // Lien inutilisable : la page l'affichera elle-même, sans rien en dire de plus.
    if (error instanceof InvitationInvalidError) return backToPage();
    if (error instanceof InvitationLoginRequiredError) return backToPage('connexion');
    if (error instanceof ManagerValidationError) return backToPage('mot-de-passe');

    return apiErrorResponse(error);
  }
}

/**
 * Cookies d'une nouvelle session, après l'activation d'un compte.
 *
 * Vide pour un compte qui était déjà actif : il a déjà sa session. Un échec
 * d'ouverture ne défait pas l'activation, déjà validée : l'invité n'a qu'à se
 * connecter, avec le mot de passe qu'il vient de définir.
 */
async function openSession(accepted: AcceptedInvitation, password: unknown): Promise<string[]> {
  if (!accepted.activatedAccount || accepted.phone === null || typeof password !== 'string') {
    return [];
  }

  try {
    const { cookies } = await signInSession({ phone: accepted.phone, password });

    return [...cookies];
  } catch {
    return [];
  }
}
