/**
 * Surface du module Contrats réservée à l'interface.
 *
 * Ce fichier ne réexporte QUE des constantes et des types, jamais le service ni le
 * dépôt. Un composant client qui importerait `index.ts` entraînerait derrière lui
 * le pilote PostgreSQL, ce qu'un navigateur ne doit jamais recevoir.
 */
export type { LeaseListFilter, LeaseStatus } from './constants';
export {
  LEASE_AMOUNT_MAX,
  LEASE_DUE_DAY_MAX,
  LEASE_DUE_DAY_MIN,
  LEASE_LIST_FILTERS,
  LEASE_STATUSES,
  LEASE_TERMINATION_REASON_MAX_LENGTH,
} from './constants';
