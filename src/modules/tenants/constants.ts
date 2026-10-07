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
 * Statuts d'un locataire (DEC-046, DEC-051).
 *
 * Le statut entier est DÉRIVÉ, jamais stocké : il se lit de l'invitation, de
 * l'accès et du bail. Aucune colonne ne le porte, et c'est voulu : deux sources
 * de vérité pour un même état finissent par se contredire.
 *
 * ```text
 * NO_ACCESS           locataire SANS acces au produit : il occupe un logement et
 *                     n'utilisera peut-etre jamais l'application (DEC-051)
 * INVITED             invitation ouverte, pas encore acceptee
 * INVITATION_EXPIRED  invitation ouverte dont la date est passee (DEC-041)
 * ACTIVE              acces ouvert et fonctionnel
 * SUSPENDED           acces bloque, perimetre conserve (DEC-047)
 * REVOKED             acces retire. Ne termine aucun bail (DEC-047)
 * ```
 *
 * **Ne pas confondre `NO_ACCESS` et `REVOKED`.** Le premier n'a jamais eu de
 * compte, le second en avait un qu'on lui a retiré. La différence compte pour qui
 * lit la liste : l'un est un état normal, l'autre une décision.
 */
export const TENANT_LIST_STATUSES = [
  'NO_ACCESS',
  'INVITED',
  'INVITATION_EXPIRED',
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
] as const;

export type TenantListStatus = (typeof TENANT_LIST_STATUSES)[number];

/** Ce que la liste affiche : un statut précis, ou tous. */
export const TENANT_LIST_FILTERS = ['ALL', ...TENANT_LIST_STATUSES] as const;
export type TenantListFilter = (typeof TENANT_LIST_FILTERS)[number];

/** Borne maximale de pagination imposée par le serveur (API section 44). */
export const TENANT_LIST_MAX_PAGE_SIZE = 100;
export const TENANT_LIST_DEFAULT_PAGE_SIZE = 20;
