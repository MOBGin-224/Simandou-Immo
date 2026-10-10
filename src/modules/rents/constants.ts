/**
 * Constantes du module Loyers.
 *
 * Dans un fichier à part parce qu'elles sont aussi exposées à l'interface par
 * `client.ts`, qui ne doit rien entraîner de serveur derrière lui.
 */

/**
 * Statuts de créance, et ce qu'« ouvert » veut dire : ils viennent du module
 * Créances depuis le Lot 10.
 *
 * Ils étaient déclarés ici au Lot 9, la créance de loyer étant la première à
 * naître, avec cette note : « le jour où les charges arrivent, sa place
 * naturelle est un module commun aux deux ». Les charges sont arrivées, et
 * l'énumération `receivable_status` est bien partagée par les deux créances
 * (DEC-015). Elle est donc définie une seule fois, dans `modules/receivables`,
 * et réexportée ici sous ses noms d'origine pour que rien de ce qui la lit n'ait
 * eu à changer.
 *
 * L'import passe par la surface CLIENT du module Créances : ces listes sont
 * exposées au navigateur par `client.ts`, qui ne doit rien entraîner de serveur
 * derrière lui.
 */
import type { ReceivableListFilter } from '@/modules/receivables/client';

export type {
  ReceivableListFilter as RentListFilter,
  ReceivableDisplayStatus as RentDisplayStatus,
  ReceivableStatus,
} from '@/modules/receivables/client';
export {
  OPEN_RECEIVABLE_STATUSES,
  RECEIVABLE_DISPLAY_STATUSES as RENT_DISPLAY_STATUSES,
  RECEIVABLE_LIST_FILTERS as RENT_LIST_FILTERS,
  RECEIVABLE_STATUSES,
} from '@/modules/receivables/client';

/**
 * Onglets de l'écran, dans leur ordre d'affichage.
 *
 * Quatre et non huit : `OVERDUE` est un sous-ensemble de `OUTSTANDING` et se lit
 * déjà sur chaque ligne par son badge, un onglet de plus n'apprendrait rien.
 * `CANCELLED` et les statuts intermédiaires restent atteignables par l'URL, ce
 * qui suffit à un cas rare.
 */
export const RENT_LIST_TABS = [
  'OUTSTANDING',
  'UPCOMING',
  'PAID',
  'ALL',
] as const satisfies readonly ReceivableListFilter[];

/** Borne maximale de pagination imposée par le serveur (API section 44). */
export const RENT_LIST_MAX_PAGE_SIZE = 100;
export const RENT_LIST_DEFAULT_PAGE_SIZE = 20;

/**
 * Nombre maximal d'échéances qu'une seule génération peut créer.
 *
 * Garde-fou d'exploitation, pas une règle métier : une génération porte sur une
 * période et sur les baux actifs du périmètre, donc son volume est borné par le
 * nombre de logements loués. La borne existe pour qu'une erreur de périmètre ou
 * de date ne produise pas une écriture de masse, et DEC-028 interdit de toute
 * façon un traitement long dans une requête interactive.
 */
export const RENT_GENERATION_MAX_INSTALLMENTS = 500;
