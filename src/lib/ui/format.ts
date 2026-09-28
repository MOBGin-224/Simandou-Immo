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

/**
 * Exposant de sous-unité par devise (DEC-014).
 *
 * La table est portée par le CODE et non par la base, tant qu'une seule devise
 * existe. Le franc guinéen n'a pas de sous-unité : 2 500 000 s'écrit tel quel,
 * sans décimale. Une devise inconnue est traitée comme ayant deux décimales,
 * convention majoritaire, plutôt que de lever une erreur d'affichage.
 */
const MINOR_UNIT_EXPONENTS: Record<string, number> = {
  GNF: 0,
  XOF: 0,
  EUR: 2,
  USD: 2,
};

/**
 * Montant lisible, à partir du couple entier et devise (DEC-014).
 *
 * Le formatage d'affichage est une responsabilité exclusive du frontend : le
 * serveur transmet toujours `{ amount, currency }`, jamais une chaîne déjà mise
 * en forme, qui serait inutilisable par un autre client.
 *
 * Deux espaces différentes, et la distinction compte sur un téléphone. Celle
 * qui groupe les milliers vient d'`Intl`. Celle qui précède la devise est une
 * espace INSÉCABLE posée ici : sans elle, « 2 500 000 » et « GNF » se séparent
 * en fin de ligne, ce qu'une colonne de 360 pixels provoque vite.
 */
export function formatMoney(amount: number, currency: string): string {
  const exponent = MINOR_UNIT_EXPONENTS[currency] ?? 2;
  const value = amount / 10 ** exponent;

  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(value);

  return `${formatted} ${currency}`;
}

/**
 * Surface lisible, en mètres carrés.
 *
 * Les décimales ne sont affichées que lorsqu'elles portent une information :
 * « 78,5 m² » se lit mieux que « 78,50 m² », et « 95 m² » mieux que « 95,00 m² ».
 *
 * L'espace qui précède l'unité est INSÉCABLE, comme celle du montant : « 78,5 »
 * et « m² » ne doivent pas se retrouver sur deux lignes.
 */
export function formatArea(area: number): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(area)} m²`;
}
