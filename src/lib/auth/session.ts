import type { User } from '@/db/schema';

import { CREDENTIAL_PROVIDER_ID, MIN_PASSWORD_LENGTH, type AuthInstance } from './instance';

/**
 * Service d'authentification interne (DEC-032, ADR-006).
 *
 * Le code métier n'appelle jamais Better Auth : il appelle ces fonctions. Trois
 * raisons concrètes, et non un principe abstrait.
 *
 *   1. La forme exposée est la nôtre. Better Auth renvoie un utilisateur nommé
 *      `name` et `phoneNumber` ; notre domaine parle de `fullName` et `phone`.
 *      Sans cette frontière, la correspondance fuirait dans chaque appelant.
 *   2. Le statut métier est contrôlé ici, à un seul endroit. Un compte suspendu
 *      ou archivé n'est jamais authentifié, même avec une session encore
 *      valide.
 *   3. Remplacer la bibliothèque resterait un chantier local.
 *
 * Chaque fonction prend son instance et ses en-têtes en paramètre : c'est ce qui
 * rend ce service testable sans serveur HTTP. La liaison à Next est faite par
 * `service.ts`, qui est la surface que le code métier importe.
 */

/** Utilisateur authentifié, tel que le code métier le voit. */
export type AuthenticatedUser = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: User['status'];
};

/** Session active, réduite à ce dont le code métier a besoin. */
export type AuthenticatedSession = {
  user: AuthenticatedUser;
  sessionId: string;
  token: string;
  expiresAt: Date;
};

/** Levée lorsqu'une opération protégée est atteinte sans session valable. */
export class UnauthenticatedError extends Error {
  constructor() {
    super("Authentification requise : aucune session valide n'a été présentée.");
    this.name = 'UnauthenticatedError';
  }
}

/** Levée lorsqu'un mot de passe ne respecte pas la politique minimale. */
export class WeakPasswordError extends Error {
  constructor() {
    super(`Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`);
    this.name = 'WeakPasswordError';
  }
}

/**
 * Session courante, ou `null`.
 *
 * Renvoie `null` dans quatre cas qu'il serait dangereux de distinguer côté
 * appelant : aucun cookie, session expirée, session révoquée, ou utilisateur
 * dont le statut métier ne permet plus d'agir.
 *
 * Le refus d'un compte non ACTIF est la garantie qu'une session déjà ouverte ne
 * survit pas à une suspension. Révoquer la ligne au passage serait une écriture
 * sur un chemin de lecture très fréquenté : c'est à l'opération qui suspend ou
 * révoque un accès de supprimer les sessions concernées, ce refus restant le
 * filet de sécurité si elle l'omet.
 */
export async function resolveSession(
  auth: AuthInstance,
  headers: Headers,
): Promise<AuthenticatedSession | null> {
  const result = await auth.api.getSession({ headers });

  if (!result) return null;

  const { user, session } = result;

  if (user.archivedAt) return null;
  if (user.status !== 'ACTIVE') return null;

  return {
    user: {
      id: user.id,
      fullName: user.name,
      phone: user.phoneNumber ?? null,
      email: user.email ?? null,
      status: user.status,
    },
    sessionId: session.id,
    token: session.token,
    expiresAt: session.expiresAt,
  };
}

/** Utilisateur courant, ou `null`. */
export async function resolveCurrentUser(
  auth: AuthInstance,
  headers: Headers,
): Promise<AuthenticatedUser | null> {
  const session = await resolveSession(auth, headers);
  return session?.user ?? null;
}

/**
 * Utilisateur courant, ou échec.
 *
 * À utiliser dans toute opération protégée : l'oubli d'un `if (!user)` devient
 * impossible, puisque le chemin non authentifié ne renvoie rien.
 */
export async function requireUser(
  auth: AuthInstance,
  headers: Headers,
): Promise<AuthenticatedUser> {
  const user = await resolveCurrentUser(auth, headers);

  if (!user) throw new UnauthenticatedError();

  return user;
}

/** Termine la session courante. Idempotent : sans session, ne fait rien. */
export async function endSession(auth: AuthInstance, headers: Headers): Promise<void> {
  const session = await auth.api.getSession({ headers });

  if (!session) return;

  await auth.api.signOut({ headers });
}

/**
 * Change le mot de passe de l'utilisateur courant.
 *
 * Le mot de passe actuel est exigé : sans lui, un cookie volé suffirait à
 * s'approprier définitivement un compte.
 *
 * Les autres sessions sont révoquées par défaut, un changement de mot de passe
 * étant presque toujours la réaction à un doute sur la confidentialité du
 * compte.
 *
 * Renvoie alors le jeton de la NOUVELLE session. Better Auth supprime en effet
 * toutes les sessions de l'utilisateur, celle de l'appelant comprise, puis en
 * crée une autre. Ignorer ce jeton déconnecterait l'utilisateur juste après
 * qu'il a changé son mot de passe, sans message et sans raison visible. Par le
 * gestionnaire de route HTTP, le navigateur reçoit le nouveau cookie de
 * lui-même ; ailleurs, c'est à l'appelant de rétablir la session.
 */
export async function changePassword(
  auth: AuthInstance,
  headers: Headers,
  input: { currentPassword: string; newPassword: string; revokeOtherSessions?: boolean },
): Promise<{ token: string | null }> {
  if (input.newPassword.length < MIN_PASSWORD_LENGTH) throw new WeakPasswordError();

  await requireUser(auth, headers);

  const result = await auth.api.changePassword({
    headers,
    body: {
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
      revokeOtherSessions: input.revokeOtherSessions ?? true,
    },
  });

  return { token: result.token ?? null };
}

/** Sessions actives de l'utilisateur courant. */
export async function listActiveSessions(
  auth: AuthInstance,
  headers: Headers,
): Promise<{ id: string; token: string; expiresAt: Date; createdAt: Date }[]> {
  await requireUser(auth, headers);

  const sessions = await auth.api.listSessions({ headers });

  return sessions.map((session) => ({
    id: session.id,
    token: session.token,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
  }));
}

/**
 * Révoque une session précise de l'utilisateur courant.
 *
 * Better Auth restreint la révocation aux sessions de l'appelant : personne ne
 * peut déconnecter autrui avec cette fonction.
 */
export async function revokeSession(
  auth: AuthInstance,
  headers: Headers,
  token: string,
): Promise<void> {
  await requireUser(auth, headers);

  await auth.api.revokeSession({ headers, body: { token } });
}

/**
 * Définit ou remplace le mot de passe d'un utilisateur, sans session.
 *
 * C'est la primitive de l'activation de compte : l'invité arrive avec un lien,
 * pas avec un mot de passe, donc pas avec une session (ADR-008, DEC-026). Le
 * parcours d'invitation qui l'appellera est hors périmètre de ce lot ; sans
 * cette primitive, aucun compte ne pourrait jamais se connecter.
 *
 * Ne vérifie aucune autorisation : c'est à l'appelant d'avoir prouvé le droit de
 * le faire, par un jeton d'invitation valide ou une décision d'un utilisateur
 * autorisé.
 */
export async function definePassword(
  auth: AuthInstance,
  input: { userId: string; password: string },
): Promise<void> {
  if (input.password.length < MIN_PASSWORD_LENGTH) throw new WeakPasswordError();

  const context = await auth.$context;
  const hash = await context.password.hash(input.password);
  const existing = await context.internalAdapter.findCredentialAccount(input.userId);

  if (existing) {
    await context.internalAdapter.updateAccount(existing.id, { password: hash });
    return;
  }

  await context.internalAdapter.createAccount({
    userId: input.userId,
    providerId: CREDENTIAL_PROVIDER_ID,
    // Pour un mot de passe, Better Auth utilise l'identifiant de l'utilisateur
    // comme identifiant de compte chez le « fournisseur ».
    accountId: input.userId,
    password: hash,
  });
}

/**
 * Hache un mot de passe selon la politique du produit, sans rien écrire.
 *
 * Première moitié de l'activation d'un compte dans une transaction (DEC-041) : le
 * hachage est lent par construction, il se calcule donc AVANT d'ouvrir la
 * transaction, pour ne pas tenir de verrous pendant qu'il s'exécute. La seconde
 * moitié est `writeCredential`, qui écrit ce hachage dans la transaction de
 * l'appelant.
 *
 * Applique la même politique que `definePassword`, longueur minimale comprise.
 */
export async function hashPassword(auth: AuthInstance, password: string): Promise<string> {
  if (password.length < MIN_PASSWORD_LENGTH) throw new WeakPasswordError();

  const context = await auth.$context;

  return context.password.hash(password);
}

/** Levée lorsque le couple téléphone et mot de passe ne correspond à rien. */
export class InvalidCredentialsError extends Error {
  constructor() {
    super('Identifiants invalides.');
    this.name = 'InvalidCredentialsError';
  }
}

/**
 * Levée lorsque les identifiants sont corrects mais que le compte ne peut pas
 * agir : suspendu, archivé, ou pas encore activé.
 *
 * Distinguer ce cas ne divulgue rien : on ne l'atteint qu'après avoir fourni le
 * bon mot de passe. Et le taire enfermerait un gestionnaire suspendu devant un
 * message d'identifiants invalides, sans moyen de comprendre.
 */
export class AccountNotActiveError extends Error {
  constructor() {
    super("Ce compte n'est pas actif.");
    this.name = 'AccountNotActiveError';
  }
}

export type SignInResult = {
  token: string;
  user: AuthenticatedUser;
};

/** Lit le code d'erreur d'une réponse de Better Auth, sans en importer le type. */
function apiErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;

  const body = (error as { body?: unknown }).body;

  if (typeof body !== 'object' || body === null) return undefined;

  const code = (body as { code?: unknown }).code;

  return typeof code === 'string' ? code : undefined;
}

/**
 * Connexion par téléphone et mot de passe (DEC-032).
 *
 * Le jeton renvoyé est celui de la session créée. En applicatif, le cookie est
 * posé par le gestionnaire de route ; ce retour sert les appels serveur et les
 * tests.
 *
 * Toute erreur inattendue est relancée telle quelle : traduire une base
 * indisponible en « identifiants invalides » ferait chercher un problème de mot
 * de passe pendant une panne.
 */
export async function signInWithPhone(
  auth: AuthInstance,
  input: { phone: string; password: string },
): Promise<SignInResult> {
  try {
    const result = await auth.api.signInPhoneNumber({
      body: { phoneNumber: input.phone, password: input.password },
    });

    return {
      token: result.token,
      user: {
        id: result.user.id,
        fullName: result.user.name,
        phone: result.user.phoneNumber ?? null,
        email: result.user.email ?? null,
        // Nécessairement ACTIF : le hook de création de session refuse tout
        // autre statut, donc ce chemin serait passé par le `catch`.
        status: 'ACTIVE',
      },
    };
  } catch (error) {
    switch (apiErrorCode(error)) {
      // Le compte existe et le mot de passe est bon, mais le hook de création
      // de session a refusé : statut non ACTIF ou compte archivé.
      case 'FAILED_TO_CREATE_SESSION':
        throw new AccountNotActiveError();

      case 'INVALID_PHONE_NUMBER_OR_PASSWORD':
      case 'INVALID_PHONE_NUMBER':
      case 'PASSWORD_TOO_LONG':
        throw new InvalidCredentialsError();

      default:
        throw error;
    }
  }
}

/**
 * Lit le code d'erreur du CORPS d'une réponse de Better Auth.
 *
 * Distinct de `apiErrorCode`, qui lit une exception : avec `asResponse`, un échec
 * n'est pas levé mais renvoyé comme réponse HTTP.
 */
async function responseErrorCode(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();

    if (typeof body !== 'object' || body === null) return undefined;

    const code = (body as { code?: unknown }).code;

    return typeof code === 'string' ? code : undefined;
  } catch {
    return undefined;
  }
}

/** Session créée, avec les en-têtes `Set-Cookie` qui la matérialisent. */
export type SignInSessionResult = {
  user: AuthenticatedUser;
  /** À recopier tels quels dans la réponse de la route appelante. */
  cookies: string[];
};

/**
 * Connexion destinée à un formulaire HTML (DEC-032).
 *
 * Pourquoi cette fonction en plus de `signInWithPhone` : un formulaire a besoin
 * du COOKIE de session, pas du jeton. Le cookie est signé, il n'est donc pas égal
 * au jeton, et le reconstruire à la main produirait une session que la production
 * ne reconnaîtrait pas. Passer par `asResponse` récupère exactement l'en-tête que
 * la bibliothèque aurait posé.
 *
 * Better Auth reste confiné à ce module : la route appelante ne voit que des
 * chaînes de cookies à recopier (DEC-032).
 *
 * Le greffon `nextCookies()` n'est toujours pas nécessaire : il sert à poser un
 * cookie depuis une Server Action, où les en-têtes ne sont pas accessibles. Un
 * gestionnaire de route, lui, écrit ses en-têtes lui-même.
 */
export async function signInWithPhoneSession(
  auth: AuthInstance,
  input: { phone: string; password: string },
): Promise<SignInSessionResult> {
  const response = await auth.api.signInPhoneNumber({
    body: { phoneNumber: input.phone, password: input.password },
    asResponse: true,
  });

  if (!response.ok) {
    switch (await responseErrorCode(response)) {
      case 'FAILED_TO_CREATE_SESSION':
        throw new AccountNotActiveError();

      case 'INVALID_PHONE_NUMBER_OR_PASSWORD':
      case 'INVALID_PHONE_NUMBER':
      case 'PASSWORD_TOO_LONG':
        throw new InvalidCredentialsError();

      default:
        throw new InvalidCredentialsError();
    }
  }

  const body: unknown = await response.json();
  const user = (body as { user?: Record<string, unknown> }).user ?? {};

  return {
    user: {
      id: String(user.id ?? ''),
      fullName: String(user.name ?? ''),
      phone: typeof user.phoneNumber === 'string' ? user.phoneNumber : null,
      email: typeof user.email === 'string' ? user.email : null,
      // Nécessairement ACTIF : le hook de création de session refuse tout autre
      // statut, donc ce chemin serait passé par le refus ci-dessus.
      status: 'ACTIVE',
    },
    cookies: response.headers.getSetCookie(),
  };
}

/**
 * Déconnexion destinée à un formulaire HTML.
 *
 * Renvoie les cookies d'EFFACEMENT. Sans eux, la session serait révoquée côté
 * serveur mais le navigateur conserverait son cookie, et l'utilisateur verrait un
 * écran de connexion alors qu'il se croit encore connecté.
 *
 * Idempotent : sans session, il n'y a rien à révoquer et la liste est vide.
 */
export async function endSessionWithCookies(
  auth: AuthInstance,
  headers: Headers,
): Promise<string[]> {
  const session = await auth.api.getSession({ headers });

  if (!session) return [];

  const response = await auth.api.signOut({ headers, asResponse: true });

  return response.headers.getSetCookie();
}
