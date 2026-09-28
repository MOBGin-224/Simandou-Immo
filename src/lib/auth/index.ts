import { headers } from 'next/headers';

import { getAuth } from './server';
import * as internal from './session';

/**
 * Service d'authentification du produit (DEC-032, ADR-006).
 *
 * C'est la SEULE surface que le code métier importe. Elle ne fait qu'une chose :
 * lier les fonctions de `session.ts` à l'instance applicative et aux en-têtes de
 * la requête Next en cours. Toute la logique, donc tout ce qui se teste, vit
 * dans `session.ts`.
 *
 * Réservé au serveur : `next/headers` n'existe pas côté client.
 */

export type { AuthenticatedSession, AuthenticatedUser, SignInResult } from './session';

export {
  AccountNotActiveError,
  InvalidCredentialsError,
  UnauthenticatedError,
  WeakPasswordError,
} from './session';

export { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from './instance';

/*
 * ORDRE D'APPEL, à ne pas réécrire par souci de concision.
 *
 * Chaque fonction ci-dessous lit les en-têtes AVANT de résoudre l'instance. Écrit
 * en une ligne, `internal.f(getAuth(), await headers())` évalue `getAuth()`
 * d'abord, donc lit l'environnement avant que `headers()` ait signalé à Next que
 * le rendu est dynamique. Conséquence observée à la construction du Lot 4 :
 * `next build` tentait de pré-rendre l'écran de connexion et échouait faute de
 * `DATABASE_URL`, alors qu'une compilation n'a besoin d'aucune base.
 *
 * Deux lignes plutôt qu'une, et la compilation n'exige plus aucun secret.
 */

/** Session courante, ou `null` si aucune session valable n'est présentée. */
export async function getSession() {
  const requestHeaders = await headers();

  return internal.resolveSession(getAuth(), requestHeaders);
}

/** Utilisateur courant, ou `null`. */
export async function getCurrentUser() {
  const requestHeaders = await headers();

  return internal.resolveCurrentUser(getAuth(), requestHeaders);
}

/** Utilisateur courant, ou `UnauthenticatedError`. À préférer dès qu'un accès est protégé. */
export async function requireAuthenticatedUser() {
  const requestHeaders = await headers();

  return internal.requireUser(getAuth(), requestHeaders);
}

/** Termine la session courante. Sans session, ne fait rien. */
export async function signOut() {
  const requestHeaders = await headers();

  return internal.endSession(getAuth(), requestHeaders);
}

/** Connexion par téléphone et mot de passe. */
export async function signIn(input: { phone: string; password: string }) {
  return internal.signInWithPhone(getAuth(), input);
}

/**
 * Change le mot de passe de l'utilisateur courant.
 *
 * Renvoie le jeton de la nouvelle session lorsque les autres sessions ont été
 * révoquées, ce qui est le cas par défaut.
 */
export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  revokeOtherSessions?: boolean;
}) {
  const requestHeaders = await headers();

  return internal.changePassword(getAuth(), requestHeaders, input);
}

/** Sessions actives de l'utilisateur courant. */
export async function listSessions() {
  const requestHeaders = await headers();

  return internal.listActiveSessions(getAuth(), requestHeaders);
}

/** Révoque une session précise de l'utilisateur courant. */
export async function revokeSession(token: string) {
  const requestHeaders = await headers();

  return internal.revokeSession(getAuth(), requestHeaders, token);
}

/**
 * Définit ou remplace le mot de passe d'un utilisateur, sans session.
 *
 * Primitive de l'activation de compte. L'appelant doit avoir prouvé le droit de
 * le faire : jeton d'invitation valide, ou décision d'un utilisateur autorisé
 * (ADR-008, DEC-026).
 */
export async function definePassword(input: { userId: string; password: string }) {
  return internal.definePassword(getAuth(), input);
}

export type { SignInSessionResult } from './session';

/**
 * Connexion pour un formulaire HTML : renvoie les cookies à poser.
 *
 * À préférer à `signIn` dans un gestionnaire de route, qui doit transmettre le
 * cookie de session au navigateur.
 */
export async function signInSession(input: { phone: string; password: string }) {
  return internal.signInWithPhoneSession(getAuth(), input);
}

/** Déconnexion pour un formulaire HTML : renvoie les cookies d'effacement. */
export async function signOutSession() {
  const requestHeaders = await headers();

  return internal.endSessionWithCookies(getAuth(), requestHeaders);
}
