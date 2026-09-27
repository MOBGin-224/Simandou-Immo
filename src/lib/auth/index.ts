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

/** Session courante, ou `null` si aucune session valable n'est présentée. */
export async function getSession() {
  return internal.resolveSession(getAuth(), await headers());
}

/** Utilisateur courant, ou `null`. */
export async function getCurrentUser() {
  return internal.resolveCurrentUser(getAuth(), await headers());
}

/** Utilisateur courant, ou `UnauthenticatedError`. À préférer dès qu'un accès est protégé. */
export async function requireAuthenticatedUser() {
  return internal.requireUser(getAuth(), await headers());
}

/** Termine la session courante. Sans session, ne fait rien. */
export async function signOut() {
  return internal.endSession(getAuth(), await headers());
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
  return internal.changePassword(getAuth(), await headers(), input);
}

/** Sessions actives de l'utilisateur courant. */
export async function listSessions() {
  return internal.listActiveSessions(getAuth(), await headers());
}

/** Révoque une session précise de l'utilisateur courant. */
export async function revokeSession(token: string) {
  return internal.revokeSession(getAuth(), await headers(), token);
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
