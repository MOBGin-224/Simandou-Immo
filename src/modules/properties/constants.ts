/**
 * Constantes du module Immeubles, SANS aucune dépendance.
 *
 * Ce fichier existe pour une raison précise, apprise à la construction : un
 * composant client qui importait la façade du module tirait avec elle le cas
 * d'usage, le dépôt de données, puis le pilote PostgreSQL, et la compilation
 * échouait en tentant de les embarquer dans le navigateur.
 *
 * Les bornes de saisie sont pourtant nécessaires côté client, pour l'attribut
 * `maxLength` d'un champ. Les isoler ici, sans le moindre import, permet de les
 * partager sans rien entraîner derrière elles. Elles restent définies UNE fois :
 * le serveur valide contre ces mêmes valeurs.
 */

/** Longueurs alignées sur les colonnes de `properties` (Lot 1). */
export const PROPERTY_NAME_MAX_LENGTH = 200;
export const PROPERTY_CITY_MAX_LENGTH = 120;
export const PROPERTY_DISTRICT_MAX_LENGTH = 120;

/**
 * Bornes des colonnes `text`, que PostgreSQL ne limite pas.
 *
 * Une adresse de dix mille caractères n'est pas une adresse : la borne protège la
 * base et l'affichage sans contraindre un usage réel.
 */
export const PROPERTY_ADDRESS_MAX_LENGTH = 500;
export const PROPERTY_DESCRIPTION_MAX_LENGTH = 2000;

/** Ce que la liste affiche : les immeubles actifs, les archivés, ou les deux. */
export const PROPERTY_LIST_FILTERS = ['ACTIVE', 'ARCHIVED', 'ALL'] as const;
export type PropertyListFilter = (typeof PROPERTY_LIST_FILTERS)[number];

/** Borne maximale de pagination imposée par le serveur (API section 44). */
export const PROPERTY_LIST_MAX_PAGE_SIZE = 100;
export const PROPERTY_LIST_DEFAULT_PAGE_SIZE = 20;
