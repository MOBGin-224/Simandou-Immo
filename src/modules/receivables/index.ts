/**
 * Surface publique du module Créances (MVP-ENG-002).
 *
 * Le module porte ce qui est COMMUN aux deux créances du MVP, loyer et charge
 * (DEC-005) : le cycle de statut (DEC-015), la définition d'une créance ouverte
 * (BR-039), la dérivation « À venir » (BR-037), l'ordre d'allocation (DEC-022),
 * le total dû d'une personne (BR-055) et le job qui constate les retards.
 *
 * Il ne possède aucune table : les données appartiennent aux modules Loyers et
 * Charges, dont il appelle les surfaces publiques. Ce qui est partagé ici est la
 * RÈGLE, pas l'accès aux données.
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

export type {
  OverdueReceivablesResult,
  ReceivableServiceOptions,
  ReceivablesDatabase,
} from './service';
export { getMyOutstanding, getTenantOutstanding, runOverdueReceivablesJob } from './service';
