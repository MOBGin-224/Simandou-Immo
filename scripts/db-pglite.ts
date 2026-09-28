/**
 * PostgreSQL local SANS Docker, pour une machine où la virtualisation matérielle
 * est indisponible.
 *
 *   npm run db:pglite
 *
 * Sert PGlite, PostgreSQL 17 compilé en WebAssembly, sur le port 5432 du réseau
 * local. L'application, `drizzle-kit` et le seed s'y connectent par la même
 * `DATABASE_URL` que vers un serveur Docker : aucun code applicatif ne sait que
 * le moteur n'est pas un serveur classique.
 *
 * Pourquoi ce script existe (DEC-038) : la machine de développement a Intel VT-x
 * désactivé dans son microprogramme et aucun WSL installé, donc Docker Desktop ne
 * peut pas démarrer sa machine virtuelle. Sans cette porte de sortie, aucun écran
 * du produit ne pourrait être affiché ni vérifié.
 *
 * Ce script ne remplace pas DEC-007. Docker reste la base de développement de
 * référence, et les limites de PGlite consignées par DEC-035 s'appliquent ici
 * telles quelles : extensions, réglages serveur et comportements de concurrence
 * peuvent différer d'un vrai serveur.
 *
 * Ne JAMAIS l'utiliser ailleurs qu'en local : il n'a ni authentification, ni
 * chiffrement, ni sauvegarde.
 */
import { resolve } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

/**
 * Les données vivent sur le disque, dans un dossier ignoré par git.
 *
 * Sans `dataDir`, PGlite travaille en mémoire et tout disparaît à l'arrêt : il
 * faudrait rejouer migration et seed à chaque démarrage, et la moindre donnée
 * saisie à l'écran serait perdue.
 */
const DATA_DIR = resolve(process.cwd(), '.pglite');

const PORT = 5432;
const HOST = '127.0.0.1';

/**
 * UNE seule connexion servie à la fois, et ce n'est pas un réglage de confort.
 *
 * PGlite est un moteur à session unique. Le serveur de socket multiplexe
 * plusieurs connexions clientes sur cette session, mais l'état du protocole
 * étendu, en particulier le « prepared statement » anonyme, appartient à la
 * SESSION. Deux connexions qui préparent puis exécutent en parallèle écrasent
 * donc l'état l'une de l'autre.
 *
 * Symptôme observé le 28/09/2026, au premier chargement d'un écran :
 *
 * ```text
 * bind message supplies 1 parameters, but prepared statement "" requires 2
 * ```
 *
 * La requête était valide, ses paramètres aussi : c'est une autre connexion qui
 * avait remplacé l'instruction entre la préparation et l'exécution. Sérialiser
 * les connexions supprime la course. Le pool applicatif est réglé sur une
 * connexion en développement pour la même raison.
 *
 * Conséquence à connaître : lancer `db:seed` ou `db:studio` pendant que le
 * serveur de développement tourne fait attendre le second arrivé. Arrêter l'un
 * avant l'autre.
 */
const MAX_CONNECTIONS = 1;

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Ce serveur de développement ne doit jamais tourner en production.');
  }

  console.log(`Démarrage de PGlite, données dans ${DATA_DIR}`);

  const db = await PGlite.create({ dataDir: DATA_DIR });
  const server = new PGLiteSocketServer({
    db,
    port: PORT,
    host: HOST,
    maxConnections: MAX_CONNECTIONS,
  });

  await server.start();

  console.log(`PostgreSQL local en écoute sur ${HOST}:${PORT}`);
  console.log(
    'DATABASE_URL attendue : postgresql://simandou:simandou@localhost:5432/simandou_immo',
  );
  console.log('Arrêter avec Ctrl+C. Les données sont conservées.');

  let stopping = false;

  const stop = async (signal: string) => {
    if (stopping) return;
    stopping = true;

    console.log(`\n${signal} reçu, arrêt du serveur...`);

    await server.stop();
    await db.close();

    console.log('Serveur arrêté, données conservées.');
    process.exit(0);
  };

  process.on('SIGINT', () => void stop('SIGINT'));
  process.on('SIGTERM', () => void stop('SIGTERM'));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
