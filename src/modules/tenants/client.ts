/**
 * Surface du module Locataires réservée à l'interface.
 *
 * Ce fichier ne réexporte QUE des constantes et des types, jamais le service ni le
 * dépôt. Un composant client qui importerait `index.ts` entraînerait derrière lui
 * le pilote PostgreSQL, ce qu'un navigateur ne doit jamais recevoir.
 */
export type { TenantListFilter, TenantListKind, TenantListStatus } from './constants';
export {
  TENANT_EMAIL_MAX_LENGTH,
  TENANT_LIST_FILTERS,
  TENANT_LIST_STATUSES,
  TENANT_NAME_MAX_LENGTH,
} from './constants';
