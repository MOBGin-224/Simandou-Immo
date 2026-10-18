import { and, eq } from 'drizzle-orm';

import {
  apartments,
  leases,
  userAccess,
  users,
  type IncidentStatusHistoryEntry,
} from '@/db/schema';
import {
  PermissionDeniedError,
  ResourceOutOfScopeError,
  requirePermission,
  type AccessContext,
} from '@/lib/authorization';

import { IncidentClosedError, IncidentNotFoundError, InvalidTransitionError } from './errors';
import {
  findIncidentById,
  insertIncidentCommentTx,
  insertIncidentTx,
  listIncidentComments,
  listIncidentsForContext,
  listIncidentStatusHistory,
  transitionIncidentStatusTx,
  updateIncidentAssignmentTx,
  updateIncidentFieldsTx,
  type IncidentCommentWithAuthor,
  type IncidentListFilters,
  type IncidentListResult,
  type IncidentsDatabase,
  type IncidentWithRelations,
} from './repository';
import { parseAddComment, parseCreateIncident, parseUpdateIncident } from './schemas';
import { isTransitionAllowed, type IncidentStatus } from './transitions';

/**
 * Service Incidents (Lot 13, DEC-059).
 *
 * Le dépôt applique déjà la visibilité de lecture (section 4.2). Ce module
 * ajoute les permissions FINES d'écriture (section 4) que `requirePermission`
 * seul ne couvre pas : un droit de création conditionné à un bail, une règle
 * qui s'ouvre tant qu'un incident reste OPEN, une affectation réservée à
 * MANAGER et OWNER quelle que soit la visibilité du TENANT sur l'incident.
 */

type ApartmentScope = { id: string; organizationId: string; propertyId: string };

async function loadApartmentScope(
  db: IncidentsDatabase,
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

/** DEC-059, 4.1 : le TENANT ne crée que sur un logement où il tient un bail ACTIF. */
async function hasActiveLeaseOnApartment(
  db: IncidentsDatabase,
  apartmentId: string,
  tenantUserId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: leases.id })
    .from(leases)
    .where(
      and(
        eq(leases.apartmentId, apartmentId),
        eq(leases.tenantUserId, tenantUserId),
        eq(leases.status, 'ACTIVE'),
      ),
    )
    .limit(1);

  return row !== undefined;
}

/** L'utilisateur cible a-t-il un accès ACTIF à cette organisation (DEC-059, 4.4). */
async function userBelongsToOrganization(
  db: IncidentsDatabase,
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

async function withRelationsOrThrow(
  db: IncidentsDatabase,
  incidentId: string,
  context: AccessContext,
): Promise<IncidentWithRelations> {
  const result = await findIncidentById(db, incidentId, context);
  if (!result) throw new IncidentNotFoundError();
  return result;
}

/**
 * MANAGER (sur périmètre) ou OWNER, et rien d'autre : l'affectation et les
 * transitions de statut (hors création et édition descriptive) sont des
 * actes de gestion (DEC-059, 4.3 et 4.4). Un TENANT qui voit l'incident
 * (créateur, ou bail actif) reçoit `PermissionDeniedError` et non
 * `ResourceOutOfScopeError` : il atteint bien la ressource, il n'a
 * simplement pas le droit d'agir sur elle.
 */
function requireManagerOrOwnerForIncident(
  context: AccessContext,
  incident: { organizationId: string; propertyId: string },
): void {
  const isTenantHere = context.memberships.some(
    (membership) =>
      membership.organizationId === incident.organizationId && membership.role === 'TENANT',
  );

  if (isTenantHere) throw new PermissionDeniedError('incident.update');

  requirePermission(context, 'incident.update', {
    organizationId: incident.organizationId,
    propertyId: incident.propertyId,
  });
}

/**
 * Crée un incident (DEC-059, section 4.1).
 *
 * Le TENANT doit tenir un bail ACTIF sur le logement visé ; MANAGER et OWNER
 * suivent le périmètre habituel via `incident.create`. `createdByUserId` est
 * toujours l'appelant : personne ne déclare un incident pour un tiers.
 */
export async function createIncident(
  db: IncidentsDatabase,
  input: unknown,
  context: AccessContext,
): Promise<IncidentWithRelations> {
  const data = parseCreateIncident(input);

  const apartment = await loadApartmentScope(db, data.apartmentId);
  if (!apartment) throw new ResourceOutOfScopeError();

  const isTenantInOrganization = context.memberships.some(
    (membership) =>
      membership.organizationId === apartment.organizationId && membership.role === 'TENANT',
  );

  if (isTenantInOrganization) {
    const hasLease = await hasActiveLeaseOnApartment(db, apartment.id, context.userId);
    if (!hasLease) throw new ResourceOutOfScopeError();
  } else {
    requirePermission(context, 'incident.create', {
      organizationId: apartment.organizationId,
      propertyId: apartment.propertyId,
    });
  }

  const incident = await insertIncidentTx(db, {
    organizationId: apartment.organizationId,
    propertyId: apartment.propertyId,
    apartmentId: apartment.id,
    createdByUserId: context.userId,
    title: data.title,
    description: data.description,
    priority: data.priority,
    category: data.category,
  });

  return withRelationsOrThrow(db, incident.id, context);
}

export async function getIncident(
  db: IncidentsDatabase,
  incidentId: string,
  context: AccessContext,
): Promise<IncidentWithRelations> {
  return withRelationsOrThrow(db, incidentId, context);
}

export async function listIncidents(
  db: IncidentsDatabase,
  context: AccessContext,
  filters: IncidentListFilters = {},
): Promise<IncidentListResult> {
  return listIncidentsForContext(db, context, filters);
}

/**
 * Modifie les champs descriptifs (DEC-059, 4.5).
 *
 * Le créateur TENANT garde la main tant que l'incident est OPEN ; au-delà,
 * seuls MANAGER (sur périmètre) et OWNER modifient, et plus personne une
 * fois CLOSED.
 */
export async function updateIncident(
  db: IncidentsDatabase,
  incidentId: string,
  input: unknown,
  context: AccessContext,
): Promise<IncidentWithRelations> {
  const fields = parseUpdateIncident(input);

  const current = await findIncidentById(db, incidentId, context);
  if (!current) throw new IncidentNotFoundError();

  if (current.incident.status === 'CLOSED') throw new IncidentClosedError();

  const isCreatorOnOpen =
    current.incident.status === 'OPEN' && current.incident.createdByUserId === context.userId;

  if (!isCreatorOnOpen) {
    requireManagerOrOwnerForIncident(context, current.incident);
  }

  const updated = await updateIncidentFieldsTx(db, incidentId, fields, context);

  return withRelationsOrThrow(db, updated.id, context);
}

/**
 * Affecte ou réaffecte un incident (DEC-059, 4.4). Réservée à MANAGER (sur
 * périmètre) et OWNER ; la personne affectée doit appartenir à la même
 * organisation que l'incident.
 */
export async function assignIncident(
  db: IncidentsDatabase,
  incidentId: string,
  assignedToUserId: string,
  context: AccessContext,
): Promise<IncidentWithRelations> {
  const current = await findIncidentById(db, incidentId, context);
  if (!current) throw new IncidentNotFoundError();

  requireManagerOrOwnerForIncident(context, current.incident);

  if (current.incident.status === 'CLOSED') throw new IncidentClosedError();

  const targetBelongs = await userBelongsToOrganization(
    db,
    assignedToUserId,
    current.incident.organizationId,
  );
  if (!targetBelongs) throw new ResourceOutOfScopeError();

  const updated = await updateIncidentAssignmentTx(
    db,
    incidentId,
    assignedToUserId,
    context.userId,
    context,
  );

  return withRelationsOrThrow(db, updated.id, context);
}

/**
 * Transition de statut (DEC-017, DEC-059 sections 4.3, 6 et 8).
 *
 * Réservée à MANAGER (sur périmètre) et OWNER, jamais au TENANT. Les
 * vérifications de transition, d'affectation et de motif sont refaites ICI
 * avant d'appeler le dépôt, pour que l'appelant reçoive l'erreur précise
 * sans dépendre du contenu du message SQL.
 */
export async function transitionStatus(
  db: IncidentsDatabase,
  incidentId: string,
  toStatus: IncidentStatus,
  reason: string | null,
  context: AccessContext,
): Promise<IncidentWithRelations> {
  const current = await findIncidentById(db, incidentId, context);
  if (!current) throw new IncidentNotFoundError();

  requireManagerOrOwnerForIncident(context, current.incident);

  if (!isTransitionAllowed(current.incident.status, toStatus)) {
    throw new InvalidTransitionError(current.incident.status, toStatus);
  }

  const updated = await transitionIncidentStatusTx(
    db,
    incidentId,
    toStatus,
    context.userId,
    reason,
    context,
  );

  return withRelationsOrThrow(db, updated.id, context);
}

/** Commentaire partagé (DEC-059, 2.3 et 4.6) : tout utilisateur voyant l'incident peut en poster. */
export async function addComment(
  db: IncidentsDatabase,
  incidentId: string,
  content: string,
  context: AccessContext,
): Promise<IncidentCommentWithAuthor> {
  const data = parseAddComment({ content });

  const current = await findIncidentById(db, incidentId, context);
  if (!current) throw new IncidentNotFoundError();

  const inserted = await insertIncidentCommentTx(
    db,
    incidentId,
    context.userId,
    data.content,
    context,
  );

  const [authorRow] = await db
    .select({ fullName: users.fullName })
    .from(users)
    .where(eq(users.id, inserted.authorUserId))
    .limit(1);

  return { comment: inserted, authorName: authorRow?.fullName ?? '' };
}

export async function listComments(
  db: IncidentsDatabase,
  incidentId: string,
  context: AccessContext,
): Promise<IncidentCommentWithAuthor[]> {
  return listIncidentComments(db, incidentId, context);
}

export async function listHistory(
  db: IncidentsDatabase,
  incidentId: string,
  context: AccessContext,
): Promise<IncidentStatusHistoryEntry[]> {
  return listIncidentStatusHistory(db, incidentId, context);
}
