/**
 * Constantes du module Gestionnaires.
 *
 * Dans un fichier à part parce qu'elles sont aussi exposées à l'interface par
 * `client.ts`, qui ne doit rien entraîner de serveur derrière lui.
 */

/** Longueur maximale du nom d'un gestionnaire, celle de `users.full_name`. */
export const MANAGER_NAME_MAX_LENGTH = 200;

/** Longueur maximale d'une adresse email, celle de `users.email`. */
export const MANAGER_EMAIL_MAX_LENGTH = 320;

/**
 * Nombre maximal d'immeubles attribués dans une même demande.
 *
 * Une borne est nécessaire : sans elle, une requête pourrait porter des milliers
 * d'identifiants, chacun devenant une ligne de périmètre. Cent immeubles couvrent
 * largement un propriétaire réel, et la limite se relève sans migration.
 */
export const MANAGER_PROPERTIES_MAX = 100;

/**
 * Statuts d'un élément de la liste des gestionnaires.
 *
 * Les trois premiers viennent de `user_access.status`. Les deux derniers
 * décrivent une INVITATION encore sans accès : le gestionnaire n'existe pas
 * encore comme tel. `INVITATION_EXPIRED` est dérivé de la date d'expiration
 * (DEC-041), jamais d'une valeur stockée.
 */
export const MANAGER_LIST_STATUSES = [
  'INVITED',
  'INVITATION_EXPIRED',
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
] as const;

export type ManagerListStatus = (typeof MANAGER_LIST_STATUSES)[number];

/** Nature d'un élément de la liste : un accès, ou une invitation en attente. */
export type ManagerListKind = 'ACCESS' | 'INVITATION';
