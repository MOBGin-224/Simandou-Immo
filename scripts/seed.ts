/**
 * Exécute le seed de développement sur la base désignée par DATABASE_URL.
 *
 *   npm run db:seed
 *
 * Refuse de tourner en production : ce jeu de données est fictif et n'a aucune
 * raison d'atteindre des données réelles.
 */
import { db, rawClient } from '../src/db/client';
import { countSeeded, seed } from '../src/db/seed';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Le seed de développement ne doit jamais être exécuté en production.');
  }

  console.log('Seed en cours...');
  await seed(db);

  console.log('Lignes présentes après seed :');
  console.table(await countSeeded(db));
  console.log('Seed terminé.');
}

main()
  .then(async () => {
    await rawClient.end();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    await rawClient.end({ timeout: 5 }).catch(() => {});
    process.exit(1);
  });
