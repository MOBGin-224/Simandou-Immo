/**
 * Constantes communes aux DEUX créances du MVP (DEC-005, DEC-015).
 *
 * **Pourquoi ce module existe.** Le loyer et la charge sont deux créances
 * payables distinctes, et c'est une décision verrouillée (DEC-005). Elles
 * partagent en revanche un seul cycle de statut (DEC-015), une seule définition
 * de « créance ouverte » (BR-039), une seule dérivation « À venir » (BR-037) et
 * un seul total dû (BR-055). Ces règles n'appartiennent donc ni au module
 * Loyers, ni au module Charges : les écrire dans l'un des deux obligerait
 * l'autre à en dépendre, et les écrire deux fois les laisserait diverger.
 *
 * Le commentaire de `rents/constants.ts`, écrit au Lot 9, annonçait exactement
 * ce déplacement : « le jour où les charges arrivent, sa place naturelle est un
 * module commun aux deux ». Le module Loyers réexporte ces listes sous leurs
 * noms d'origine, pour que rien de ce qui les lit n'ait eu à changer.
 *
 * Fichier à part du reste du module, et PUR : il est exposé à l'interface par
 * `client.ts`, qui ne doit rien entraîner de serveur derrière lui.
 */

/**
 * Statuts de `receivable_status` (DEC-015, BR-037).
 *
 * Énumération PARTAGÉE par le loyer et la charge. Aucun `rent_status` ni
 * `charge_receivable_status` n'existe : une créance de charge a exactement les
 * mêmes états qu'une échéance de loyer, ce qui est la condition pour qu'un
 * paiement puisse les solder indifféremment (DEC-022).
 *
 * « À venir » n'y figure pas : c'est une dérivation d'affichage, jamais une
 * valeur stockée. Voir `RECEIVABLE_DISPLAY_STATUSES`.
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
 * jamais rien dû. Défini une fois ici parce que les deux listes, les deux
 * totaux et les compteurs des écrans doivent tous s'accorder.
 */
export const OPEN_RECEIVABLE_STATUSES = ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] as const;

/**
 * Statut tel que l'interface le LIT, c'est-à-dire avec « À venir » (BR-037).
 *
 * `UPCOMING` remplace `UNPAID` quand l'échéance n'est pas encore due. Il n'est
 * pas stocké, et la base n'en connaît pas l'existence.
 */
export const RECEIVABLE_DISPLAY_STATUSES = ['UPCOMING', ...RECEIVABLE_STATUSES] as const;
export type ReceivableDisplayStatus = (typeof RECEIVABLE_DISPLAY_STATUSES)[number];

/**
 * Filtres acceptés par les listes de créances, loyers comme charges.
 *
 * Deux familles. Les COMPOSITES d'abord, qui regroupent plusieurs statuts et
 * répondent aux questions qu'on se pose vraiment : qui me doit de l'argent,
 * qu'est-ce qui arrive, qu'est-ce qui est soldé. Puis chaque statut BRUT, pour
 * que les filtres `status` des sections 18 et 30 acceptent exactement les
 * valeurs qu'elles documentent.
 *
 * `UPCOMING` est un filtre et non un statut : il se traduit en `UNPAID` plus une
 * comparaison de date, parce que « À venir » n'est pas stocké (BR-037).
 */
export const RECEIVABLE_LIST_FILTERS = [
  'ALL',
  'OUTSTANDING',
  'UPCOMING',
  ...RECEIVABLE_STATUSES,
] as const;
export type ReceivableListFilter = (typeof RECEIVABLE_LIST_FILTERS)[number];

/**
 * Les deux natures de créance du MVP (DEC-005, API section 18).
 *
 * `kind` identifie le type d'une créance dans les payloads de total dû et
 * d'allocation. Il n'est stocké nulle part : il est porté par la TABLE d'où la
 * créance vient, et `payment_allocations` le reprendra sous forme de deux clés
 * étrangères mutuellement exclusives (DEC-022), jamais d'une colonne de type.
 */
export const RECEIVABLE_KINDS = ['RENT', 'CHARGE'] as const;
export type ReceivableKind = (typeof RECEIVABLE_KINDS)[number];
