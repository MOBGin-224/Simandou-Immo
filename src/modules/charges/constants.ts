/**
 * Constantes du module Charges (Database Schema sections 28 et 29, DEC-029).
 *
 * Dans un fichier à part parce qu'elles sont aussi exposées à l'interface par
 * `client.ts`, qui ne doit rien entraîner de serveur derrière lui.
 *
 * Les statuts de CRÉANCE ne sont pas ici : ils sont communs au loyer et à la
 * charge (DEC-015) et vivent donc dans le module Créances, que celui-ci lit.
 */

/**
 * Natures de charge (section 29).
 *
 * Liste destinée à s'ÉTENDRE sans changement de logique, donc `text` plus
 * contrainte CHECK en base et non énumération PostgreSQL (DEC-021) : ajouter
 * « ascenseur » ou « internet » ne touche ni le calcul, ni le cycle de vie, ni
 * les écrans. `tests/charges/schema.test.ts` confronte cette liste à la
 * contrainte de la base, valeur par valeur.
 */
export const CHARGE_TYPES = ['WATER', 'ELECTRICITY', 'SECURITY', 'CLEANING', 'OTHER'] as const;
export type ChargeType = (typeof CHARGE_TYPES)[number];

/**
 * Libellé français d'une nature de charge.
 *
 * Il vit dans le module et non dans `src/lib/ui/labels.ts`, à la différence des
 * rôles, parce qu'il ne sert pas qu'à l'interface : le libellé de créance que
 * l'API transmet, « Eau septembre 2026 » (section 18), se compose à partir de
 * lui. Deux sources finiraient par nommer la même charge de deux façons, l'une
 * sur l'écran et l'autre dans une quittance.
 *
 * Les libellés sont choisis pour se lire SUIVIS D'UN MOIS, puisque c'est leur
 * emploi principal : « Entretien commun septembre 2026 », « Autre charge
 * septembre 2026 ».
 */
export const CHARGE_TYPE_LABELS: Record<ChargeType, string> = {
  WATER: 'Eau',
  ELECTRICITY: 'Électricité',
  SECURITY: 'Gardiennage',
  CLEANING: 'Entretien commun',
  OTHER: 'Autre charge',
};

/**
 * Statuts d'une charge (section 28).
 *
 * Distincts de ceux de ses créances, et c'est le cœur du lot : une charge
 * `DRAFT` existe et ne doit rien à personne, c'est la PUBLICATION qui crée des
 * créances payables (DEC-005, BR-052).
 */
export const CHARGE_STATUSES = ['DRAFT', 'PUBLISHED', 'CANCELLED'] as const;
export type ChargeStatus = (typeof CHARGE_STATUSES)[number];

/**
 * Méthodes de répartition (DEC-029).
 *
 * `EQUAL` seule au MVP. `CUSTOM` et `CONSUMPTION` sont hors périmètre et ne
 * figurent donc ni dans l'énumération PostgreSQL, ni ici : une méthode offerte
 * mais non calculée produirait des créances fausses.
 */
export const ALLOCATION_METHODS = ['EQUAL'] as const;
export type AllocationMethod = (typeof ALLOCATION_METHODS)[number];

/**
 * Filtres acceptés par la liste des charges (API section 30).
 *
 * Les trois statuts, plus `ALL`. Aucun composite à la différence des loyers :
 * une charge n'a pas de situation financière propre, c'est sa place dans son
 * cycle de vie qu'on filtre, et les trois états sont déjà la question posée.
 */
export const CHARGE_LIST_FILTERS = ['ALL', ...CHARGE_STATUSES] as const;
export type ChargeListFilter = (typeof CHARGE_LIST_FILTERS)[number];

/**
 * Onglets de l'écran, dans leur ordre d'affichage.
 *
 * « Publiées » en premier parce que ce sont les seules qui doivent de l'argent,
 * donc celles qu'on vient consulter. Les brouillons suivent : ils attendent une
 * décision, et c'est la seule file d'attente du lot.
 */
export const CHARGE_LIST_TABS = [
  'PUBLISHED',
  'DRAFT',
  'CANCELLED',
  'ALL',
] as const satisfies readonly ChargeListFilter[];

/** Borne maximale de pagination imposée par le serveur (API section 44). */
export const CHARGE_LIST_MAX_PAGE_SIZE = 100;
export const CHARGE_LIST_DEFAULT_PAGE_SIZE = 20;

/**
 * Montant total maximal d'une charge, en unités de la devise.
 *
 * Même borne que le loyer de référence d'un appartement : mille milliards de
 * francs guinéens. Ce n'est pas une règle métier mais un garde-fou de saisie,
 * un zéro de trop sur une facture d'eau se réclamant ensuite à douze
 * locataires.
 */
export const CHARGE_TOTAL_AMOUNT_MAX = 1_000_000_000_000;

/** Longueur maximale du nom de fournisseur, alignée sur la colonne. */
export const CHARGE_SUPPLIER_NAME_MAX_LENGTH = 120;
