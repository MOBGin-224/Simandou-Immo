/**
 * Numéro de téléphone au format international (DEC-032).
 *
 * Le téléphone est l'identifiant principal du produit : la connexion le compare
 * tel quel à la valeur stockée. Deux écritures d'un même numéro, avec et sans
 * espaces, seraient donc deux identifiants différents, et un invité ne pourrait
 * plus se connecter avec ce qu'il a l'habitude de taper. Un seul format est donc
 * stocké.
 *
 * Le format est l'international, `+` suivi de 8 à 15 chiffres, premier chiffre
 * non nul (norme E.164). Les espaces, points, tirets et parenthèses, que l'on
 * tape naturellement, sont retirés. Le préfixe `00`, usuel pour un appel
 * international, vaut `+`.
 *
 * Aucun indicatif n'est DEVINÉ. Compléter « 620 00 00 00 » en `+224…` serait
 * commode, mais un numéro mal saisi deviendrait alors un numéro valable d'une
 * autre personne, et une invitation partirait vers la mauvaise.
 */
const SEPARATORS = /[\s.\-()]/g;
const INTERNATIONAL = /^\+[1-9]\d{7,14}$/;

/** Numéro normalisé, ou `null` s'il n'est pas un numéro international valable. */
export function normalizePhone(raw: string): string | null {
  const compact = raw.replace(SEPARATORS, '');
  const withPlus = compact.startsWith('00') ? `+${compact.slice(2)}` : compact;

  return INTERNATIONAL.test(withPlus) ? withPlus : null;
}
