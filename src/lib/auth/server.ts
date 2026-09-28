import { getDb } from '@/db/client';
import { getEnv } from '@/lib/env';

import { createAuth, type AuthInstance } from './instance';

/**
 * Instance applicative de Better Auth.
 *
 * Réservée au serveur : elle porte la connexion à PostgreSQL et le secret de
 * signature des sessions. Aucun module client ne doit l'importer.
 *
 * Créée au premier usage, pour la même raison que la connexion à la base :
 * importer ce module ne doit pas exiger un environnement complet, sans quoi
 * `next build` échouerait faute de secret.
 *
 * Le code métier n'utilise pas cette instance directement, il passe par
 * `@/lib/auth` (DEC-032). Seuls le service interne et le gestionnaire de route
 * HTTP la connaissent.
 *
 * Note pour le lot Interface : lorsque la connexion se fera par une Server
 * Action et non par un appel au gestionnaire de route, il faudra ajouter le
 * greffon `nextCookies()` de `better-auth/next-js`, en DERNIER dans la liste des
 * greffons, sans quoi le cookie de session ne sera pas posé. Il n'est pas ajouté
 * maintenant, aucun appelant ne l'utilisant encore.
 */
let instance: AuthInstance | undefined;

export function getAuth(): AuthInstance {
  if (!instance) {
    const env = getEnv();

    instance = createAuth({
      database: getDb(),
      secret: env.BETTER_AUTH_SECRET,
      baseURL: env.BETTER_AUTH_URL,
    });
  }

  return instance;
}
