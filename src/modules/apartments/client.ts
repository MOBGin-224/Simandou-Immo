/**
 * Surface CLIENT du module Appartements.
 *
 * Un composant client doit importer ce fichier, jamais `index.ts` : la façade
 * serveur expose les cas d'usage, qui entraînent le dépôt de données et le
 * pilote PostgreSQL. La compilation échoue si l'un de ces modules atteint le
 * navigateur, et c'est heureux : l'alternative serait d'y expédier la connexion
 * à la base.
 *
 * Tout ce qui est exporté ici est soit une constante sans dépendance, soit un
 * type, donc effacé à la compilation.
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

export type { ApartmentView, Money } from './domain';
export { describeFloor, generateNumbers } from './domain';
