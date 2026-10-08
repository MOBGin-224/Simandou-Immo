/**
 * Constantes du module Loyers.
 *
 * Dans un fichier à part parce qu'elles sont aussi exposées à l'interface par
 * `client.ts`, qui ne doit rien entraîner de serveur derrière lui.
 */

/**
 * Statuts de `receivable_status` (DEC-015, BR-037).
 *
 * Énumération PARTAGÉE par les deux créances du MVP, loyer et charge : aucun
 * `rent_status` n'existe, et le Lot 10 lira cette même liste plutôt que d'en
 * écrire une seconde. Elle est déclarée ici parce que la créance de loyer est la
 * première à naître ; le jour où les charges arrivent, sa place naturelle est un
 * module commun aux deux.
 *
 * « À venir » n'y figure pas : c'est une dérivation d'affichage, jamais une
 * valeur stockée. Voir `RENT_DISPLAY_STATUSES`.
 */
export const RECEIVABLE_STATUSES = [
  'UNPAID',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'CANCELLED',
] as const;
export type ReceivableStatus = (typeof RECEIVABLE_STATUSES)[number];

/**
 * Ce qu'une créance OUVERTE veut dire (BR-039).
 *
 * Le total dû d'un locataire est la somme des soldes de ces trois statuts, et
 * d'eux seuls : une créance payée ne doit plus rien, une créance annulée n'a
 * jamais rien dû. Défini une fois ici parce que la liste, le total dû et le
 * compteur de l'écran doivent tous les trois s'accorder.
 */
export const OPEN_RECEIVABLE_STATUSES = ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] as const;

/**
 * Statut tel que l'interface le LIT, c'est-à-dire avec « À venir » (BR-037).
 *
 * `UPCOMING` remplace `UNPAID` quand l'échéance n'est pas encore due. Il n'est
 * pas stocké, et la base n'en connaît pas l'existence.
 */
export const RENT_DISPLAY_STATUSES = ['UPCOMING', ...RECEIVABLE_STATUSES] as const;
export type RentDisplayStatus = (typeof RENT_DISPLAY_STATUSES)[number];

/**
 * Filtres acceptés par la liste.
 *
 * Deux familles. Les COMPOSITES d'abord, qui regroupent plusieurs statuts et
 * répondent aux questions qu'on se pose vraiment : qui me doit de l'argent,
 * qu'est-ce qui arrive, qu'est-ce qui est soldé. Puis chaque statut BRUT, pour
 * que le filtre `status` de l'API section 18 accepte exactement les valeurs
 * qu'elle documente.
 */
export const RENT_LIST_FILTERS = [
  'ALL',
  'OUTSTANDING',
  'UPCOMING',
  ...RECEIVABLE_STATUSES,
] as const;
export type RentListFilter = (typeof RENT_LIST_FILTERS)[number];

/**
 * Onglets de l'écran, dans leur ordre d'affichage.
 *
 * Quatre et non huit : `OVERDUE` est un sous-ensemble de `OUTSTANDING` et se lit
 * déjà sur chaque ligne par son badge, un onglet de plus n'apprendrait rien.
 * `CANCELLED` et les statuts intermédiaires restent atteignables par l'URL, ce
 * qui suffit à un cas rare.
 */
export const RENT_LIST_TABS = [
  'OUTSTANDING',
  'UPCOMING',
  'PAID',
  'ALL',
] as const satisfies readonly RentListFilter[];

/** Borne maximale de pagination imposée par le serveur (API section 44). */
export const RENT_LIST_MAX_PAGE_SIZE = 100;
export const RENT_LIST_DEFAULT_PAGE_SIZE = 20;

/**
 * Nombre maximal d'échéances qu'une seule génération peut créer.
 *
 * Garde-fou d'exploitation, pas une règle métier : une génération porte sur une
 * période et sur les baux actifs du périmètre, donc son volume est borné par le
 * nombre de logements loués. La borne existe pour qu'une erreur de périmètre ou
 * de date ne produise pas une écriture de masse, et DEC-028 interdit de toute
 * façon un traitement long dans une requête interactive.
 */
export const RENT_GENERATION_MAX_INSTALLMENTS = 500;
