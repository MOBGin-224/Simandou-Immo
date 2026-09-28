/**
 * Constantes du module Appartements, SANS aucune dépendance.
 *
 * Même motif que pour les immeubles : un composant client qui importerait la
 * façade du module entraînerait derrière elle le cas d'usage, le dépôt de
 * données puis le pilote PostgreSQL, et la compilation échouerait en tentant de
 * les embarquer dans le navigateur. Les bornes de saisie sont pourtant
 * nécessaires côté client pour l'attribut `maxLength` d'un champ.
 *
 * Elles restent définies UNE fois : le serveur valide contre ces mêmes valeurs.
 */

/** Longueurs alignées sur les colonnes de `apartments` (Lot 1). */
export const APARTMENT_NUMBER_MAX_LENGTH = 30;
export const APARTMENT_TYPE_MAX_LENGTH = 60;

/**
 * Bornes de l'étage.
 *
 * Le sous-sol existe, donc le négatif est recevable. La borne haute n'a pas de
 * fondement réglementaire : elle écarte une saisie manifestement erronée sans
 * contraindre un usage réel, aucun immeuble de Conakry n'approchant ce chiffre.
 */
export const APARTMENT_FLOOR_MIN = -5;
export const APARTMENT_FLOOR_MAX = 200;

/**
 * Bornes de la surface, en mètres carrés.
 *
 * La colonne est `numeric(10, 2)` avec une contrainte `area > 0` : la borne
 * haute protège surtout contre une virgule mal placée, qui ferait d'un
 * appartement de 78 m² un logement de 7 800 m².
 */
export const APARTMENT_AREA_MAX = 100_000;
export const APARTMENT_AREA_DECIMALS = 2;

/**
 * Borne du loyer de référence, exprimée dans la plus petite unité (DEC-014).
 *
 * Pour le GNF, l'exposant de sous-unité est 0 : la borne vaut donc mille
 * milliards de francs guinéens. Elle n'a qu'un rôle, écarter une saisie
 * aberrante avant qu'elle n'atteigne la base.
 */
export const APARTMENT_RENT_MAX = 1_000_000_000_000;

/** Statuts d'occupation (DEC-019). `ARCHIVED` n'en fait pas partie (DEC-020). */
export const APARTMENT_STATUSES = ['VACANT', 'OCCUPIED', 'MAINTENANCE'] as const;
export type ApartmentStatus = (typeof APARTMENT_STATUSES)[number];

/** Ce que la liste affiche : un statut précis, ou tous. */
export const APARTMENT_LIST_FILTERS = ['ALL', ...APARTMENT_STATUSES] as const;
export type ApartmentListFilter = (typeof APARTMENT_LIST_FILTERS)[number];

/** Borne maximale de pagination imposée par le serveur (API section 44). */
export const APARTMENT_LIST_MAX_PAGE_SIZE = 100;
export const APARTMENT_LIST_DEFAULT_PAGE_SIZE = 20;

/**
 * Borne de la création groupée (API section 12).
 *
 * Le parcours 3 cite un immeuble de vingt appartements ; cent laisse de la marge
 * pour une grande résidence tout en gardant la transaction courte et le message
 * d'erreur lisible. Au-delà, plusieurs envois restent possibles.
 */
export const APARTMENT_BULK_MAX = 100;
