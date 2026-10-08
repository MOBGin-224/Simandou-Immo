import { z } from 'zod';

import {
  ResourceOutOfScopeError,
  readablePropertyScopes,
  requirePermission,
  type AccessContext,
} from '@/lib/authorization';
import { occupiedCountByProperty } from '@/modules/leases';

import {
  assertArchivable,
  assertModifiable,
  changedFields,
  hasChanges,
  toPropertyView,
  type PropertyOccupancy,
  type PropertyView,
} from './domain';
import {
  ArchivedPropertyError,
  PropertyNameAlreadyUsedError,
  PropertyValidationError,
} from './errors';
import {
  PROPERTY_NAME_CONSTRAINT,
  archivePropertyRow,
  findPropertyById,
  findPropertyByName,
  insertProperty,
  isUniqueViolation,
  apartmentTallyByProperty,
  listPropertyRows,
  updatePropertyRow,
  type PropertiesDatabase,
} from './repository';
import { createPropertySchema, listPropertiesQuerySchema, updatePropertySchema } from './schemas';

/**
 * Cas d'usage du module Immeubles (MVP-ENG-033, MVP-BACKLOG-017).
 *
 * Chaque fonction suit l'ordre imposé par API-001, sans exception :
 *
 * ```text
 * Authentification  déjà faite, le contexte d'accès la présuppose
 * ↓
 * Validation        schéma Zod, ici et non chez l'appelant
 * ↓
 * Organisation      périmètre et permission, par le point de décision unique
 * ↓
 * Règle métier      archivage, unicité du nom
 * ↓
 * Persistance
 * ```
 *
 * La validation est portée ICI et non dans les routes : une route HTTP, une
 * Server Action et un futur script partagent alors la même frontière, et aucun
 * appelant ne peut l'oublier.
 *
 * Aucune fonction ne reçoit ni `Request`, ni `FormData`, ni composant : ce module
 * est testable contre une vraie base sans monter de serveur.
 */

/** Traduit un échec de schéma en erreur métier lisible par un formulaire. */
function toValidationError(error: z.ZodError): PropertyValidationError {
  return new PropertyValidationError(z.flattenError(error).fieldErrors as Record<string, string[]>);
}

function parseOrThrow<Schema extends z.ZodType>(schema: Schema, input: unknown): z.output<Schema> {
  const result = schema.safeParse(input);

  if (!result.success) throw toValidationError(result.error);

  return result.data;
}

/**
 * Immeuble accessible en lecture, ou refus indiscernable d'une absence.
 *
 * Un identifiant inconnu et un identifiant hors périmètre lèvent la MÊME erreur :
 * distinguer les deux révélerait l'existence de données d'une autre organisation
 * (ADR-007).
 */
async function loadAccessibleProperty(
  db: PropertiesDatabase,
  context: AccessContext,
  propertyId: string,
  permission: 'property.read' | 'property.update' | 'property.archive',
) {
  // Un identifiant qui n'est pas un UUID ne peut désigner aucun immeuble. Le
  // contrôle est ici et non dans les routes pour deux raisons : la réponse doit
  // être la même que pour un identifiant inconnu, et sans lui PostgreSQL
  // refuserait la conversion, ce qui produirait une erreur interne là où la
  // réponse correcte est « inexistant ».
  if (!z.string().uuid().safeParse(propertyId).success) throw new ResourceOutOfScopeError();

  const property = await findPropertyById(db, propertyId);

  if (!property) throw new ResourceOutOfScopeError();

  requirePermission(context, permission, {
    organizationId: property.organizationId,
    propertyId: property.id,
  });

  return property;
}

/**
 * Occupation de plusieurs immeubles, en DEUX lectures (DEC-050).
 *
 * Le parc et les chantiers viennent de `apartments`, l'occupation vient des baux.
 * Les réunir ici, et non dans le dépôt, tient à la règle d'isolation des modules :
 * un dépôt ne connaît qu'une seule famille de tables, et c'est le cas d'usage qui
 * a le droit d'interroger un autre module par sa façade publique.
 *
 * `vacantCount` est une SOUSTRACTION et non un comptage : un logement porte un
 * bail en cours ou il n'en porte pas, et compter les deux séparément autoriserait
 * les deux chiffres à ne pas se rejoindre.
 */
async function occupancyOf(
  db: PropertiesDatabase,
  propertyIds: readonly string[],
): Promise<Map<string, PropertyOccupancy>> {
  const [tallies, occupied] = await Promise.all([
    apartmentTallyByProperty(db, propertyIds),
    occupiedCountByProperty(db, propertyIds),
  ]);

  const occupancies = new Map<string, PropertyOccupancy>();

  for (const [propertyId, tally] of tallies) {
    const occupiedCount = Math.min(occupied.get(propertyId) ?? 0, tally.apartmentCount);

    occupancies.set(propertyId, {
      apartmentCount: tally.apartmentCount,
      occupiedCount,
      vacantCount: tally.apartmentCount - occupiedCount,
      maintenanceCount: tally.maintenanceCount,
    });
  }

  return occupancies;
}

/** Vue d'un immeuble, occupation incluse. */
async function viewOf(
  db: PropertiesDatabase,
  property: Awaited<ReturnType<typeof findPropertyById>>,
) {
  if (!property) throw new ResourceOutOfScopeError();

  const occupancies = await occupancyOf(db, [property.id]);

  return toPropertyView(property, occupancies.get(property.id));
}

/**
 * Crée un immeuble (MVP-BACKLOG-017, BR-023, PRD 10.3).
 *
 * `property.create` est réservée au propriétaire (DEC-025, confirmée le
 * 27 septembre 2026). Un gestionnaire reçoit donc un refus, et ce refus est
 * `out-of-scope` et non `permission-denied` : la création vise l'ORGANISATION, or
 * ADR-007 borne l'autorité d'un gestionnaire à un périmètre d'immeubles. Une
 * ressource sans immeuble sort de son périmètre, et se comporte pour lui comme
 * inexistante. L'interface n'offre pas l'action à qui ne la porte pas.
 */
export async function createProperty(
  db: PropertiesDatabase,
  context: AccessContext,
  input: unknown,
): Promise<PropertyView> {
  const data = parseOrThrow(createPropertySchema, input);

  requirePermission(context, 'property.create', { organizationId: data.organizationId });

  // Pré-contrôle du nom : il permet un message clair AVANT l'écriture. La
  // contrainte de base reste l'arbitre, plus bas, en cas de course.
  const homonym = await findPropertyByName(db, data.organizationId, data.name);

  if (homonym) throw new PropertyNameAlreadyUsedError(data.name);

  try {
    const property = await insertProperty(db, {
      organizationId: data.organizationId,
      name: data.name,
      address: data.address,
      city: data.city,
      district: data.district,
      description: data.description,
    });

    return toPropertyView(property);
  } catch (error) {
    if (isUniqueViolation(error, PROPERTY_NAME_CONSTRAINT)) {
      throw new PropertyNameAlreadyUsedError(data.name);
    }

    throw error;
  }
}

export type PropertyCollection = {
  properties: PropertyView[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
};

/**
 * Liste les immeubles lisibles (MVP-BACKLOG-017).
 *
 * Le périmètre est traduit en conditions SQL : un gestionnaire ne reçoit que les
 * immeubles de son périmètre, et rien n'est filtré après lecture (API section
 * 67). Une demande explicite d'organisation hors des siennes ne renvoie pas une
 * erreur mais une collection vide, pour la même raison qu'un NOT_FOUND : ne rien
 * confirmer.
 */
export async function listProperties(
  db: PropertiesDatabase,
  context: AccessContext,
  query: unknown,
): Promise<PropertyCollection> {
  const parsed = parseOrThrow(listPropertiesQuerySchema, query);
  const scopes = readablePropertyScopes(context, 'property.read').filter(
    (scope) => parsed.organizationId === null || scope.organizationId === parsed.organizationId,
  );

  const { rows, total } = await listPropertyRows(db, scopes, parsed);
  const occupancies = await occupancyOf(
    db,
    rows.map((row) => row.id),
  );

  return {
    properties: rows.map((row) => toPropertyView(row, occupancies.get(row.id))),
    meta: {
      page: parsed.page,
      pageSize: parsed.pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / parsed.pageSize)),
    },
  };
}

/** Consulte un immeuble. */
export async function getProperty(
  db: PropertiesDatabase,
  context: AccessContext,
  propertyId: string,
): Promise<PropertyView> {
  const property = await loadAccessibleProperty(db, context, propertyId, 'property.read');

  return viewOf(db, property);
}

/**
 * Modifie un immeuble (MVP-BACKLOG-017).
 *
 * Le gestionnaire en dispose sur son périmètre : `property.update` figure dans
 * ses capacités, contrairement à la création et à l'archivage (DEC-025).
 *
 * Une modification sans différence réelle n'écrit rien et ne lève pas d'erreur :
 * l'utilisateur qui soumet un formulaire inchangé a obtenu le résultat qu'il
 * voulait, et `updated_at` ne doit pas mentir pour autant.
 */
export async function updateProperty(
  db: PropertiesDatabase,
  context: AccessContext,
  propertyId: string,
  input: unknown,
): Promise<PropertyView> {
  const data = parseOrThrow(updatePropertySchema, input);
  const property = await loadAccessibleProperty(db, context, propertyId, 'property.update');

  assertModifiable(property);

  const changes = changedFields(property, data);

  if (!hasChanges(changes)) return viewOf(db, property);

  if (changes.name !== undefined) {
    const homonym = await findPropertyByName(db, property.organizationId, changes.name);

    if (homonym && homonym.id !== property.id) {
      throw new PropertyNameAlreadyUsedError(changes.name);
    }
  }

  try {
    const updated = await updatePropertyRow(db, property.id, changes);

    return viewOf(db, updated);
  } catch (error) {
    if (changes.name !== undefined && isUniqueViolation(error, PROPERTY_NAME_CONSTRAINT)) {
      throw new PropertyNameAlreadyUsedError(changes.name);
    }

    throw error;
  }
}

/**
 * Archive un immeuble (MVP-BACKLOG-017, BR-025).
 *
 * Réservé au propriétaire (DEC-025). Aucune suppression : l'immeuble sort de
 * l'exploitation, son historique reste lisible, et ses appartements ne sont pas
 * touchés. La cascade sur les appartements, si elle est souhaitée, relèvera du
 * lot Appartements : elle changerait leur statut, ce qui est une décision
 * distincte.
 */
export async function archiveProperty(
  db: PropertiesDatabase,
  context: AccessContext,
  propertyId: string,
): Promise<PropertyView> {
  const property = await loadAccessibleProperty(db, context, propertyId, 'property.archive');

  assertArchivable(property);

  const archived = await archivePropertyRow(db, property.id);

  // La ligne n'est pas revenue : un autre appel l'a archivée entre la lecture et
  // l'écriture. Le refus est le même que celui du contrôle précédent.
  if (!archived) throw new ArchivedPropertyError('already-archived');

  return viewOf(db, archived);
}
