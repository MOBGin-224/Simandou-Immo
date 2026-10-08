/**
 * Surface du module Loyers réservée à l'interface.
 *
 * Ce fichier ne réexporte QUE des constantes et des types, jamais le service ni le
 * dépôt. Un composant client qui importerait `index.ts` entraînerait derrière lui
 * le pilote PostgreSQL, ce qu'un navigateur ne doit jamais recevoir.
 */
export type { ReceivableStatus, RentDisplayStatus, RentListFilter } from './constants';
export {
  OPEN_RECEIVABLE_STATUSES,
  RECEIVABLE_STATUSES,
  RENT_DISPLAY_STATUSES,
  RENT_LIST_FILTERS,
  RENT_LIST_TABS,
} from './constants';
