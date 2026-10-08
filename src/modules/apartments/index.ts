/**
 * Surface publique du module Appartements (MVP-ENG-002).
 *
 * Les autres modules et les routes importent CE fichier, jamais un fichier
 * interne : un module ne doit pas dépendre de l'implémentation d'un autre.
 *
 * Le dépôt de données n'est volontairement pas réexporté. Y accéder de
 * l'extérieur permettrait de lire des appartements sans passer par le contrôle
 * d'accès, ce qui est exactement ce que ce découpage empêche.
 */

export type { ApartmentChanges, ApartmentView, Money } from './domain';
export { describeFloor, generateNumbers, isArchived, toApartmentView } from './domain';

export type { ArchivedApartmentReason, FieldErrors } from './errors';
export {
  AlreadyArchivedApartmentError,
  ApartmentBulkConflictError,
  ApartmentNumberAlreadyUsedError,
  ApartmentValidationError,
  ArchivedApartmentError,
} from './errors';

/**
 * Les constantes viennent de `constants.ts` et non de `schemas.ts` : elles sont
 * aussi exposées à l'interface par `client.ts`, qui ne doit rien entraîner de
 * serveur derrière lui.
 */
export type { ApartmentListFilter, ApartmentOccupancy } from './constants';
export {
  APARTMENT_AREA_MAX,
  APARTMENT_BULK_MAX,
  APARTMENT_FLOOR_MAX,
  APARTMENT_FLOOR_MIN,
  APARTMENT_LIST_DEFAULT_PAGE_SIZE,
  APARTMENT_LIST_FILTERS,
  APARTMENT_LIST_MAX_PAGE_SIZE,
  APARTMENT_NUMBER_MAX_LENGTH,
  APARTMENT_RENT_MAX,
  APARTMENT_OCCUPANCIES,
  APARTMENT_TYPE_MAX_LENGTH,
} from './constants';

export type {
  CreateApartmentInput,
  CreateApartmentsBulkInput,
  GenerateApartmentsInput,
  ListApartmentsQuery,
  UpdateApartmentInput,
} from './schemas';
export {
  createApartmentSchema,
  createApartmentsBulkSchema,
  generateApartmentsSchema,
  listApartmentsQuerySchema,
  updateApartmentSchema,
} from './schemas';

export type { ApartmentsDatabase } from './repository';

export type { ApartmentCollection } from './service';
export {
  archiveApartment,
  createApartment,
  createApartmentsBulk,
  generateApartments,
  getApartment,
  listApartments,
  updateApartment,
} from './service';
