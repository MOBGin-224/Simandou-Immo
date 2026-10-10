import type { ReceivableDisplayStatus, ReceivableStatus } from '@/modules/receivables/client';

import type { AllocationSummary, CalculationBasis } from './allocation';
import { CHARGE_TYPE_LABELS, type ChargeStatus, type ChargeType } from './constants';

/**
 * Vues du module Charges (BR-049 à BR-056, API sections 27 à 31).
 *
 * Ce que le service renvoie aux routes et aux écrans. Jamais une ligne de base
 * brute : les dates redeviennent des chaînes et aucune colonne technique ne
 * fuit.
 *
 * Deux objets distincts, et la distinction est la décision verrouillée DEC-005.
 * La CHARGE est la facture de l'immeuble, elle ne doit rien à personne. La
 * CRÉANCE DE CHARGE est la part d'un logement, payable, avec son solde et son
 * statut, au même titre qu'une échéance de loyer. Les confondre en un seul objet
 * ferait disparaître la frontière que le modèle financier tient.
 *
 * Les montants sont transportés à plat avec une seule `currency`, comme pour le
 * loyer : ils viennent tous de la même facture.
 */

/** Immeuble qui supporte la charge, tel que l'écran l'affiche. */
export type ChargePropertyRef = {
  id: string;
  name: string;
};

/** Logement qui porte une part. */
export type ChargeApartmentRef = {
  id: string;
  /** Référence affichée du logement, par exemple A01. */
  number: string;
  propertyId: string;
  propertyName: string;
};

/**
 * Personne redevable d'une part, ou `null`.
 *
 * `null` pour un logement VACANT au moment de la publication (BR-052) : la
 * créance existe au niveau du logement, sans locataire redevable. C'est la
 * différence majeure avec l'échéance de loyer, qui naît d'un bail et a donc
 * toujours une personne.
 *
 * Même forme que la référence locataire des loyers : `userId` est l'identité
 * métier (DEC-051) et ouvre la fiche, `accessId` ne dit que si la personne a un
 * compte, et le téléphone est porté jusqu'ici parce qu'une part impayée se
 * réclame en appelant.
 */
export type ChargeTenantRef = {
  userId: string;
  accessId: string | null;
  fullName: string;
  phone: string | null;
};

/** Charge telle que la liste la présente (API section 30). */
export type ChargeListItem = {
  id: string;
  organizationId: string;
  property: ChargePropertyRef;
  type: ChargeType;
  /** Premier jour de la période couverte, date civile `YYYY-MM-DD`. */
  periodStart: string;
  /** Jour où les parts sont dues, date civile `YYYY-MM-DD`. */
  dueDate: string;
  totalAmount: number;
  currency: string;
  allocationMethod: 'EQUAL';
  status: ChargeStatus;
  supplierName: string | null;
  publishedAt: string | null;
  cancelledAt: string | null;
  /**
   * Nombre de créances créées par la publication.
   *
   * Zéro tant que la charge est en brouillon, et c'est exact plutôt que
   * provisoire : une charge non publiée n'a produit aucune créance (BR-052).
   * L'écran affiche à la place le nombre de logements que l'aperçu annonce.
   */
  unitCount: number;
  /**
   * Somme des soldes des créances OUVERTES de cette charge (BR-039).
   *
   * Ce qu'il reste à encaisser sur cette facture. Calculé par le serveur, comme
   * tout total dû, et jamais recomposé par l'écran.
   */
  totalOutstanding: number;
};

/** Créance de charge, la part d'un logement (DEC-005). */
export type ChargeAllocationView = {
  id: string;
  organizationId: string;
  chargeId: string;
  /** La charge d'où la part vient, réduite à ce qui l'identifie. */
  charge: {
    type: ChargeType;
    status: ChargeStatus;
    supplierName: string | null;
    totalAmount: number;
  };
  apartment: ChargeApartmentRef;
  /** Personne redevable, `null` si le logement était vacant (BR-052). */
  tenant: ChargeTenantRef | null;
  /** Bail d'où la personne a été lue, `null` pour un logement vacant. */
  leaseId: string | null;
  periodStart: string;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  balance: number;
  currency: string;
  /** Statut STOCKÉ, celui de `receivable_status` (DEC-015). */
  status: ReceivableStatus;
  /** Statut tel qu'il doit être AFFICHÉ, « À venir » comprise (BR-037). */
  displayStatus: ReceivableDisplayStatus;
  /**
   * Comment la part a été calculée (section 31, API section 31).
   *
   * Transmise au LOCATAIRE aussi, et c'est une exigence de transparence
   * explicite de la section 31 : il doit pouvoir comprendre son montant sans
   * demander. Figée à la publication, donc elle reste vraie même si l'immeuble
   * change ensuite de nombre de logements.
   */
  explanation: CalculationBasis;
  /**
   * Naissance de la créance, c'est-à-dire la publication de sa charge.
   *
   * Transportée parce qu'elle DÉCIDE : l'ordre d'allocation d'un paiement se
   * départage par la date de création à échéance et type égaux (DEC-022), et le
   * total dû d'un locataire se lit dans ce même ordre.
   */
  createdAt: string;
};

/** Charge complète, telle que sa fiche l'affiche (API section 27). */
export type ChargeView = ChargeListItem & {
  /**
   * Les parts, dans l'ordre de la répartition.
   *
   * Vide tant que la charge n'est pas publiée. C'est l'ordre des références de
   * logement, celui même qui décide du reste d'arrondi (DEC-029) : la liste se
   * lit donc comme le calcul s'est fait, et un franc de plus sur les premières
   * lignes s'explique de lui-même.
   */
  allocations: ChargeAllocationView[];
  createdAt: string;
  updatedAt: string;
};

/**
 * Aperçu d'une répartition, avant publication (MVP-BACKLOG-053, API section 28).
 *
 * Ne publie rien et n'écrit rien. La section demande quatre informations, et
 * elles sont toutes là : les appartements concernés, le montant individuel, le
 * total et l'éventuel écart d'arrondi.
 *
 * `shares` porte l'occupation de chaque logement, ce que la section ne demande
 * pas explicitement : un gestionnaire doit voir AVANT de publier qu'un logement
 * vacant recevra une créance sans locataire redevable (BR-052), faute de quoi la
 * part lui semblera perdue.
 */
export type ChargePreview = {
  chargeId: string;
  property: ChargePropertyRef;
  type: ChargeType;
  periodStart: string;
  dueDate: string;
  currency: string;
  summary: AllocationSummary;
  shares: {
    apartmentId: string;
    number: string;
    amountDue: number;
    /** `true` si un bail actif rend une personne redevable de cette part. */
    occupied: boolean;
    tenantName: string | null;
  }[];
};

/**
 * Libellé d'une charge, celui que l'API transmet et que les écrans affichent.
 *
 * La section 18 le documente au mot : « Eau septembre 2026 ». L'année est
 * toujours écrite, pour la même raison que sur un loyer : dans un historique qui
 * couvre plusieurs années, « Eau septembre » devient faux l'année suivante.
 *
 * Le formateur de mois est reçu en paramètre : ce module reste pur, et c'est la
 * couche de présentation qui connaît la langue.
 */
export function describeCharge(
  charge: { type: ChargeType; periodStart: string },
  formatMonth: (iso: string) => string,
): string {
  return `${CHARGE_TYPE_LABELS[charge.type]} ${formatMonth(charge.periodStart)}`;
}

/** Nature de la charge, en français. */
export function describeChargeType(type: ChargeType): string {
  return CHARGE_TYPE_LABELS[type];
}

/**
 * Méthode de répartition, en clair (BR-050).
 *
 * La règle veut que chaque charge publiée INDIQUE sa méthode de calcul : le
 * libellé n'est donc pas un ornement, c'est l'exécution de BR-050 à l'écran.
 */
export function describeAllocationMethod(method: 'EQUAL'): string {
  return method === 'EQUAL' ? 'Répartition égale' : method;
}

/** Libellé d'un logement, tel qu'on le lit partout : « A01, Résidence Camayenne ». */
export function describeApartment(apartment: ChargeApartmentRef): string {
  return `${apartment.number}, ${apartment.propertyName}`;
}

/**
 * Une charge est-elle encore PUBLIABLE (BR-052) ?
 *
 * Seul un brouillon l'est. Une charge publiée ne peut pas l'être deux fois, la
 * règle le dit explicitement, et une charge annulée ne revient jamais en
 * brouillon : la corriger consiste à en créer une nouvelle, ce qui laisse les
 * deux dans l'historique (BR-054).
 */
export function isPublishable(charge: { status: ChargeStatus }): boolean {
  return charge.status === 'DRAFT';
}

/**
 * Une charge est-elle ANNULABLE (BR-054) ?
 *
 * Un brouillon comme une charge publiée. Annuler un brouillon est la façon de
 * corriger une erreur de saisie sans modification silencieuse, qui est ce que
 * BR-053 interdit ; annuler une charge publiée éteint ses créances sans rien
 * détruire. Une charge déjà annulée ne l'est pas deux fois.
 */
export function isCancellable(charge: { status: ChargeStatus }): boolean {
  return charge.status !== 'CANCELLED';
}

/**
 * Ordre d'affichage de la liste des charges.
 *
 * Par période DÉCROISSANTE, la plus récente d'abord, puis par création
 * décroissante. Une charge n'est pas une file d'attente comme les impayés : ce
 * qu'on vient chercher est la dernière facture répartie, et l'historique se lit
 * en descendant. Deux charges d'eau du même mois, saisies à dix minutes
 * d'intervalle, restent ordonnées par leur création.
 */
export function compareChargeItems(
  a: Pick<ChargeListItem, 'periodStart'> & { createdAt?: string },
  b: Pick<ChargeListItem, 'periodStart'> & { createdAt?: string },
): number {
  if (a.periodStart !== b.periodStart) return b.periodStart.localeCompare(a.periodStart);

  return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
}
