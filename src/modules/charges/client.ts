/**
 * Surface du module Charges réservée à l'interface.
 *
 * Ce fichier ne réexporte QUE des constantes, des types et des fonctions pures,
 * jamais le service ni le dépôt. Un composant client qui importerait `index.ts`
 * entraînerait derrière lui le pilote PostgreSQL, ce qu'un navigateur ne doit
 * jamais recevoir.
 */
export type { AllocationMethod, ChargeListFilter, ChargeStatus, ChargeType } from './constants';
export {
  ALLOCATION_METHODS,
  CHARGE_LIST_FILTERS,
  CHARGE_LIST_TABS,
  CHARGE_STATUSES,
  CHARGE_SUPPLIER_NAME_MAX_LENGTH,
  CHARGE_TOTAL_AMOUNT_MAX,
  CHARGE_TYPE_LABELS,
  CHARGE_TYPES,
} from './constants';

export type { AllocationShare, AllocationSummary, CalculationBasis } from './allocation';

export type {
  ChargeAllocationView,
  ChargeApartmentRef,
  ChargeListItem,
  ChargePreview,
  ChargePropertyRef,
  ChargeTenantRef,
  ChargeView,
} from './domain';
export {
  describeAllocationMethod,
  describeApartment,
  describeCharge,
  describeChargeType,
  isCancellable,
  isPublishable,
} from './domain';
