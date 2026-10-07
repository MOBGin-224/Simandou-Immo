/**
 * Surface publique du module Contrats (MVP-ENG-002).
 *
 * Les autres modules et les routes importent CE fichier, jamais un fichier
 * interne : un module ne doit pas dépendre de l'implémentation d'un autre.
 *
 * Le dépôt de données n'est volontairement pas réexporté. Y accéder de
 * l'extérieur permettrait de lire des baux sans passer par le contrôle d'accès,
 * ce qui est exactement ce que ce découpage empêche.
 */

export type {
  LeasableApartment,
  LeaseApartmentRef,
  LeaseListItem,
  LeaseTenantRef,
  LeaseView,
  Money,
} from './domain';
export {
  compareLeaseItems,
  describeApartment,
  describePeriod,
  isActive,
  isEditable,
} from './domain';

export type { FieldErrors, LeaseAction, LeaseConflictReason, LeaseStateValue } from './errors';
export {
  LeaseConflictError,
  LeaseStateError,
  LeaseTerminationDateError,
  LeaseValidationError,
} from './errors';

/**
 * Les constantes viennent de `constants.ts` et non de `schemas.ts` : elles sont
 * aussi exposées à l'interface par `client.ts`, qui ne doit rien entraîner de
 * serveur derrière lui.
 */
export type { LeaseListFilter, LeaseStatus } from './constants';
export {
  LEASE_AMOUNT_MAX,
  LEASE_DUE_DAY_MAX,
  LEASE_DUE_DAY_MIN,
  LEASE_LIST_DEFAULT_PAGE_SIZE,
  LEASE_LIST_FILTERS,
  LEASE_LIST_MAX_PAGE_SIZE,
  LEASE_STATUSES,
  LEASE_TERMINATION_REASON_MAX_LENGTH,
} from './constants';

export type {
  CreateLeaseInput,
  ListLeasesQuery,
  TerminateLeaseInput,
  UpdateLeaseInput,
} from './schemas';
export {
  createLeaseSchema,
  listLeasesQuerySchema,
  terminateLeaseSchema,
  updateLeaseSchema,
} from './schemas';

export type { LeasesDatabase } from './repository';

export type { LeaseCollection, LeaseServiceOptions } from './service';
export {
  createLease,
  findOccupiedApartment,
  getLease,
  isApartmentOccupied,
  listLeasableApartments,
  listLeases,
  listMyLeases,
  terminateLease,
  today,
  updateLease,
} from './service';
