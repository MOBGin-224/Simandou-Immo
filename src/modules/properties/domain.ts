import type { Property } from '@/db/schema';

import { ArchivedPropertyError } from './errors';
import type { UpdatePropertyInput } from './schemas';

/**
 * Modèle métier de l'immeuble (MVP-BACKLOG-016).
 *
 * Ce module ne connaît ni la base, ni HTTP, ni React : il ne porte que les
 * règles, les états et les calculs (MVP-ENG-034). C'est ce qui le rend testable
 * exhaustivement sans monter quoi que ce soit.
 *
 * L'immeuble est la pièce centrale du produit à deux titres : il porte le
 * patrimoine (BR-023), et il est l'unité de PÉRIMÈTRE d'un gestionnaire
 * (ADR-007). Son archivage préserve donc l'historique et ne supprime rien
 * (BR-025, DEC-020).
 */

/** Occupation d'un immeuble, dérivée du statut de ses appartements (DEC-019). */
export type PropertyOccupancy = {
  apartmentCount: number;
  occupiedCount: number;
  vacantCount: number;
  maintenanceCount: number;
};

/**
 * Immeuble tel que l'interface et l'API le présentent.
 *
 * Distinct de la ligne de base : `location` et `occupancy` sont calculés, et
 * aucune colonne technique ne fuit. Ce type est le contrat entre le backend et
 * le frontend (API section 69), donc le seul à faire foi côté affichage.
 */
export type PropertyView = {
  id: string;
  organizationId: string;
  name: string;
  address: string | null;
  city: string | null;
  district: string | null;
  description: string | null;
  /** « Quartier, Ville », ou `null` si aucune localisation n'est renseignée. */
  location: string | null;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  occupancy: PropertyOccupancy;
};

/** Un immeuble est actif tant que `archived_at` est nul (DEC-020). */
export function isArchived(property: Pick<Property, 'archivedAt'>): boolean {
  return property.archivedAt !== null;
}

/**
 * Localisation lisible, du plus précis au plus général.
 *
 * Le quartier d'abord : à Conakry, c'est lui qui situe réellement un immeuble,
 * la ville étant la même pour tout un portefeuille.
 */
export function describeLocation(property: Pick<Property, 'city' | 'district'>): string | null {
  const parts = [property.district, property.city].filter(
    (part): part is string => part !== null && part.length > 0,
  );

  return parts.length === 0 ? null : parts.join(', ');
}

/**
 * Refuse toute modification d'un immeuble archivé (BR-025).
 *
 * L'historique reste lisible, mais les opérations futures sont bloquées :
 * autoriser une modification créerait une donnée nouvelle sur un objet retiré de
 * l'exploitation.
 */
export function assertModifiable(property: Pick<Property, 'archivedAt'>): void {
  if (isArchived(property)) throw new ArchivedPropertyError('not-modifiable');
}

/** Refuse un second archivage, qui n'aurait aucun effet à annoncer. */
export function assertArchivable(property: Pick<Property, 'archivedAt'>): void {
  if (isArchived(property)) throw new ArchivedPropertyError('already-archived');
}

/**
 * Champs modifiables d'un immeuble, hors identité et organisation.
 *
 * `id` et `organizationId` en sont absents par construction : un immeuble ne
 * change ni d'identité ni d'organisation (BR-006).
 */
export type PropertyChanges = Partial<
  Pick<Property, 'name' | 'address' | 'city' | 'district' | 'description'>
>;

/**
 * Différence réelle entre l'immeuble courant et la modification demandée.
 *
 * Un PATCH qui renvoie les valeurs déjà en place ne doit produire AUCUNE
 * écriture : sans cela, ouvrir un formulaire et le soumettre sans rien changer
 * toucherait `updated_at` et ferait apparaître une modification fantôme dans le
 * futur journal d'activité (lot Activity & Audit).
 */
export function changedFields(property: Property, input: UpdatePropertyInput): PropertyChanges {
  const changes: PropertyChanges = {};

  // Champ par champ, et non par une boucle sur les clés : chaque colonne a son
  // propre type, `name` n'étant jamais nul là où les autres le sont. Une boucle
  // générique effacerait cette distinction, que le compilateur doit conserver.
  if (input.name !== undefined && input.name !== property.name) {
    changes.name = input.name;
  }

  if (input.address !== undefined && input.address !== property.address) {
    changes.address = input.address;
  }

  if (input.city !== undefined && input.city !== property.city) {
    changes.city = input.city;
  }

  if (input.district !== undefined && input.district !== property.district) {
    changes.district = input.district;
  }

  if (input.description !== undefined && input.description !== property.description) {
    changes.description = input.description;
  }

  return changes;
}

/** Y a-t-il quelque chose à écrire. */
export function hasChanges(changes: PropertyChanges): boolean {
  return Object.keys(changes).length > 0;
}

/** Occupation vide, pour un immeuble encore sans appartement. */
export const EMPTY_OCCUPANCY: PropertyOccupancy = {
  apartmentCount: 0,
  occupiedCount: 0,
  vacantCount: 0,
  maintenanceCount: 0,
};

/**
 * Compose la vue d'un immeuble.
 *
 * Les dates sortent en ISO 8601 (API section 71) : le formatage local appartient
 * au frontend, et une date déjà formatée côté serveur serait inutilisable par un
 * autre client.
 */
export function toPropertyView(
  property: Property,
  occupancy: PropertyOccupancy = EMPTY_OCCUPANCY,
): PropertyView {
  return {
    id: property.id,
    organizationId: property.organizationId,
    name: property.name,
    address: property.address,
    city: property.city,
    district: property.district,
    description: property.description,
    location: describeLocation(property),
    archived: isArchived(property),
    archivedAt: property.archivedAt?.toISOString() ?? null,
    createdAt: property.createdAt.toISOString(),
    updatedAt: property.updatedAt.toISOString(),
    occupancy,
  };
}
