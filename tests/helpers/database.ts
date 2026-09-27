import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { resolve } from 'node:path';

import * as schema from '../../src/db/schema';

/**
 * Base PostgreSQL éphémère pour les tests.
 *
 * PGlite est PostgreSQL compilé en WebAssembly, exécuté dans le processus de
 * test. Deux bénéfices concrets :
 *
 *   1. les tests appliquent la VRAIE migration, donc les contraintes CHECK, les
 *      clés étrangères et les énumérations sont réellement vérifiées, et non
 *      simulées par des doublures ;
 *   2. aucun serveur n'est requis, ni en local ni en CI.
 *
 * Ce n'est pas un remplacement du PostgreSQL de développement, qui reste Docker
 * (DEC-007). Un comportement dépendant d'une extension ou d'un réglage serveur
 * doit être validé sur le vrai moteur.
 */
export type TestDatabase = Awaited<ReturnType<typeof createTestDatabase>>;

export async function createTestDatabase() {
  const pglite = new PGlite();
  const db = drizzle(pglite, { schema, casing: 'snake_case' });

  await migrate(db, {
    migrationsFolder: resolve(process.cwd(), 'src/db/migrations'),
  });

  return {
    db,
    schema,
    async close() {
      await pglite.close();
    },
  };
}
