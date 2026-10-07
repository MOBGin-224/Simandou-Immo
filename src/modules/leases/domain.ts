import type { LeaseStatus } from './constants';

/**
 * Vues du module Contrats (BR-030 à BR-033, DEC-049).
 *
 * Ce que le service renvoie aux routes et aux écrans. Jamais une ligne de base
 * brute : les dates redeviennent des chaînes ISO, le loyer redevient un couple
 * montant et devise, et aucune colonne technique ne fuit.
 *
 * Les dates du bail sont des dates CIVILES, transportées en `YYYY-MM-DD` et non
 * en instants : un bail commence un jour, pas à une heure, et le convertir en
 * `Date` ferait dépendre son affichage du fuseau du lecteur.
 */

export type Money = {
  amount: number;
  currency: string;
};

/** Logement du bail, tel que l'écran l'affiche. */
export type LeaseApartmentRef = {
  id: string;
  /** Référence affichée du logement, par exemple A01. */
  number: string;
  propertyId: string;
  propertyName: string;
  /** Vrai si le logement lui-même est archivé (DEC-020). */
  archived: boolean;
};

/**
 * Locataire du bail.
 *
 * `accessId` est l'identifiant de la ressource locataire du Lot 7, celui de
 * `/tenants/:id`. Il est NUL pour une personne qui n'a aucun accès au produit :
 * le bail rattache une personne à un logement, et cette personne n'a pas
 * forcément de compte (BR-020, DEC-046).
 */
export type LeaseTenantRef = {
  userId: string;
  accessId: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
};

/**
 * Logement qu'un bail peut encore prendre, avec son loyer de référence.
 *
 * Le loyer de référence sert à PRÉRENSEIGNER le montant du bail : la colonne
 * `apartments.reference_rent_amount` existe précisément pour cela, et ne pas
 * l'utiliser obligerait à retaper un montant déjà connu.
 */
export type LeasableApartment = LeaseApartmentRef & {
  referenceRent: Money | null;
};

/** Bail tel que l'interface et l'API le présentent. */
export type LeaseView = {
  id: string;
  organizationId: string;
  organizationName: string;
  apartment: LeaseApartmentRef;
  tenant: LeaseTenantRef;
  status: LeaseStatus;
  /** Date civile, `YYYY-MM-DD`. */
  startDate: string;
  /** Date civile, ou `null` si le bail n'a pas de terme prévu. */
  endDate: string | null;
  rent: Money;
  /** Jour du mois où le loyer est dû, entre 1 et 31. */
  dueDay: number;
  deposit: Money;
  terminationReason: string | null;
  createdAt: string;
  updatedAt: string;
  terminatedAt: string | null;
};

/** Un élément de la liste des baux. Même forme que la fiche, sans les dates techniques. */
export type LeaseListItem = Omit<LeaseView, 'createdAt' | 'updatedAt' | 'organizationName'>;

/** Ordre d'affichage : le bail en cours d'abord, puis l'historique du plus récent au plus ancien. */
const STATUS_ORDER: Record<LeaseStatus, number> = {
  ACTIVE: 0,
  DRAFT: 1,
  ENDED: 2,
  CANCELLED: 3,
};

export function compareLeaseItems(a: LeaseListItem, b: LeaseListItem): number {
  const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];

  if (byStatus !== 0) return byStatus;

  // Date civile en `YYYY-MM-DD` : l'ordre lexical est l'ordre chronologique.
  return b.startDate.localeCompare(a.startDate);
}

/** Un bail est EN COURS tant qu'il est actif. Lui seul porte l'occupation (DEC-050). */
export function isActive(lease: Pick<LeaseView, 'status'>): boolean {
  return lease.status === 'ACTIVE';
}

/**
 * Un bail se modifie-t-il encore ?
 *
 * Un bail clôturé ou annulé ne se modifie plus : ses valeurs décrivent ce qui a
 * eu lieu, et les réécrire effacerait l'historique que BR-025 et BR-033 veulent
 * conserver.
 */
export function isEditable(lease: Pick<LeaseView, 'status'>): boolean {
  return lease.status === 'ACTIVE' || lease.status === 'DRAFT';
}

/** Libellé d'un logement, tel qu'on le lit partout : « A01, Résidence Camayenne ». */
export function describeApartment(apartment: LeaseApartmentRef): string {
  return `${apartment.number}, ${apartment.propertyName}`;
}

/**
 * Période du bail, en clair.
 *
 * Un bail sans terme se lit « depuis le ... » et non « du ... au ... » : sur ce
 * marché, un bail à durée indéterminée est le cas courant, et afficher un tiret
 * à la place de la fin laisserait croire à une donnée manquante.
 */
export function describePeriod(
  lease: Pick<LeaseView, 'startDate' | 'endDate'>,
  formatDate: (iso: string) => string,
): string {
  if (lease.endDate === null) return `Depuis le ${formatDate(lease.startDate)}`;

  return `Du ${formatDate(lease.startDate)} au ${formatDate(lease.endDate)}`;
}
