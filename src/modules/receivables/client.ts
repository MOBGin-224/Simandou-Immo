/**
 * Surface du module Créances réservée à ce qui ne doit rien entraîner de
 * serveur.
 *
 * Ce fichier ne réexporte QUE des constantes, des types et des fonctions PURES.
 * Il est lu par l'interface, mais aussi par les modules Loyers et Charges, qui
 * partagent ces règles : passer par `index.ts` leur ferait charger le calcul du
 * total dû, et donc le pilote PostgreSQL, dans un composant client.
 */
export type {
  ReceivableDisplayStatus,
  ReceivableKind,
  ReceivableListFilter,
  ReceivableStatus,
} from './constants';
export {
  OPEN_RECEIVABLE_STATUSES,
  RECEIVABLE_DISPLAY_STATUSES,
  RECEIVABLE_KINDS,
  RECEIVABLE_LIST_FILTERS,
  RECEIVABLE_STATUSES,
} from './constants';

export type { ClockOptions, OutstandingReceivable, OutstandingSummary } from './domain';
export { compareOutstanding, displayStatusOf, isOpen, today } from './domain';
