import { and, eq } from 'drizzle-orm';

import {
  apartments,
  properties,
  userAccess,
  type InterventionStatusHistoryEntry,
} from '@/db/schema';
import {
  PermissionDeniedError,
  ResourceOutOfScopeError,
  requirePermission,
  type AccessContext,
  type Permission,
} from '@/lib/authorization';

import {
  InterventionNotFoundError,
  InterventionTerminalError,
  InterventionValidationError,
  InvalidTransitionError,
  MissingActualCostError,
  MissingReasonError,
} from './errors';
import {
  findInterventionById,
  insertInterventionTx,
  listInterventionsForContext,
  listInterventionsForIncident as listInterventionsForIncidentFromRepository,
  listInterventionStatusHistory,
  loadVisibleIncidentSummary,
  transitionInterventionStatusTx,
  updateInterventionFieldsTx,
  type InterventionFull,
  type InterventionListFilters,
  type InterventionListResult,
  type InterventionMinimal,
  type InterventionsDatabase,
} from './repository';
import { parseCreateIntervention, parseTransitionStatus, parseUpdateIntervention } from './schemas';
import { isTransitionAllowed } from './transitions';

/**
 * Service Interventions (Lot 14, DEC-060).
 *
 * Le dépôt applique déjà la visibilité de LECTURE (section 8.2). Ce module
 * ajoute les permissions FINES d'écriture (section 8.1, 8.3, 8.4) que
 * `requirePermission` seul ne couvre pas, et la cohérence avec l'incident
 * parent (section 3.4), qui n'est ni une question de permission ni une
 * contrainte SQL.
 */

type PropertyScope = { id: string; organizationId: string };
type ApartmentScope = { id: string; organizationId: string; propertyId: string };

async function loadPropertyScope(
  db: InterventionsDatabase,
  propertyId: string,
): Promise<PropertyScope | undefined> {
  const [row] = await db
    .select({ id: properties.id, organizationId: properties.organizationId })
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);

  return row;
}

async function loadApartmentScope(
  db: InterventionsDatabase,
  apartmentId: string,
): Promise<ApartmentScope | undefined> {
  const [row] = await db
    .select({
      id: apartments.id,
      organizationId: apartments.organizationId,
      propertyId: apartments.propertyId,
    })
    .from(apartments)
    .where(eq(apartments.id, apartmentId))
    .limit(1);

  return row;
}

/** L'utilisateur cible a-t-il un accès ACTIF à cette organisation (DEC-060, 8.5). */
async function userBelongsToOrganization(
  db: InterventionsDatabase,
  targetUserId: string,
  organizationId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: userAccess.id })
    .from(userAccess)
    .where(
      and(
        eq(userAccess.userId, targetUserId),
        eq(userAccess.organizationId, organizationId),
        eq(userAccess.status, 'ACTIVE'),
      ),
    )
    .limit(1);

  return Boolean(row);
}

/**
 * MANAGER (sur périmètre) ou OWNER, et rien d'autre : création, modification
 * et transitions sont des actes de gestion (DEC-060, 8.1, 8.3, 8.4). Un
 * TENANT qui appartient à l'organisation reçoit `PermissionDeniedError` et
 * non `ResourceOutOfScopeError` : il peut par ailleurs voir la ressource
 * (section 8.2), il n'a simplement pas le droit d'agir sur elle.
 */
function requireManagerOrOwner(
  context: AccessContext,
  resource: { organizationId: string; propertyId: string },
  permission: Permission,
): void {
  const isTenantHere = context.memberships.some(
    (membership) =>
      membership.organizationId === resource.organizationId && membership.role === 'TENANT',
  );

  if (isTenantHere) throw new PermissionDeniedError(permission);

  requirePermission(context, permission, resource);
}

/** MANAGER (sur périmètre) ou OWNER : 'full' ; TENANT seul : 'minimal' (DEC-060, 8.2). */
function projectionForContext(
  context: AccessContext,
  resource: { organizationId: string },
): 'full' | 'minimal' {
  const isManagerOrOwnerHere = context.memberships.some(
    (membership) =>
      membership.organizationId === resource.organizationId &&
      (membership.role === 'MANAGER' || membership.role === 'OWNER'),
  );

  return isManagerOrOwnerHere ? 'full' : 'minimal';
}

/**
 * La projection d'une LISTE ne peut pas se décider à partir d'une seule
 * ressource déjà chargée : elle doit valoir pour tout le périmètre consulté.
 * Un utilisateur qui porte MANAGER ou OWNER dans AU MOINS une organisation
 * reçoit la vue complète pour ce qu'il y voit ; un TENANT pur reçoit la vue
 * minimisée. Le dépôt, lui, continue de filtrer la visibilité ligne par ligne.
 */
function projectionForListing(context: AccessContext): 'full' | 'minimal' {
  const hasManagerOrOwnerMembership = context.memberships.some(
    (membership) => membership.role === 'MANAGER' || membership.role === 'OWNER',
  );

  return hasManagerOrOwnerMembership ? 'full' : 'minimal';
}

async function loadFullOrThrow(
  db: InterventionsDatabase,
  interventionId: string,
  context: AccessContext,
): Promise<InterventionFull> {
  const found = await findInterventionById(db, interventionId, context, 'full');
  if (!found) throw new InterventionNotFoundError();

  return found;
}

/**
 * Crée une intervention (DEC-060, section 8.1).
 *
 * `createdByUserId` est toujours l'appelant. `incidentId`, s'il est fourni,
 * doit être visible du contexte ET désigner exactement le même immeuble et
 * le même logement que l'intervention (DEC-060, 3.4) : une incohérence est
 * une erreur de SAISIE (422), pas un problème de périmètre.
 */
export async function createIntervention(
  db: InterventionsDatabase,
  input: unknown,
  context: AccessContext,
): Promise<InterventionFull> {
  const data = parseCreateIntervention(input);

  const property = await loadPropertyScope(db, data.propertyId);
  if (!property) throw new ResourceOutOfScopeError();

  requireManagerOrOwner(
    context,
    { organizationId: property.organizationId, propertyId: property.id },
    'intervention.create',
  );

  let apartment: ApartmentScope | undefined;
  if (data.apartmentId) {
    apartment = await loadApartmentScope(db, data.apartmentId);
    if (!apartment || apartment.propertyId !== property.id) {
      throw new ResourceOutOfScopeError();
    }
  }

  if (data.incidentId) {
    const incident = await loadVisibleIncidentSummary(db, data.incidentId, context);
    if (!incident) throw new ResourceOutOfScopeError();

    if (incident.propertyId !== data.propertyId || incident.apartmentId !== data.apartmentId) {
      throw new InterventionValidationError({
        incidentId: [
          "L'incident désigné ne correspond pas au même immeuble et au même logement que l'intervention.",
        ],
      });
    }
  }

  if (data.assignedToUserId) {
    const targetBelongs = await userBelongsToOrganization(
      db,
      data.assignedToUserId,
      property.organizationId,
    );
    if (!targetBelongs) throw new ResourceOutOfScopeError();
  }

  const inserted = await insertInterventionTx(db, {
    organizationId: property.organizationId,
    propertyId: property.id,
    apartmentId: data.apartmentId,
    incidentId: data.incidentId,
    createdByUserId: context.userId,
    assignedToUserId: data.assignedToUserId,
    title: data.title,
    description: data.description,
    providerName: data.providerName,
    providerPhone: data.providerPhone,
    plannedFor: data.plannedFor,
    estimatedCost: data.estimatedCost,
  });

  return loadFullOrThrow(db, inserted.id, context);
}

export async function getIntervention(
  db: InterventionsDatabase,
  interventionId: string,
  context: AccessContext,
): Promise<InterventionFull | InterventionMinimal> {
  // La projection se décide APRÈS avoir trouvé la ressource en version
  // complète : c'est la seule qui porte `organizationId`, nécessaire pour
  // savoir si l'appelant y est MANAGER ou OWNER.
  const full = await findInterventionById(db, interventionId, context, 'full');
  if (!full) throw new InterventionNotFoundError();

  if (projectionForContext(context, full) === 'full') return full;

  const minimal = await findInterventionById(db, interventionId, context, 'minimal');
  if (!minimal) throw new InterventionNotFoundError();

  return minimal;
}

export async function listInterventions(
  db: InterventionsDatabase,
  context: AccessContext,
  filters: InterventionListFilters = {},
): Promise<InterventionListResult> {
  return listInterventionsForContext(db, context, filters, projectionForListing(context));
}

/**
 * Modifie les champs autorisés (DEC-060, 8.3). Réservée à MANAGER (sur
 * périmètre) et OWNER ; refuse toute écriture sur une intervention
 * terminale, et tout champ hors de la liste autorisée pour le statut
 * courant (vérifié ICI pour un message clair, puis REVÉRIFIÉ par le
 * dépôt en transaction).
 */
export async function updateIntervention(
  db: InterventionsDatabase,
  interventionId: string,
  input: unknown,
  context: AccessContext,
): Promise<InterventionFull> {
  const fields = parseUpdateIntervention(input);

  const current = await findInterventionById(db, interventionId, context, 'full');
  if (!current) throw new InterventionNotFoundError();

  requireManagerOrOwner(context, current, 'intervention.update');

  if (current.status === 'COMPLETED' || current.status === 'CANCELLED') {
    throw new InterventionTerminalError();
  }

  if (current.status === 'IN_PROGRESS') {
    const disallowed = Object.keys(fields).filter(
      (key) => !['providerName', 'providerPhone', 'estimatedCost'].includes(key),
    );

    if (disallowed.length > 0) {
      throw new InterventionValidationError(
        Object.fromEntries(
          disallowed.map((key) => [
            key,
            [`Ce champ ne peut pas être modifié au statut ${current.status}.`],
          ]),
        ),
      );
    }
  }

  const updated = await updateInterventionFieldsTx(db, interventionId, fields, context);

  return loadFullOrThrow(db, updated.id, context);
}

/**
 * Transition de statut (DEC-018, DEC-060 sections 4, 8.4 et 9).
 *
 * Réservée à MANAGER (sur périmètre) et OWNER. `actualCost` n'est accepté
 * QUE pour COMPLETED (DEC-060, 4.5 et 7.4) : fourni ailleurs, il est transmis
 * au dépôt qui l'ignore silencieusement puisqu'il ne l'applique qu'à ce
 * statut, mais le schéma ne le permet déjà que couplé à `toStatus`.
 */
export async function transitionStatus(
  db: InterventionsDatabase,
  interventionId: string,
  input: unknown,
  context: AccessContext,
): Promise<InterventionFull> {
  const data = parseTransitionStatus(input);

  const current = await findInterventionById(db, interventionId, context, 'full');
  if (!current) throw new InterventionNotFoundError();

  requireManagerOrOwner(context, current, 'intervention.update');

  if (!isTransitionAllowed(current.status, data.toStatus)) {
    // Le dépôt revérifie et lève la même erreur ; la lever ICI évite un aller
    // retour en base pour un cas que le service peut déjà trancher.
    throw new InvalidTransitionError(current.status, data.toStatus);
  }

  if (data.toStatus === 'CANCELLED' && (!data.reason || data.reason.trim().length === 0)) {
    throw new MissingReasonError();
  }

  if (data.toStatus === 'COMPLETED' && data.actualCost == null && current.actualCost == null) {
    throw new MissingActualCostError();
  }

  const updated = await transitionInterventionStatusTx(
    db,
    interventionId,
    data.toStatus,
    context.userId,
    data.reason ?? null,
    context,
    data.actualCost,
  );

  return loadFullOrThrow(db, updated.id, context);
}

/**
 * Interventions liées à un incident (DEC-060, 3.5). L'incident doit être
 * visible du contexte, sinon `ResourceOutOfScopeError` (404 côté API) : un
 * identifiant hors périmètre ne doit jamais confirmer qu'un incident existe.
 */
export async function listInterventionsForIncident(
  db: InterventionsDatabase,
  incidentId: string,
  context: AccessContext,
): Promise<Array<InterventionFull | InterventionMinimal>> {
  const incident = await loadVisibleIncidentSummary(db, incidentId, context);
  if (!incident) throw new ResourceOutOfScopeError();

  return listInterventionsForIncidentFromRepository(
    db,
    incidentId,
    context,
    projectionForContext(context, incident),
  );
}

export async function listHistory(
  db: InterventionsDatabase,
  interventionId: string,
  context: AccessContext,
): Promise<InterventionStatusHistoryEntry[]> {
  const current = await findInterventionById(db, interventionId, context, 'minimal');
  if (!current) throw new InterventionNotFoundError();

  return listInterventionStatusHistory(db, interventionId, context);
}
