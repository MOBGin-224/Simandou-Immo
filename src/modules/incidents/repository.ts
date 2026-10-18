import { and, asc, count, desc, eq, inArray, or } from 'drizzle-orm';
import { alias, type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core';

import * as schema from '@/db/schema';
import {
  apartments,
  incidentComments,
  incidents,
  incidentStatusHistory,
  leases,
  organizations,
  properties,
  users,
  type Incident,
  type IncidentComment,
  type IncidentStatusHistoryEntry,
  type NewIncident,
  type NewIncidentComment,
  type NewIncidentStatusHistoryEntry,
} from '@/db/schema';
import {
  propertyScopeCondition,
  readablePropertyScopes,
  type AccessContext,
} from '@/lib/authorization';

import {
  IncidentClosedError,
  IncidentNotFoundError,
  InvalidTransitionError,
  MissingAssignmentError,
  MissingReasonError,
} from './errors';
import { isTransitionAllowed, type IncidentStatus } from './transitions';

/**
 * Accès aux données du module Incidents (Lot 13, DEC-059).
 *
 * Même règle que les modules précédents : ce dépôt ne décide rien, il
 * applique la condition de visibilité que lui donne `AccessContext` et ne
 * contourne jamais le périmètre (ADR-007).
 */

/** Instance Drizzle, quel que soit son pilote : postgres.js ou PGlite. */
export type IncidentsDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

export type IncidentWithRelations = {
  incident: Incident;
  apartmentName: string;
  propertyName: string;
  organizationName: string;
  createdByName: string;
  assignedToName: string | null;
};

export type IncidentCommentWithAuthor = {
  comment: IncidentComment;
  authorName: string;
};

export type IncidentListFilters = {
  page?: number;
  pageSize?: number;
  status?: IncidentStatus[];
  priority?: Incident['priority'];
  category?: string;
  propertyId?: string;
  apartmentId?: string;
  assignedToUserId?: string;
  /** DEC-059, 10.1 : filtre virtuel status IN (OPEN, ASSIGNED). */
  toProcess?: boolean;
};

export type IncidentListResult = {
  incidents: IncidentWithRelations[];
  meta: { total: number; page: number; pageSize: number };
};

export type InsertIncidentPayload = {
  organizationId: string;
  propertyId: string;
  apartmentId: string;
  createdByUserId: string;
  title: string;
  description: string;
  priority: Incident['priority'];
  category: string;
};

export type UpdateIncidentFields = Partial<{
  title: string;
  description: string;
  priority: Incident['priority'];
  category: string;
}>;

const DEFAULT_PAGE_SIZE = 20;
const TO_PROCESS_STATUSES: IncidentStatus[] = ['OPEN', 'ASSIGNED'];

/**
 * Périmètre de visibilité d'un incident (DEC-059, 4.2).
 *
 * OWNER et MANAGER suivent le périmètre d'immeuble habituel
 * (`propertyScopeCondition`). `incidents` ne dénormalise pas de
 * `tenant_user_id` : le TENANT voit ses propres incidents (créateur) ou ceux
 * d'un logement où il tient un bail ACTIF, d'où la sous-requête sur `leases`.
 * Elle se passe de jointure : `inArray` l'exprime comme une CONDITION SQL, pas
 * comme une lecture préalable.
 */
function incidentVisibilityCondition(db: IncidentsDatabase, context: AccessContext) {
  const scopes = readablePropertyScopes(context, 'incident.read');
  const propertyCondition = propertyScopeCondition(scopes, {
    organizationId: incidents.organizationId,
    propertyId: incidents.propertyId,
  });

  const isTenant = context.memberships.some((membership) => membership.role === 'TENANT');
  const tenantCondition = isTenant
    ? or(
        eq(incidents.createdByUserId, context.userId),
        inArray(
          incidents.apartmentId,
          db
            .select({ apartmentId: leases.apartmentId })
            .from(leases)
            .where(and(eq(leases.tenantUserId, context.userId), eq(leases.status, 'ACTIVE'))),
        ),
      )
    : undefined;

  return or(propertyCondition, tenantCondition);
}

/** Lecture jointe réutilisée par `findIncidentById` et la liste. */
function baseIncidentQuery(db: IncidentsDatabase) {
  const createdBy = alias(users, 'incident_created_by');
  const assignedTo = alias(users, 'incident_assigned_to');

  return db
    .select({
      incident: incidents,
      apartmentName: apartments.number,
      propertyName: properties.name,
      organizationName: organizations.name,
      createdByName: createdBy.fullName,
      assignedToName: assignedTo.fullName,
    })
    .from(incidents)
    .innerJoin(apartments, eq(apartments.id, incidents.apartmentId))
    .innerJoin(properties, eq(properties.id, incidents.propertyId))
    .innerJoin(organizations, eq(organizations.id, incidents.organizationId))
    .innerJoin(createdBy, eq(createdBy.id, incidents.createdByUserId))
    .leftJoin(assignedTo, eq(assignedTo.id, incidents.assignedToUserId));
}

function toWithRelations(row: {
  incident: Incident;
  apartmentName: string;
  propertyName: string;
  organizationName: string;
  createdByName: string;
  assignedToName: string | null;
}): IncidentWithRelations {
  return row;
}

/** L'incident est-il visible pour ce contexte, sans en charger les relations. */
async function isIncidentVisible(
  db: IncidentsDatabase,
  incidentId: string,
  context: AccessContext,
): Promise<boolean> {
  const visibilityCondition = incidentVisibilityCondition(db, context);
  if (!visibilityCondition) return false;

  const [row] = await db
    .select({ id: incidents.id })
    .from(incidents)
    .where(and(eq(incidents.id, incidentId), visibilityCondition))
    .limit(1);

  return Boolean(row);
}

/** Charge l'incident brut en appliquant le périmètre, ou lève `IncidentNotFoundError`. */
async function loadVisibleIncident(
  db: IncidentsDatabase,
  incidentId: string,
  context: AccessContext,
): Promise<Incident> {
  const visibilityCondition = incidentVisibilityCondition(db, context);
  if (!visibilityCondition) throw new IncidentNotFoundError();

  const [row] = await db
    .select()
    .from(incidents)
    .where(and(eq(incidents.id, incidentId), visibilityCondition))
    .limit(1);

  if (!row) throw new IncidentNotFoundError();

  return row;
}

// --- Lecture ------------------------------------------------------------------

export async function findIncidentById(
  db: IncidentsDatabase,
  incidentId: string,
  context: AccessContext,
): Promise<IncidentWithRelations | null> {
  const visibilityCondition = incidentVisibilityCondition(db, context);
  if (!visibilityCondition) return null;

  const [row] = await baseIncidentQuery(db)
    .where(and(eq(incidents.id, incidentId), visibilityCondition))
    .limit(1);

  return row ? toWithRelations(row) : null;
}

export async function listIncidentsForContext(
  db: IncidentsDatabase,
  context: AccessContext,
  filters: IncidentListFilters = {},
): Promise<IncidentListResult> {
  const visibilityCondition = incidentVisibilityCondition(db, context);
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;

  if (!visibilityCondition) {
    return { incidents: [], meta: { total: 0, page, pageSize } };
  }

  const where = and(
    visibilityCondition,
    filters.status && filters.status.length > 0
      ? inArray(incidents.status, filters.status)
      : undefined,
    filters.priority ? eq(incidents.priority, filters.priority) : undefined,
    filters.category ? eq(incidents.category, filters.category) : undefined,
    filters.propertyId ? eq(incidents.propertyId, filters.propertyId) : undefined,
    filters.apartmentId ? eq(incidents.apartmentId, filters.apartmentId) : undefined,
    filters.assignedToUserId ? eq(incidents.assignedToUserId, filters.assignedToUserId) : undefined,
    filters.toProcess ? inArray(incidents.status, TO_PROCESS_STATUSES) : undefined,
  );

  const offset = (page - 1) * pageSize;

  const [rows, [totalRow]] = await Promise.all([
    baseIncidentQuery(db)
      .where(where)
      .orderBy(desc(incidents.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ total: count() }).from(incidents).where(where),
  ]);

  return {
    incidents: rows.map(toWithRelations),
    meta: { total: totalRow?.total ?? 0, page, pageSize },
  };
}

/**
 * Historique trié du plus ancien au plus récent (DEC-059, 6.2). Un périmètre
 * qui ne voit pas l'incident reçoit un tableau vide, jamais une erreur :
 * l'historique n'existe pas pour lui.
 */
export async function listIncidentStatusHistory(
  db: IncidentsDatabase,
  incidentId: string,
  context: AccessContext,
): Promise<IncidentStatusHistoryEntry[]> {
  const visible = await isIncidentVisible(db, incidentId, context);
  if (!visible) return [];

  return db
    .select()
    .from(incidentStatusHistory)
    .where(eq(incidentStatusHistory.incidentId, incidentId))
    .orderBy(asc(incidentStatusHistory.createdAt));
}

/** Même règle de périmètre que l'historique : vide plutôt qu'une erreur. */
export async function listIncidentComments(
  db: IncidentsDatabase,
  incidentId: string,
  context: AccessContext,
): Promise<IncidentCommentWithAuthor[]> {
  const visible = await isIncidentVisible(db, incidentId, context);
  if (!visible) return [];

  return db
    .select({ comment: incidentComments, authorName: users.fullName })
    .from(incidentComments)
    .innerJoin(users, eq(users.id, incidentComments.authorUserId))
    .where(eq(incidentComments.incidentId, incidentId))
    .orderBy(asc(incidentComments.createdAt));
}

// --- Écriture ------------------------------------------------------------------

/**
 * Crée l'incident en OPEN et sa ligne de création dans l'historique, dans la
 * même transaction (DEC-059, 2.1 et 6.1).
 */
export async function insertIncidentTx(
  db: IncidentsDatabase,
  payload: InsertIncidentPayload,
): Promise<Incident> {
  return db.transaction(async (tx) => {
    const values: NewIncident = {
      organizationId: payload.organizationId,
      propertyId: payload.propertyId,
      apartmentId: payload.apartmentId,
      createdByUserId: payload.createdByUserId,
      title: payload.title,
      description: payload.description,
      priority: payload.priority,
      status: 'OPEN',
      category: payload.category,
    };

    const [inserted] = await tx.insert(incidents).values(values).returning();
    if (!inserted) throw new Error('INCIDENT_INSERT_RETURNED_NO_ROW');

    const historyValues: NewIncidentStatusHistoryEntry = {
      incidentId: inserted.id,
      fromStatus: null,
      toStatus: 'OPEN',
      byUserId: payload.createdByUserId,
    };

    await tx.insert(incidentStatusHistory).values(historyValues);

    return inserted;
  });
}

/**
 * Met à jour les champs descriptifs (DEC-059, 4.5). Les permissions fines
 * (TENANT créateur seul en OPEN, etc.) sont du ressort du service : cette
 * fonction vérifie seulement le périmètre et qu'un incident CLOSED ne se
 * modifie plus.
 */
export async function updateIncidentFieldsTx(
  db: IncidentsDatabase,
  incidentId: string,
  fields: UpdateIncidentFields,
  context: AccessContext,
): Promise<Incident> {
  return db.transaction(async (tx) => {
    const current = await loadVisibleIncident(tx, incidentId, context);

    if (current.status === 'CLOSED') throw new IncidentClosedError();

    const [updated] = await tx
      .update(incidents)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(incidents.id, incidentId))
      .returning();

    if (!updated) throw new IncidentNotFoundError();

    return updated;
  });
}

/**
 * Affecte ou réaffecte un incident (DEC-059, 4.4). Ne change jamais le
 * statut : le passage à ASSIGNED passe par `transitionIncidentStatusTx`.
 */
export async function updateIncidentAssignmentTx(
  db: IncidentsDatabase,
  incidentId: string,
  assignedToUserId: string,
  assignedByUserId: string,
  context: AccessContext,
): Promise<Incident> {
  return db.transaction(async (tx) => {
    const current = await loadVisibleIncident(tx, incidentId, context);

    if (current.status === 'CLOSED') throw new IncidentClosedError();

    const [updated] = await tx
      .update(incidents)
      .set({
        assignedToUserId,
        assignedAt: new Date(),
        assignedByUserId,
        updatedAt: new Date(),
      })
      .where(eq(incidents.id, incidentId))
      .returning();

    if (!updated) throw new IncidentNotFoundError();

    return updated;
  });
}

/**
 * Transition de statut (DEC-017, DEC-059 sections 6 et 8).
 *
 * `resolvedAt` et `closedAt` ne sont renseignées qu'à l'entrée dans leur
 * statut et ne sont jamais effacées (DEC-059, 2.1) : une transition
 * RESOLVED -> IN_PROGRESS laisse `resolvedAt` intacte.
 */
export async function transitionIncidentStatusTx(
  db: IncidentsDatabase,
  incidentId: string,
  toStatus: IncidentStatus,
  byUserId: string,
  reason: string | null,
  context: AccessContext,
): Promise<Incident> {
  return db.transaction(async (tx) => {
    const current = await loadVisibleIncident(tx, incidentId, context);

    if (!isTransitionAllowed(current.status, toStatus)) {
      throw new InvalidTransitionError(current.status, toStatus);
    }

    if (toStatus === 'ASSIGNED' && !current.assignedToUserId) {
      throw new MissingAssignmentError();
    }

    if (current.status === 'RESOLVED' && toStatus === 'IN_PROGRESS' && !reason) {
      throw new MissingReasonError();
    }

    const fieldUpdates: Partial<NewIncident> = { status: toStatus, updatedAt: new Date() };
    // Le CHECK `incidents_resolved_requires_resolved_at` exige resolvedAt pour
    // RESOLVED ET CLOSED (DEC-059, 2.1) : un incident clos sans être passé par
    // RESOLVED (ex. OPEN -> CLOSED) doit donc aussi la renseigner, jamais l'effacer.
    if ((toStatus === 'RESOLVED' || toStatus === 'CLOSED') && !current.resolvedAt) {
      fieldUpdates.resolvedAt = new Date();
    }
    if (toStatus === 'CLOSED') fieldUpdates.closedAt = new Date();

    const [updated] = await tx
      .update(incidents)
      .set(fieldUpdates)
      .where(eq(incidents.id, incidentId))
      .returning();

    if (!updated) throw new IncidentNotFoundError();

    const historyValues: NewIncidentStatusHistoryEntry = {
      incidentId,
      fromStatus: current.status,
      toStatus,
      byUserId,
      reason,
    };

    await tx.insert(incidentStatusHistory).values(historyValues);

    return updated;
  });
}

/** Insère un commentaire partagé, après vérification du périmètre (DEC-059, 2.3 et 4.6). */
export async function insertIncidentCommentTx(
  db: IncidentsDatabase,
  incidentId: string,
  authorUserId: string,
  content: string,
  context: AccessContext,
): Promise<IncidentComment> {
  return db.transaction(async (tx) => {
    await loadVisibleIncident(tx, incidentId, context);

    const values: NewIncidentComment = { incidentId, authorUserId, content };

    const [inserted] = await tx.insert(incidentComments).values(values).returning();
    if (!inserted) throw new Error('INCIDENT_COMMENT_INSERT_RETURNED_NO_ROW');

    return inserted;
  });
}
