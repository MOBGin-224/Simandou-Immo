import { createAuth, type AuthInstance } from '../../src/lib/auth/instance';
import type { TestDatabase } from './database';

/**
 * Instance Better Auth réelle, branchée sur la base de test.
 *
 * Rien n'est simulé : c'est la configuration applicative, sur le vrai schéma et
 * la vraie migration. Un test qui passe ici prouve donc que l'authentification
 * fonctionne contre PostgreSQL, et pas contre une doublure complaisante.
 */
export function createTestAuth(database: TestDatabase['db']): AuthInstance {
  return createAuth({
    database,
    // Sans valeur: le secret n'a pas besoin d'être réaliste, seulement assez
    // long pour que la validation et la signature des cookies fonctionnent.
    secret: 'secret-de-test-suffisamment-long-pour-signer-les-sessions',
    baseURL: 'http://localhost:3000',
  });
}

/**
 * Connexion réelle, dont on récupère le cookie de session.
 *
 * Passer par `asResponse` est volontaire : le cookie posé par Better Auth est
 * signé, il n'est pas égal au jeton renvoyé par la connexion. Reconstruire
 * l'en-tête à la main testerait une session que la production ne verrait jamais.
 */
export async function signInHeaders(
  auth: AuthInstance,
  input: { phone: string; password: string },
): Promise<Headers> {
  const response = await auth.api.signInPhoneNumber({
    body: { phoneNumber: input.phone, password: input.password },
    asResponse: true,
  });

  if (!response.ok) {
    throw new Error(`Connexion de test refusée : ${response.status} ${await response.text()}`);
  }

  return toCookieHeaders(response);
}

/** Transforme les `Set-Cookie` d'une réponse en en-tête `Cookie` de requête. */
export function toCookieHeaders(response: Response): Headers {
  const cookies = response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');

  return new Headers({ cookie: cookies });
}
