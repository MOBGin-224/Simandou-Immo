import { timingSafeEqual } from 'node:crypto';

/**
 * Porte d'entrée des routes internes `/internal/*` (DEC-028).
 *
 * La décision pose trois exigences, et celle-ci en tient la première : « toute
 * route `/internal/*` est inaccessible publiquement ». Les deux autres,
 * l'idempotence et la journalisation, appartiennent aux services de job.
 *
 * **Le refus est un 404, jamais un 401 ni un 403.** Répondre « non autorisé »
 * confirmerait qu'une route de job existe à cette adresse, et renseignerait
 * gratuitement qui cherche la surface interne du produit. C'est la même règle
 * que pour une ressource hors périmètre (ADR-008) : un refus ne distingue rien.
 *
 * **Fermé par défaut.** Secret absent, et la route refuse tout, y compris un
 * appel qui ne présente aucun en-tête. Une route de job ouverte parce que sa
 * configuration est incomplète serait exactement la faille que la décision
 * ferme ; en production, `getEnv` refuse d'ailleurs de démarrer sans ce secret.
 *
 * **Le secret est reçu en PARAMÈTRE et non lu ici.** Ce module reste ainsi pur,
 * donc éprouvable sans environnement complet : c'est le seul contrôle qui
 * protège les jobs, et un test qui exige une base de données pour tourner est un
 * test qu'on finit par ne plus lancer. La route, elle, le prend de `getEnv`.
 *
 * **Comparaison à temps constant.** Un `===` sur une chaîne s'arrête au premier
 * caractère différent, ce qui laisse mesurer la longueur du préfixe correct et
 * reconstruire le secret octet par octet. La fonction compare donc des tampons
 * de même taille.
 */

/** Réponse opposée à tout appel non authentifié d'une route interne. */
export function internalJobNotFound(): Response {
  return new Response(null, { status: 404 });
}

/**
 * Compare deux secrets sans révéler où ils diffèrent.
 *
 * Les tampons de longueurs différentes sont refusés avant l'appel à
 * `timingSafeEqual`, qui lève sur des tailles inégales. La longueur du secret
 * attendu n'est pas un secret utile : elle est bornée par la validation
 * d'environnement, qui en exige au moins trente-deux caractères.
 */
function secretMatches(presented: string, expected: string): boolean {
  const a = Buffer.from(presented, 'utf8');
  const b = Buffer.from(expected, 'utf8');

  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

/**
 * L'appel présente-t-il le secret interne ?
 *
 * L'en-tête attendu est `Authorization: Bearer <secret>`, qui est celui que les
 * Cron Jobs de la plateforme envoient : aucun en-tête maison à configurer d'un
 * côté et à oublier de l'autre.
 */
export function isAuthorizedInternalJob(
  request: Request,
  expectedSecret: string | undefined,
): boolean {
  if (expectedSecret === undefined) return false;

  const header = request.headers.get('authorization');

  if (header === null) return false;

  const [scheme, ...rest] = header.split(' ');

  if (scheme?.toLowerCase() !== 'bearer') return false;

  return secretMatches(rest.join(' '), expectedSecret);
}
