import type { ReceivableStatus, RentDisplayStatus } from './constants';

/**
 * Ce qu'une créance ouverte veut dire, et comment « À venir » se dérive :
 * importés du module Créances depuis le Lot 10.
 *
 * Les deux règles sont communes au loyer et à la charge (BR-037, BR-039), et les
 * écrire dans chaque module les aurait laissées diverger. Elles sont réexportées
 * ici sous leurs noms d'origine : tout ce qui les lisait au Lot 9 continue de
 * passer par la surface du module Loyers.
 */
import { displayStatusOf, isOpen } from '@/modules/receivables/client';

export { displayStatusOf, isOpen };

/**
 * Vues du module Loyers (BR-034 à BR-037, API section 18).
 *
 * Ce que le service renvoie aux routes et aux écrans. Jamais une ligne de base
 * brute : les dates redeviennent des chaînes ISO et aucune colonne technique ne
 * fuit.
 *
 * Les montants sont transportés À PLAT, `amountDue`, `amountPaid`, `balance`,
 * avec une seule `currency` pour les trois, et non en couples `{ amount,
 * currency }` comme le loyer d'un bail. C'est la forme que la section 18
 * documente, au mot, et trois devises distinctes sur une même créance n'auraient
 * aucun sens : elles viennent toutes du même contrat.
 *
 * `periodStart` et `dueDate` sont des dates CIVILES en `YYYY-MM-DD` : une
 * échéance est due un jour, pas à une heure, et la convertir en instant ferait
 * dépendre son affichage du fuseau du lecteur.
 */

/** Logement de l'échéance, tel que l'écran l'affiche. */
export type RentApartmentRef = {
  id: string;
  /** Référence affichée du logement, par exemple A01. */
  number: string;
  propertyId: string;
  propertyName: string;
};

/**
 * Locataire redevable.
 *
 * `userId` est l'identité métier de la personne et c'est LUI qui ouvre sa fiche,
 * `/locataires/:userId` (DEC-051). `accessId` est l'identifiant de son droit
 * d'accès, et il ne sert qu'à répondre à une question : cette personne a-t-elle
 * un compte ? Il est NUL pour qui n'en a aucun, le bail rattachant une personne
 * à un logement sans exiger qu'elle utilise l'application.
 *
 * Le téléphone est porté jusqu'ici parce qu'un loyer impayé se règle en
 * appelant : l'écran qui montre la dette doit montrer comment joindre la
 * personne, sans obliger à rouvrir sa fiche.
 */
export type RentTenantRef = {
  userId: string;
  accessId: string | null;
  fullName: string;
  phone: string | null;
};

/** Échéance de loyer telle que l'interface et l'API la présentent. */
export type RentView = {
  id: string;
  organizationId: string;
  leaseId: string;
  apartment: RentApartmentRef;
  tenant: RentTenantRef;
  /** Premier jour de la période couverte, date civile `YYYY-MM-DD`. */
  periodStart: string;
  /** Jour où le loyer est dû, date civile `YYYY-MM-DD`. */
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  balance: number;
  currency: string;
  /** Statut STOCKÉ, celui de `receivable_status`. */
  status: ReceivableStatus;
  /**
   * Statut tel qu'il doit être AFFICHÉ, « À venir » comprise (BR-037).
   *
   * Calculé par le serveur et transmis, plutôt que recalculé par chaque écran :
   * il dépend de la date du jour, et deux endroits qui la lisent séparément
   * finiraient par se contredire au passage de minuit.
   */
  displayStatus: RentDisplayStatus;
  createdAt: string;
  updatedAt: string;
};

/** Un élément de la liste. Même forme que la fiche, sans les dates techniques. */
export type RentListItem = Omit<RentView, 'createdAt' | 'updatedAt'>;

/**
 * Le total dû et ses créances ont rejoint le module Créances au Lot 10.
 *
 * `OutstandingReceivable` et `OutstandingSummary` étaient définis ici au Lot 9,
 * quand le loyer était la seule créance existante. Le total dû est pourtant
 * « loyers et charges confondus » (BR-039, BR-055) : il n'appartient donc pas au
 * module Loyers, et les deux types vivent maintenant dans
 * `modules/receivables`, que les routes appellent.
 */

/**
 * Période d'une échéance, en clair : « Loyer septembre 2026 » (BR-035).
 *
 * La règle veut une période NON AMBIGUË, et c'est pourquoi l'année est toujours
 * écrite : « Loyer septembre » tout court devient faux l'année suivante, dans un
 * historique qui en couvre plusieurs.
 *
 * Le formateur est reçu en paramètre, comme pour la période d'un bail : ce
 * module reste pur, et c'est la couche de présentation qui connaît la langue et
 * le fuseau.
 */
export function describePeriod(periodStart: string, formatMonth: (iso: string) => string): string {
  return `Loyer ${formatMonth(periodStart)}`;
}

/** Libellé d'un logement, tel qu'on le lit partout : « A01, Résidence Camayenne ». */
export function describeApartment(apartment: RentApartmentRef): string {
  return `${apartment.number}, ${apartment.propertyName}`;
}

/**
 * Ordre d'affichage : le plus urgent d'abord.
 *
 * Ce que cherche la personne qui ouvre cet écran est l'argent qu'on lui doit, et
 * l'impayé le plus ancien est celui qui doit être réclamé en premier. L'ordre est
 * donc par date d'échéance CROISSANTE au sein des créances ouvertes, ce qui place
 * le retard le plus vieux en tête, puis les créances soldées, les plus récentes
 * d'abord, puisqu'elles ne sont plus qu'un historique.
 */
export function compareRentItems(a: RentListItem, b: RentListItem): number {
  const aOpen = isOpen(a.status);
  const bOpen = isOpen(b.status);

  if (aOpen !== bOpen) return aOpen ? -1 : 1;

  // Dates civiles en `YYYY-MM-DD` : l'ordre lexical est l'ordre chronologique.
  return aOpen ? a.dueDate.localeCompare(b.dueDate) : b.dueDate.localeCompare(a.dueDate);
}
