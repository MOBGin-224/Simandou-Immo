import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { getEnv } from '@/lib/env';

import * as schema from './schema';

/**
 * Connexion à PostgreSQL pour le code applicatif.
 *
 * Réservée au serveur. Aucun module client ne doit l'importer : la chaîne de
 * connexion est un secret, et le frontend ne décide jamais d'un accès aux
 * données (ADR-001, ADR-007).
 *
 * L'instance est mise en cache sur l'objet global afin qu'un rechargement à
 * chaud en développement n'ouvre pas une connexion de plus à chaque
 * modification de fichier, ce qui finirait par saturer le pool.
 */
const globalForDb = globalThis as unknown as {
  simandouDbClient?: ReturnType<typeof postgres>;
};

function createClient() {
  const { DATABASE_URL, NODE_ENV } = getEnv();

  return postgres(DATABASE_URL, {
    // En serverless, chaque instance sert peu de requêtes simultanées : un pool
    // large gaspillerait des connexions côté Supabase.
    max: NODE_ENV === 'production' ? 5 : 2,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

const client = globalForDb.simandouDbClient ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.simandouDbClient = client;
}

export const db = drizzle(client, {
  schema,
  // Les identifiants TypeScript sont en camelCase, les colonnes en snake_case.
  // Doit rester identique à drizzle.config.ts, sinon les requêtes visent des
  // colonnes inexistantes.
  casing: 'snake_case',
});

export type Database = typeof db;
export { client as rawClient };
