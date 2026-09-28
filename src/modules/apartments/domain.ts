import type { Apartment } from '@/db/schema';

import type { ApartmentStatus } from './constants';
import { ArchivedApartmentError } from './errors';
import type { UpdateApartmentInput } from './schemas';

/**
 * Modèle métier de l'appartement (MVP-BACKLOG-020).
 *
 * Ce module ne connaît ni la base, ni HTTP, ni React : il ne porte que les
 * règles, les états et les calculs (MVP-ENG-034).
 *
 * L'appartement est l'unité OPÉRATIONNELLE du produit (Information Architecture
 * niveau 3) : c'est à lui que se rattacheront le bail, les loyers, les
 * paiements, les charges et les incidents. Son statut d'occupation est
 * orthogonal à son archivage (DEC-019, DEC-020) : un logement archivé conserve
 * son dernier statut connu.
 */

/**
 * Montant monétaire tel que l'API le transmet (DEC-014).
 *
 * Entier dans la plus petite unité de la devise, avec la devise explicite. Le
 * couple est indissociable : un montant sans devise est inexploitable, une
 * devise sans montant est un résidu, et la base impose déjà cette solidarité.
 */
export type Money = {
  amount: number;
  currency: string;
};

/**
 * Appartement tel que l'interface et l'API le présentent.
 *
 * Distinct de la ligne de base : `area` redevient un nombre, le loyer redevient
 * un couple, et aucune colonne technique ne fuit. Ce type est le contrat entre
 * le backend et le frontend (API section 69).
 */
export type ApartmentView = {
  id: string;
  organizationId: string;
  propertyId: string;
  number: string;
  floor: number | null;
  type: string | null;
  /** Surface en mètres carrés, ou `null` si elle n'est pas renseignée. */
  area: number | null;
  status: ApartmentStatus;
  /** Loyer de référence, indicatif, servant à préremplir un futur contrat. */
  referenceRent: Money | null;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Un appartement est actif tant que `archived_at` est nul (DEC-020). */
export function isArchived(apartment: Pick<Apartment, 'archivedAt'>): boolean {
  return apartment.archivedAt !== null;
}

/**
 * Refuse toute modification d'un appartement archivé, ou d'un logement dont
 * l'immeuble est archivé (BR-025).
 *
 * Le second cas n'est pas redondant : l'archivage d'un immeuble ne touche pas
 * ses appartements, qui restent individuellement actifs. Sans ce contrôle, on
 * pourrait modifier le logement d'un immeuble sorti de l'exploitation, ce que la
 * fiche de l'immeuble annonce pourtant comme impossible.
 */
export function assertModifiable(
  apartment: Pick<Apartment, 'archivedAt'>,
  property: { archived: boolean },
): void {
  if (property.archived) throw new ArchivedApartmentError('property-archived');
  if (isArchived(apartment)) throw new ArchivedApartmentError('apartment-archived');
}

/**
 * Étage lisible.
 *
 * Le rez-de-chaussée est nommé, et non affiché « étage 0 », qui ne se dit pas.
 * Le sous-sol existe dans un immeuble de Conakry, d'où la borne négative.
 */
export function describeFloor(floor: number | null): string | null {
  if (floor === null) return null;
  if (floor === 0) return 'Rez-de-chaussée';
  if (floor < 0) return `Sous-sol ${Math.abs(floor)}`;

  return `${floor}${floor === 1 ? 'er' : 'e'} étage`;
}

/**
 * Champs modifiables d'un appartement, hors identité, organisation et immeuble.
 *
 * `propertyId` en est absent par construction : un appartement appartient à un
 * seul immeuble et n'en change pas (BR-026). Le déplacer casserait l'unicité de
 * sa référence et l'historique de ses baux.
 */
export type ApartmentChanges = Partial<
  Pick<Apartment, 'number' | 'floor' | 'type' | 'area' | 'status'> & {
    referenceRentAmount: number | null;
    currency: string | null;
  }
>;

/**
 * Surface telle que la base la stocke : une chaîne décimale, ou `null`.
 *
 * `numeric` revient du pilote sous forme de chaîne, et c'est volontaire : une
 * conversion en flottant perdrait de la précision sur les décimales. La
 * comparaison se fait donc sur la valeur numérique, jamais sur la chaîne, sans
 * quoi « 78.50 » et « 78.5 » passeraient pour deux surfaces différentes.
 */
function sameArea(stored: string | null, submitted: number | null): boolean {
  if (stored === null || submitted === null) return stored === null && submitted === null;

  return Number(stored) === submitted;
}

/** Surface lisible par l'API : un nombre, ou `null`. */
export function toAreaNumber(stored: string | null): number | null {
  return stored === null ? null : Number(stored);
}

/**
 * Différence réelle entre l'appartement courant et la modification demandée.
 *
 * Un PATCH qui renvoie les valeurs déjà en place ne doit produire AUCUNE
 * écriture, pour la même raison que sur l'immeuble : `updated_at` ferait
 * apparaître une modification fantôme dans le futur journal d'activité.
 *
 * Champ par champ, et non par une boucle sur les clés : chaque colonne a son
 * propre type, et une boucle générique effacerait une distinction que le
 * compilateur doit conserver.
 */
export function changedFields(apartment: Apartment, input: UpdateApartmentInput): ApartmentChanges {
  const changes: ApartmentChanges = {};

  if (input.number !== undefined && input.number !== apartment.number) {
    changes.number = input.number;
  }

  if (input.floor !== undefined && input.floor !== apartment.floor) {
    changes.floor = input.floor;
  }

  if (input.type !== undefined && input.type !== apartment.type) {
    changes.type = input.type;
  }

  if (input.area !== undefined && !sameArea(apartment.area, input.area)) {
    // La base attend une chaîne décimale : `numeric` ne se laisse pas écrire
    // depuis un flottant sans risque d'arrondi.
    changes.area = input.area === null ? null : input.area.toFixed(2);
  }

  if (input.status !== undefined && input.status !== apartment.status) {
    changes.status = input.status;
  }

  // Le loyer et sa devise vont toujours ensemble (DEC-014), y compris pour être
  // effacés : la base refuse un montant sans devise comme l'inverse.
  if (input.referenceRent !== undefined) {
    const amount = input.referenceRent === null ? null : input.referenceRent.amount;
    const currency = input.referenceRent === null ? null : input.referenceRent.currency;

    if (amount !== apartment.referenceRentAmount || currency !== apartment.currency) {
      changes.referenceRentAmount = amount;
      changes.currency = currency;
    }
  }

  return changes;
}

/** Y a-t-il quelque chose à écrire. */
export function hasChanges(changes: ApartmentChanges): boolean {
  return Object.keys(changes).length > 0;
}

/**
 * Compose la vue d'un appartement.
 *
 * Les dates sortent en ISO 8601 (API section 71) : le formatage local appartient
 * au frontend, et une date déjà formatée côté serveur serait inutilisable par un
 * autre client.
 */
export function toApartmentView(apartment: Apartment): ApartmentView {
  return {
    id: apartment.id,
    organizationId: apartment.organizationId,
    propertyId: apartment.propertyId,
    number: apartment.number,
    floor: apartment.floor,
    type: apartment.type,
    area: toAreaNumber(apartment.area),
    status: apartment.status,
    referenceRent:
      apartment.referenceRentAmount === null || apartment.currency === null
        ? null
        : { amount: apartment.referenceRentAmount, currency: apartment.currency },
    archived: isArchived(apartment),
    archivedAt: apartment.archivedAt?.toISOString() ?? null,
    createdAt: apartment.createdAt.toISOString(),
    updatedAt: apartment.updatedAt.toISOString(),
  };
}

/**
 * Engendre une suite de références, « A01, A02, A03… » (parcours 3).
 *
 * C'est la réponse à une exigence écrite du parcours : pour un immeuble de vingt
 * logements, le produit ne doit pas imposer vingt formulaires. L'utilisateur
 * décrit sa numérotation en trois valeurs, et le système en déduit la liste.
 *
 * Le remplissage par des zéros se fait sur la largeur du PLUS GRAND numéro
 * engendré, avec un minimum de deux chiffres. Deux raisons, l'une d'affichage et
 * l'autre de tri : « A01 » se lit comme une référence quand « A1 » se lit comme
 * une abréviation, et surtout le tri des listes est textuel, de sorte qu'une
 * largeur constante est ce qui fait suivre « A10 » à « A09 » plutôt qu'à « A1 ».
 *
 * La fonction ne valide rien et ne touche à aucune base : les bornes sont
 * vérifiées par le schéma, et c'est le cas d'usage qui refusera les références
 * déjà prises.
 */
export function generateNumbers(prefix: string, start: number, count: number): string[] {
  const width = Math.max(2, String(start + count - 1).length);

  return Array.from(
    { length: count },
    (_unused, index) => `${prefix}${String(start + index).padStart(width, '0')}`,
  );
}
