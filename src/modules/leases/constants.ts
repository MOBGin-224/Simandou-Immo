/**
 * Constantes du module Contrats.
 *
 * Dans un fichier à part parce qu'elles sont aussi exposées à l'interface par
 * `client.ts`, qui ne doit rien entraîner de serveur derrière lui.
 */

/**
 * Statuts de `lease_status` (DEC-021).
 *
 * `DRAFT` et `CANCELLED` ne sont pas atteints au MVP : aucun document ne donne
 * de comportement de brouillon à un bail, et les routes documentées sont la
 * création, la consultation, la modification et la clôture. Ils restent dans
 * l'énumération, figée d'emblée pour les lots suivants.
 */
export const LEASE_STATUSES = ['DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED'] as const;
export type LeaseStatus = (typeof LEASE_STATUSES)[number];

/** Ce que la liste affiche : un statut précis, ou tous. */
export const LEASE_LIST_FILTERS = ['ALL', ...LEASE_STATUSES] as const;
export type LeaseListFilter = (typeof LEASE_LIST_FILTERS)[number];

/** Borne maximale de pagination imposée par le serveur (API section 44). */
export const LEASE_LIST_MAX_PAGE_SIZE = 100;
export const LEASE_LIST_DEFAULT_PAGE_SIZE = 20;

/**
 * Jour du mois où le loyer est dû.
 *
 * La borne haute est 31 et non 28 : le produit n'invente pas de règle de
 * report pour les mois courts, ce qui appartiendra à la génération des
 * échéances, au Lot 9. Le contrat enregistre ce que les parties ont convenu.
 */
export const LEASE_DUE_DAY_MIN = 1;
export const LEASE_DUE_DAY_MAX = 31;

/**
 * Borne haute d'un montant, exprimée dans la plus petite unité (DEC-014).
 *
 * La même que le loyer de référence d'un appartement, `APARTMENT_RENT_MAX` :
 * mille milliards de francs guinéens, l'exposant de sous-unité du GNF étant
 * zéro. Comparer un loyer de contrat à un loyer de référence ne doit pas buter
 * sur deux bornes différentes.
 *
 * Une borne est nécessaire : sans elle, une faute de frappe sur le nombre de
 * zéros passerait sans bruit et contaminerait toutes les échéances à venir.
 */
export const LEASE_AMOUNT_MAX = 1_000_000_000_000;

/** Longueur maximale de la raison de clôture, celle de la colonne. */
export const LEASE_TERMINATION_REASON_MAX_LENGTH = 200;
