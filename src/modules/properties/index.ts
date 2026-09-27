/**
 * Surface publique du module Immeubles (MVP-ENG-002).
 *
 * Les autres modules et les routes importent CE fichier, jamais un fichier
 * interne : un module ne doit pas dépendre de l'implémentation d'un autre.
 *
 * Le dépôt de données n'est volontairement pas réexporté. Y accéder de
 * l'extérieur permettrait de lire des immeubles sans passer par le contrôle
 * d'accès, ce qui est exactement ce que ce découpage empêche.
 */

export type { PropertyChanges, PropertyOccupancy, PropertyView } from './domain';
export { EMPTY_OCCUPANCY, describeLocation, isArchived, toPropertyView } from './domain';

export type { ArchivedPropertyReason, FieldErrors } from './errors';
export {
  ArchivedPropertyError,
  PropertyNameAlreadyUsedError,
  PropertyValidationError,
} from './errors';

/**
 * Les constantes viennent de `constants.ts` et non de `schemas.ts` : elles sont
 * aussi exposées à l'interface par `client.ts`, qui ne doit rien entraîner de
 * serveur derrière lui.
 */
export type { PropertyListFilter } from './constants';
export {
  PROPERTY_ADDRESS_MAX_LENGTH,
  PROPERTY_CITY_MAX_LENGTH,
  PROPERTY_DESCRIPTION_MAX_LENGTH,
  PROPERTY_DISTRICT_MAX_LENGTH,
  PROPERTY_LIST_DEFAULT_PAGE_SIZE,
  PROPERTY_LIST_FILTERS,
  PROPERTY_LIST_MAX_PAGE_SIZE,
  PROPERTY_NAME_MAX_LENGTH,
} from './constants';

export type { CreatePropertyInput, ListPropertiesQuery, UpdatePropertyInput } from './schemas';
export { createPropertySchema, listPropertiesQuerySchema, updatePropertySchema } from './schemas';

export type { PropertiesDatabase } from './repository';

export type { PropertyCollection } from './service';
export {
  archiveProperty,
  createProperty,
  getProperty,
  listProperties,
  updateProperty,
} from './service';
