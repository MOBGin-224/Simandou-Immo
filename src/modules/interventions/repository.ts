import { and, asc, count, desc, eq, inArray, or } from 'drizzle-orm';
import { alias, type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core';

import * as schema from '@/db/schema';
import {
  apartments,
  incidents,
  interventions,
  interventionStatusHistory,
  leases,
  organizations,
  properties,
  users,
  type Intervention,
  type InterventionStatusHistoryEntry,
  type NewIntervention,
  type NewInterventionStatusHistoryEntry,
} from '@/db/schema';
import {
  propertyScopeCondition,
  readablePropertyScopes,
  type AccessContext,
} from '@/lib/authorization';

import {
  InterventionNotFoundError,
  InterventionTerminalError,
  InterventionValidationError,
  InvalidTransitionError,
  MissingActualCostError,
  MissingReasonError,
  type FieldErrors,
} from './errors';
import { isTransitionAllowed, type InterventionStatus } from './transitions';

/**
 * Accès aux données du module Interventions (Lot 14, DEC-060).
 *
 * Même règle que les modules précédents : ce dépôt ne décide rien, il applique
 * la condition de visibilité que lui donne `AccessContext` et ne contourne
 * jamais le périmètre (ADR-007).
 */

/** Instance Drizzle, quel que soit son pilote : postgres.js ou PGlite. */
export type InterventionsDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

export type InterventionProjection = 'full' | 'minimal';

/** Vue complète (DEC-060, 8.2), réservée à MANAGER et OWNER. */
export type InterventionFull = Intervention & {
  apartmentNumber: string | null;
  propertyName: string;
  organizationName: string;
  incidentTitle: string | null;
  createdByName: string;
  assignedToName: string | null;
};

/**
 * Vue minimisée (DEC-060, 8.2), seule accessible au TENANT : ni coûts, ni
 * prestataire, ni affectation interne.
 */
export type InterventionMinimal = {
  id: string;
  title: string;
  description: string;
  status: InterventionStatus;
  plannedFor: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  apartmentNumber: string | null;
  propertyName: string;
  incidentTitle: string | null;
};

export type InterventionListFilters = {
  page?: number;
  pageSize?: number;
  status?: InterventionStatus[];
  propertyId?: string;
  apartmentId?: string;
  incidentId?: string;
  assignedToUserId?: string;
};

export type InterventionListResult = {
  interventions: Array<InterventionFull | InterventionMinimal>;
  meta: { total: number; page: number; pageSize: number };
};

export type InsertInterventionPayload = {
  organizationId: string;
  propertyId: string;
  apartmentId?: string | null;
  incidentId?: string | null;
  createdByUserId: string;
  assignedToUserId?: string | null;
  title: string;
  description: string;
  providerName?: string | null;
  providerPhone?: string | null;
  plannedFor?: string | null;
  estimatedCost?: number | null;
};

export type UpdateInterventionFields = Partial<{
  title: string;
  description: string;
  providerName: string | null;
  providerPhone: string | null;
  plannedFor: string | null;
  estimatedCost: number | null;
  apartmentId: string | null;
  assignedToUserId: string | null;
}>;

const DEFAULT_PAGE_SIZE = 20;

/** Champs modifiables par `updateInterventionFieldsTx` selon le statut (DEC-060, 8.3). */
const PLANNED_EDITABLE_FIELDS = [
  'title',
  'description',
  'providerName',
  'providerPhone',
  'plannedFor',
  'estimatedCost',
  'apartmentId',
  'assignedToUserId',
] as const;
const IN_PROGRESS_EDITABLE_FIELDS = ['providerName', 'providerPhone', 'estimatedCost'] as const;

function allowedFieldsForStatus(status: InterventionStatus): readonly string[] {
  if (status === 'PLANNED') return PLANNED_EDITABLE_FIELDS;
  if (status === 'IN_PROGRESS') return IN_PROGRESS_EDITABLE_FIELDS;
  return [];
}

/**
 * Périmètre de visibilité d'une intervention (DEC-060, 8.2).
 *
 * OWNER et MANAGER suivent le périmètre d'immeuble habituel
 * (`propertyScopeCondition`). Le TENANT voit les interventions de son logement
 * actif (sous-requête sur `leases`, bail ACTIF) OU celles liées à un incident
 * qu'il a lui-même créé (sous-requête sur `incidents`), même sans bail en
 * cours sur ce logement.
 */
function interventionVisibilityCondition(db: InterventionsDatabase, context: AccessContext) {
  const scopes = readablePropertyScopes(context, 'intervention.read');
  const propertyCondition = propertyScopeCondition(scopes, {
    organizationId: interventions.organizationId,
    propertyId: interventions.propertyId,
  });

  const isTenant = context.memberships.some((membership) => membership.role === 'TENANT');
  const tenantCondition = isTenant
    ? or(
        inArray(
          interventions.apartmentId,
          db
            .select({ apartmentId: leases.apartmentId })
            .from(leases)
            .where(and(eq(leases.tenantUserId, context.userId), eq(leases.status, 'ACTIVE'))),
        ),
        inArray(
          interventions.incidentId,
          db
            .select({ id: incidents.id })
            .from(incidents)
            .where(eq(incidents.createdByUserId, context.userId)),
        ),
      )
    : undefined;

  return or(propertyCondition, tenantCondition);
}

export type VisibleIncidentSummary = {
  id: string;
  organizationId: string;
  propertyId: string;
  apartmentId: string;
};

/**
 * Visibilité de l'INCIDENT parent (DEC-059, 4.2), répliquée ici plutôt
 * qu'importée : le dépôt Incidents ne l'exporte pas, et une intervention liée
 * doit pouvoir vérifier l'incident sans dépendre des internes d'un autre
 * module. La règle est verrouillée par DEC-017/DEC-059 et ne doit varier
 * qu'à cet endroit ET dans `src/modules/incidents/repository.ts`.
 *
 * Exportée (et non réduite à un booléen) car le service en a aussi besoin
 * pour DEC-060, 3.4 : vérifier que l'incident est visible ET lire ses
 * `propertyId`/`apartmentId`, pour les comparer à ceux de l'intervention.
 */
export async function loadVisibleIncidentSummary(
  db: InterventionsDatabase,
  incidentId: string,
  context: AccessContext,
): Promise<VisibleIncidentSummary | null> {
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

  const visibilityCondition = or(propertyCondition, tenantCondition);
  if (!visibilityCondition) return null;

  const [row] = await db
    .select({
      id: incidents.id,
      organizationId: incidents.organizationId,
      propertyId: incidents.propertyId,
      apartmentId: incidents.apartmentId,
    })
    .from(incidents)
    .where(and(eq(incidents.id, incidentId), visibilityCondition))
    .limit(1);

  return row ?? null;
}

/** Lecture jointe réutilisée par `findInterventionById` et la liste. */
function baseInterventionQuery(db: InterventionsDatabase) {
  const createdBy = alias(users, 'intervention_created_by');
  const assignedTo = alias(users, 'intervention_assigned_to');

  return db
    .select({
      intervention: interventions,
      apartmentNumber: apartments.number,
      propertyName: properties.name,
      organizationName: organizations.name,
      incidentTitle: incidents.title,
      createdByName: createdBy.fullName,
      assignedToName: assignedTo.fullName,
    })
    .from(interventions)
    .leftJoin(apartments, eq(apartments.id, interventions.apartmentId))
    .innerJoin(properties, eq(properties.id, interventions.propertyId))
    .innerJoin(organizations, eq(organizations.id, interventions.organizationId))
    .leftJoin(incidents, eq(incidents.id, interventions.incidentId))
    .innerJoin(createdBy, eq(createdBy.id, interventions.createdByUserId))
    .leftJoin(assignedTo, eq(assignedTo.id, interventions.assignedToUserId));
}

type InterventionRow = {
  intervention: Intervention;
  apartmentNumber: string | null;
  propertyName: string;
  organizationName: string;
  incidentTitle: string | null;
  createdByName: string;
  assignedToName: string | null;
};

/** Transforme une ligne jointe en vue complète ou minimisée (DEC-060, 8.2). */
export function projectIntervention(
  row: InterventionRow,
  projection: InterventionProjection,
): InterventionFull | InterventionMinimal {
  if (projection === 'minimal') {
    return {
      id: row.intervention.id,
      title: row.intervention.title,
      description: row.intervention.description,
      status: row.intervention.status,
      plannedFor: row.intervention.plannedFor,
      startedAt: row.intervention.startedAt,
      completedAt: row.intervention.completedAt,
      cancelledAt: row.intervention.cancelledAt,
      createdAt: row.intervention.createdAt,
      updatedAt: row.intervention.updatedAt,
      apartmentNumber: row.apartmentNumber,
      propertyName: row.propertyName,
      incidentTitle: row.incidentTitle,
    };
  }

  return {
    ...row.intervention,
    apartmentNumber: row.apartmentNumber,
    propertyName: row.propertyName,
    organizationName: row.organizationName,
    incidentTitle: row.incidentTitle,
    createdByName: row.createdByName,
    assignedToName: row.assignedToName,
  };
}

/** L'intervention est-elle visible pour ce contexte, sans en charger les relations. */
async function isInterventionVisible(
  db: InterventionsDatabase,
  interventionId: string,
  context: AccessContext,
): Promise<boolean> {
  const visibilityCondition = interventionVisibilityCondition(db, context);
  if (!visibilityCondition) return false;

  const [row] = await db
    .select({ id: interventions.id })
    .from(interventions)
    .where(and(eq(interventions.id, interventionId), visibilityCondition))
    .limit(1);

  return Boolean(row);
}

/** Charge l'intervention brute en appliquant le périmètre, ou lève `InterventionNotFoundError`. */
async function loadVisibleIntervention(
  db: InterventionsDatabase,
  interventionId: string,
  context: AccessContext,
): Promise<Intervention> {
  const visibilityCondition = interventionVisibilityCondition(db, context);
  if (!visibilityCondition) throw new InterventionNotFoundError();

  const [row] = await db
    .select()
    .from(interventions)
    .where(and(eq(interventions.id, interventionId), visibilityCondition))
    .limit(1);

  if (!row) throw new InterventionNotFoundError();

  return row;
}

// --- Lecture ------------------------------------------------------------------

export async function findInterventionById(
  db: InterventionsDatabase,
  interventionId: string,
  context: AccessContext,
  projection: 'full',
): Promise<InterventionFull | null>;
export async function findInterventionById(
  db: InterventionsDatabase,
  interventionId: string,
  context: AccessContext,
  projection: 'minimal',
): Promise<InterventionMinimal | null>;
export async function findInterventionById(
  db: InterventionsDatabase,
  interventionId: string,
  context: AccessContext,
  projection: InterventionProjection,
): Promise<InterventionFull | InterventionMinimal | null> {
  const visibilityCondition = interventionVisibilityCondition(db, context);
  if (!visibilityCondition) return null;

  const [row] = await baseInterventionQuery(db)
    .where(and(eq(interventions.id, interventionId), visibilityCondition))
    .limit(1);

  return row ? projectIntervention(row, projection) : null;
}

export async function listInterventionsForContext(
  db: InterventionsDatabase,
  context: AccessContext,
  filters: InterventionListFilters = {},
  projection: InterventionProjection,
): Promise<InterventionListResult> {
  const visibilityCondition = interventionVisibilityCondition(db, context);
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;

  if (!visibilityCondition) {
    return { interventions: [], meta: { total: 0, page, pageSize } };
  }

  const where = and(
    visibilityCondition,
    filters.status && filters.status.length > 0
      ? inArray(interventions.status, filters.status)
      : undefined,
    filters.propertyId ? eq(interventions.propertyId, filters.propertyId) : undefined,
    filters.apartmentId ? eq(interventions.apartmentId, filters.apartmentId) : undefined,
    filters.incidentId ? eq(interventions.incidentId, filters.incidentId) : undefined,
    filters.assignedToUserId
      ? eq(interventions.assignedToUserId, filters.assignedToUserId)
      : undefined,
  );

  const offset = (page - 1) * pageSize;

  const [rows, [totalRow]] = await Promise.all([
    baseInterventionQuery(db)
      .where(where)
      .orderBy(desc(interventions.createdAt), desc(interventions.id))
      .limit(pageSize)
      .offset(offset),
    db.select({ total: count() }).from(interventions).where(where),
  ]);

  return {
    interventions: rows.map((row) => projectIntervention(row, projection)),
    meta: { total: totalRow?.total ?? 0, page, pageSize },
  };
}

/**
 * Interventions liées à un incident (DEC-060, 3.5 et 12.3). La visibilité est
 * vérifiée sur l'INCIDENT parent et sur CHAQUE intervention : un périmètre qui
 * ne voit pas l'incident reçoit un tableau vide, même si une intervention
 * isolée aurait pu, par ailleurs, lui être visible.
 */
export async function listInterventionsForIncident(
  db: InterventionsDatabase,
  incidentId: string,
  context: AccessContext,
  projection: InterventionProjection,
): Promise<Array<InterventionFull | InterventionMinimal>> {
  const incidentSummary = await loadVisibleIncidentSummary(db, incidentId, context);
  if (!incidentSummary) return [];

  const visibilityCondition = interventionVisibilityCondition(db, context);
  if (!visibilityCondition) return [];

  const rows = await baseInterventionQuery(db)
    .where(and(eq(interventions.incidentId, incidentId), visibilityCondition))
    .orderBy(desc(interventions.createdAt), desc(interventions.id));

  return rows.map((row) => projectIntervention(row, projection));
}

/**
 * Historique trié du plus ancien au plus récent (DEC-060, 9.2). Un périmètre
 * qui ne voit pas l'intervention reçoit un tableau vide, jamais une erreur.
 */
export async function listInterventionStatusHistory(
  db: InterventionsDatabase,
  interventionId: string,
  context: AccessContext,
): Promise<InterventionStatusHistoryEntry[]> {
  const visible = await isInterventionVisible(db, interventionId, context);
  if (!visible) return [];

  return db
    .select()
    .from(interventionStatusHistory)
    .where(eq(interventionStatusHistory.interventionId, interventionId))
    .orderBy(asc(interventionStatusHistory.createdAt));
}

// --- Écriture ------------------------------------------------------------------

/**
 * Crée l'intervention en PLANNED et sa ligne de création dans l'historique,
 * dans la même transaction (DEC-060, 2.1 et 9.3).
 */
export async function insertInterventionTx(
  db: InterventionsDatabase,
  payload: InsertInterventionPayload,
): Promise<Intervention> {
  return db.transaction(async (tx) => {
    const values: NewIntervention = {
      organizationId: payload.organizationId,
      propertyId: payload.propertyId,
      apartmentId: payload.apartmentId ?? null,
      incidentId: payload.incidentId ?? null,
      createdByUserId: payload.createdByUserId,
      assignedToUserId: payload.assignedToUserId ?? null,
      title: payload.title,
      description: payload.description,
      providerName: payload.providerName ?? null,
      providerPhone: payload.providerPhone ?? null,
      status: 'PLANNED',
      plannedFor: payload.plannedFor ?? null,
      estimatedCost: payload.estimatedCost ?? null,
    };

    const [inserted] = await tx.insert(interventions).values(values).returning();
    if (!inserted) throw new Error('INTERVENTION_INSERT_RETURNED_NO_ROW');

    const historyValues: NewInterventionStatusHistoryEntry = {
      interventionId: inserted.id,
      fromStatus: null,
      toStatus: 'PLANNED',
      byUserId: payload.createdByUserId,
    };

    await tx.insert(interventionStatusHistory).values(historyValues);

    return inserted;
  });
}

/**
 * Met à jour les champs modifiables (DEC-060, 8.3). Refuse toute modification
 * sur une intervention COMPLETED ou CANCELLED, et refuse tout champ hors de la
 * liste autorisée pour le statut courant : contrôle SERVEUR, pas SQL.
 */
export async function updateInterventionFieldsTx(
  db: InterventionsDatabase,
  interventionId: string,
  fields: UpdateInterventionFields,
  context: AccessContext,
): Promise<Intervention> {
  return db.transaction(async (tx) => {
    const current = await loadVisibleIntervention(tx, interventionId, context);

    if (current.status === 'COMPLETED' || current.status === 'CANCELLED') {
      throw new InterventionTerminalError();
    }

    const allowed = new Set(allowedFieldsForStatus(current.status));
    const fieldErrors: FieldErrors = {};

    for (const key of Object.keys(fields)) {
      if (!allowed.has(key)) {
        fieldErrors[key] = [`Ce champ ne peut pas etre modifie au statut ${current.status}.`];
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      throw new InterventionValidationError(fieldErrors);
    }

    const [updated] = await tx
      .update(interventions)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(interventions.id, interventionId))
      .returning();

    if (!updated) throw new InterventionNotFoundError();

    return updated;
  });
}

/**
 * Transition de statut (DEC-018, DEC-060 sections 4 et 9).
 *
 * `SELECT ... FOR UPDATE` sérialise les transitions concurrentes (DEC-060,
 * 4.8 et 13.1) : deux requêtes simultanées ne peuvent pas produire deux
 * transitions incompatibles. `actualCost` est reçu ICI, et non par
 * `updateInterventionFieldsTx`, qui n'autorise pas ce champ en IN_PROGRESS
 * (DEC-060, 8.3) : la transition vers COMPLETED est le seul moment où il est
 * exigé (DEC-060, 4.5 et 7.4), donc le seul où il peut être fourni.
 */
export async function transitionInterventionStatusTx(
  db: InterventionsDatabase,
  interventionId: string,
  toStatus: InterventionStatus,
  byUserId: string,
  reason: string | null,
  context: AccessContext,
  actualCost?: number | null,
): Promise<Intervention> {
  return db.transaction(async (tx) => {
    const visibilityCondition = interventionVisibilityCondition(tx, context);
    if (!visibilityCondition) throw new InterventionNotFoundError();

    const [current] = await tx
      .select()
      .from(interventions)
      .where(and(eq(interventions.id, interventionId), visibilityCondition))
      .for('update');

    if (!current) throw new InterventionNotFoundError();

    if (!isTransitionAllowed(current.status, toStatus)) {
      throw new InvalidTransitionError(current.status, toStatus);
    }

    if (toStatus === 'CANCELLED' && (!reason || reason.trim().length === 0)) {
      throw new MissingReasonError();
    }

    const fieldUpdates: Partial<NewIntervention> = { status: toStatus, updatedAt: new Date() };

    if (toStatus === 'IN_PROGRESS') {
      fieldUpdates.startedAt = new Date();
    }

    if (toStatus === 'COMPLETED') {
      const resolvedActualCost = actualCost ?? current.actualCost;
      if (resolvedActualCost == null) throw new MissingActualCostError();

      fieldUpdates.actualCost = resolvedActualCost;
      fieldUpdates.completedAt = new Date();
    }

    if (toStatus === 'CANCELLED') {
      fieldUpdates.cancelledAt = new Date();
    }

    const [updated] = await tx
      .update(interventions)
      .set(fieldUpdates)
      .where(eq(interventions.id, interventionId))
      .returning();

    if (!updated) throw new InterventionNotFoundError();

    const historyValues: NewInterventionStatusHistoryEntry = {
      interventionId,
      fromStatus: current.status,
      toStatus,
      byUserId,
      reason,
    };

    await tx.insert(interventionStatusHistory).values(historyValues);

    return updated;
  });
}
