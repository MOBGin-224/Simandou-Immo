/**
 * Surface du module Gestionnaires réservée à l'interface.
 *
 * Ce fichier ne réexporte QUE des constantes et des types, jamais le service ni le
 * dépôt. Un composant client qui importerait `index.ts` entraînerait derrière lui
 * le pilote PostgreSQL, ce qu'un navigateur ne doit jamais recevoir.
 */
export type { ManagerListKind, ManagerListStatus } from './constants';
export {
  MANAGER_EMAIL_MAX_LENGTH,
  MANAGER_LIST_STATUSES,
  MANAGER_NAME_MAX_LENGTH,
  MANAGER_PROPERTIES_MAX,
} from './constants';
