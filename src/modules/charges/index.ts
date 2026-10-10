/**
 * Surface publique du module Charges (MVP-ENG-002).
 *
 * Les autres modules et les routes importent CE fichier, jamais un fichier
 * interne : un module ne doit pas dépendre de l'implémentation d'un autre.
 *
 * Le dépôt de données n'est volontairement pas réexporté. Y accéder de
 * l'extérieur permettrait de lire ou d'écrire des créances sans passer par le
 * contrôle d'accès, ce qui est exactement ce que ce découpage empêche.
 */

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
  compareChargeItems,
  describeAllocationMethod,
  describeApartment,
  describeCharge,
  describeChargeType,
  isCancellable,
  isPublishable,
} from './domain';

/**
 * Les constantes viennent de `constants.ts` et non de `schemas.ts` : elles sont
 * aussi exposées à l'interface par `client.ts`, qui ne doit rien entraîner de
 * serveur derrière lui.
 */
export type { AllocationMethod, ChargeListFilter, ChargeStatus, ChargeType } from './constants';
export {
  ALLOCATION_METHODS,
  CHARGE_LIST_DEFAULT_PAGE_SIZE,
  CHARGE_LIST_FILTERS,
  CHARGE_LIST_MAX_PAGE_SIZE,
  CHARGE_LIST_TABS,
  CHARGE_STATUSES,
  CHARGE_SUPPLIER_NAME_MAX_LENGTH,
  CHARGE_TOTAL_AMOUNT_MAX,
  CHARGE_TYPE_LABELS,
  CHARGE_TYPES,
} from './constants';

/**
 * Le moteur de répartition est exposé parce qu'il porte la règle d'arrondi de
 * DEC-029 et que les tests comme les écrans doivent pouvoir la relire : la part
 * de base, le reste distribué une unité à la fois, et l'invariant de somme.
 */
export type {
  AllocationShare,
  AllocationSummary,
  AllocationUnit,
  CalculationBasis,
} from './allocation';
export {
  allocateEqually,
  assertAllocationBalances,
  compareUnits,
  summarizeAllocation,
} from './allocation';

export type { ChargeStateReason, FieldErrors } from './errors';
export { ChargeNoUnitError, ChargeStateError, ChargeValidationError } from './errors';

export type { CreateChargeInput, ListChargeAllocationsQuery, ListChargesQuery } from './schemas';
export {
  createChargeInputSchema,
  createChargeSchema,
  listChargeAllocationsQuerySchema,
  listChargesQuerySchema,
} from './schemas';

export type { ChargesDatabase } from './repository';

export type {
  ChargeAllocationCollection,
  ChargeCollection,
  ChargeOverdueResult,
  ChargePublicationResult,
  ChargeServiceOptions,
} from './service';
export {
  cancelCharge,
  createCharge,
  getCharge,
  listChargeAllocations,
  listCharges,
  listMyCharges,
  openChargeReceivablesForTenant,
  previewCharge,
  publishCharge,
  runChargeOverdueJob,
} from './service';
