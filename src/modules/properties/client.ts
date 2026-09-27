/**
 * Surface CLIENT du module Immeubles.
 *
 * Un composant client doit importer ce fichier, jamais `index.ts` : la façade
 * serveur expose les cas d'usage, qui entraînent le dépôt de données et le pilote
 * PostgreSQL. La compilation échoue si l'un de ces modules atteint le navigateur,
 * et c'est heureux : l'alternative serait d'y expédier la connexion à la base.
 *
 * Tout ce qui est exporté ici est soit une constante sans dépendance, soit un type,
 * donc effacé à la compilation.
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

export type { PropertyOccupancy, PropertyView } from './domain';
