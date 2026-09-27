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
 * Volontairement exposée par des FONCTIONS et non par des constantes. Importer
 * ce fichier ne doit ni lire l'environnement ni ouvrir une connexion, pour une
 * raison très concrète : `next build` charge chaque route afin d'en collecter
 * les métadonnées. Avec une constante de module, construire l'application
 * exigerait une `DATABASE_URL` et un secret de session valides, et la CI
 * échouerait faute de `.env`. Une compilation n'a pas besoin d'une base de
 * données.
 *
 * L'instance est mise en cache afin qu'un rechargement à chaud en développement
 * n'ouvre pas une connexion de plus à chaque modification de fichier, ce qui
 * finirait par saturer le pool.
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

let client: ReturnType<typeof postgres> | undefined;

/** Client bas niveau. Utile pour fermer proprement la connexion d'un script. */
export function getRawClient(): ReturnType<typeof postgres> {
  client ??= globalForDb.simandouDbClient ?? createClient();

  if (process.env.NODE_ENV !== 'production') {
    globalForDb.simandouDbClient = client;
  }

  return client;
}

function createDatabase() {
  return drizzle(getRawClient(), {
    schema,
    // Les identifiants TypeScript sont en camelCase, les colonnes en snake_case.
    // Doit rester identique à drizzle.config.ts, sinon les requêtes visent des
    // colonnes inexistantes.
    casing: 'snake_case',
  });
}

export type Database = ReturnType<typeof createDatabase>;

let database: Database | undefined;

/** Accès Drizzle applicatif, créé au premier usage. */
export function getDb(): Database {
  database ??= createDatabase();
  return database;
}
