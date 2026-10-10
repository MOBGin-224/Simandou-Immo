/**
 * Surface publique du module Loyers (MVP-ENG-002).
 *
 * Les autres modules et les routes importent CE fichier, jamais un fichier
 * interne : un module ne doit pas dépendre de l'implémentation d'un autre.
 *
 * Le dépôt de données n'est volontairement pas réexporté. Y accéder de
 * l'extérieur permettrait de lire des créances sans passer par le contrôle
 * d'accès, ce qui est exactement ce que ce découpage empêche.
 */

export type { RentApartmentRef, RentListItem, RentTenantRef, RentView } from './domain';
export {
  compareRentItems,
  describeApartment,
  describePeriod,
  displayStatusOf,
  isOpen,
} from './domain';

/**
 * Les constantes viennent de `constants.ts` et non de `schemas.ts` : elles sont
 * aussi exposées à l'interface par `client.ts`, qui ne doit rien entraîner de
 * serveur derrière lui.
 */
export type { ReceivableStatus, RentDisplayStatus, RentListFilter } from './constants';
export {
  OPEN_RECEIVABLE_STATUSES,
  RECEIVABLE_STATUSES,
  RENT_DISPLAY_STATUSES,
  RENT_GENERATION_MAX_INSTALLMENTS,
  RENT_LIST_DEFAULT_PAGE_SIZE,
  RENT_LIST_FILTERS,
  RENT_LIST_MAX_PAGE_SIZE,
  RENT_LIST_TABS,
} from './constants';

export type { FieldErrors } from './errors';
export { RentGenerationLimitError, RentValidationError } from './errors';

/**
 * Le calendrier est exposé parce qu'il porte les trois règles de DEC-053 et que
 * les tests comme les écrans doivent pouvoir les relire : la date d'échéance
 * d'une période, la période qui contient un jour, le recouvrement d'un bail.
 */
export {
  daysInMonth,
  dueDateFor,
  isPastDue,
  leaseCoversPeriod,
  nextPeriod,
  periodEndOf,
  periodOf,
} from './period';

export type { GenerateRentsInput, ListRentsQuery } from './schemas';
export { generateRentsSchema, listRentsQuerySchema } from './schemas';

export type { RentsDatabase } from './repository';

export type {
  OverdueJobResult,
  RentCollection,
  RentGenerationResult,
  RentServiceOptions,
} from './service';
export {
  generateRents,
  getRent,
  listMyRents,
  listRents,
  openRentReceivablesForTenant,
  plannedInstallments,
  runOverdueJob,
  runRentGenerationJob,
  today,
} from './service';

/**
 * Le total dû, lui, n'est plus ici : il est « loyers et charges confondus »
 * (BR-039, BR-055) et appartient donc au module Créances depuis le Lot 10.
 * Ce module n'en fournit que sa moitié, par `openRentReceivablesForTenant`.
 */
