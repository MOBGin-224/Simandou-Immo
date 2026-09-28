/**
 * Exécute le seed de développement sur la base désignée par DATABASE_URL.
 *
 *   npm run db:seed
 *
 * Refuse de tourner en production : ce jeu de données est fictif et n'a aucune
 * raison d'atteindre des données réelles.
 */

import { getDb, getRawClient } from '../src/db/client';
import { SEED_IDS, countSeeded, seed } from '../src/db/seed';
import { getAuth } from '../src/lib/auth/server';
import { definePassword } from '../src/lib/auth/session';

/*
 * Charge `.env`, sans quoi ce script ne trouve aucune configuration.
 *
 * Nécessaire et longtemps invisible : Next lit `.env` de lui-même et
 * `drizzle.config.ts` fait le même appel de son côté, mais un script lancé par
 * `tsx` n'hérite de rien. Sans ces lignes, `npm run db:seed` échoue en annonçant
 * quatre variables manquantes alors que le fichier existe. Découvert le
 * 28/09/2026, à la première exécution réelle du seed.
 *
 * Placé APRÈS les imports à dessein, et non avant comme la lecture le
 * suggérerait : les imports d'un module ES sont évalués en premier quoi qu'il
 * arrive, donc les mettre après ne garantirait rien. Ce qui rend l'ordre sûr,
 * c'est qu'aucun de ces modules ne lit l'environnement à son chargement : la
 * connexion et l'instance d'authentification sont créées au premier appel, pas à
 * l'import (voir `src/db/client.ts`). Ne pas remplacer ces fonctions par des
 * constantes de module.
 *
 * L'absence du fichier n'est pas une erreur : les variables peuvent venir de
 * l'environnement.
 */
try {
  process.loadEnvFile('.env');
} catch {
  // .env absent : on s'appuie sur l'environnement déjà en place.
}

/**
 * Mot de passe des comptes de développement.
 *
 * Sans lui, le seed produirait trois utilisateurs actifs incapables de se
 * connecter, et le parcours d'authentification serait inessayable en local. Il
 * est volontairement écrit en clair ici : ce fichier ne tourne jamais en
 * production, et un secret caché dans un jeu de données fictif ne protège rien.
 */
const DEV_PASSWORD = 'simandou-dev-2026';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Le seed de développement ne doit jamais être exécuté en production.');
  }

  console.log('Seed en cours...');
  await seed(getDb());

  console.log('Définition des mots de passe de développement...');
  for (const userId of [SEED_IDS.ownerA, SEED_IDS.managerA, SEED_IDS.ownerB]) {
    await definePassword(getAuth(), { userId, password: DEV_PASSWORD });
  }

  console.log('Lignes présentes après seed :');
  console.table(await countSeeded(getDb()));
  console.log(`Seed terminé. Mot de passe des comptes de développement : ${DEV_PASSWORD}`);
}

main()
  .then(async () => {
    await getRawClient().end();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    await getRawClient()
      .end({ timeout: 5 })
      .catch(() => {});
    process.exit(1);
  });
