/**
 * Formatage d'affichage.
 *
 * Le serveur transmet des dates ISO 8601 (API section 71) et c'est la couche de
 * présentation qui les met en forme. Le fuseau est explicite : sans lui, une date
 * s'afficherait dans le fuseau du serveur, qui est celui de l'hébergeur et non
 * celui de l'utilisateur. La Guinée est à GMT+0 et n'observe pas d'heure d'été
 * (MVP-ENG-012).
 */
const TIME_ZONE = 'Africa/Conakry';

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  timeZone: TIME_ZONE,
});

/** Date lisible, par exemple « 27 septembre 2026 ». */
export function formatDate(isoDate: string): string {
  return DATE_FORMAT.format(new Date(isoDate));
}

/**
 * Accord du pluriel français.
 *
 * « 1 logement » et « 2 logements » : afficher « 1 logements » signale un produit
 * négligé, et cette fonction supprime la tentation de l'ignorer.
 */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count > 1 ? plural : singular}`;
}
