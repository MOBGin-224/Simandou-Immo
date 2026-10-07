/**
 * Constantes du module Locataires.
 *
 * Dans un fichier à part parce qu'elles sont aussi exposées à l'interface par
 * `client.ts`, qui ne doit rien entraîner de serveur derrière lui.
 */

/** Longueur maximale du nom d'un locataire, celle de `users.full_name`. */
export const TENANT_NAME_MAX_LENGTH = 200;

/** Longueur maximale d'une adresse email, celle de `users.email`. */
export const TENANT_EMAIL_MAX_LENGTH = 320;

/**
 * Statuts d'un élément de la liste des locataires (DEC-046).
 *
 * Les trois derniers viennent de `user_access.status`. Les deux premiers
 * décrivent une INVITATION encore sans accès : la personne n'a pas encore
 * d'espace locataire. `INVITATION_EXPIRED` est dérivé de la date d'expiration
 * (DEC-041), jamais d'une valeur stockée.
 *
 * Le statut entier est DÉRIVÉ, jamais stocké : il se lit de l'invitation et de
 * l'accès. Aucune colonne ne le porte, et c'est voulu : deux sources de vérité
 * pour un même état finissent par se contredire.
 */
export const TENANT_LIST_STATUSES = [
  'INVITED',
  'INVITATION_EXPIRED',
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
] as const;

export type TenantListStatus = (typeof TENANT_LIST_STATUSES)[number];

/** Nature d'un élément de la liste : un accès, ou une invitation en attente. */
export type TenantListKind = 'ACCESS' | 'INVITATION';

/** Ce que la liste affiche : un statut précis, ou tous. */
export const TENANT_LIST_FILTERS = ['ALL', ...TENANT_LIST_STATUSES] as const;
export type TenantListFilter = (typeof TENANT_LIST_FILTERS)[number];

/** Borne maximale de pagination imposée par le serveur (API section 44). */
export const TENANT_LIST_MAX_PAGE_SIZE = 100;
export const TENANT_LIST_DEFAULT_PAGE_SIZE = 20;
