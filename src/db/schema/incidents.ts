import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { incidentPriorityEnum, incidentStatusEnum } from './enums';
import { organizations } from './organizations';
import { apartments, properties } from './properties';
import { users } from './users';

/**
 * Incident (Lot 13, DEC-059).
 *
 * `category` est en `varchar` avec CHECK et non une énumération, pour la même
 * raison que `charge_type` : une liste destinée à s'étendre sans changement de
 * logique (enums.ts, règle 4).
 *
 * L'affectation (assignedToUserId, assignedAt, assignedByUserId) est un bloc
 * cohérent : les trois sont NULL ensemble ou renseignés ensemble (DEC-059, 2.1).
 */
export const incidents = pgTable(
  'incidents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'restrict' }),
    apartmentId: uuid('apartment_id')
      .notNull()
      .references(() => apartments.id, { onDelete: 'restrict' }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    title: varchar('title', { length: 200 }).notNull(),
    description: text('description').notNull(),

    priority: incidentPriorityEnum('priority').notNull(),
    status: incidentStatusEnum('status').notNull().default('OPEN'),

    /** Cinq valeurs (DEC-059, 3.1), en varchar + CHECK conformément à DEC-021. */
    category: varchar('category', { length: 32 }).notNull(),

    assignedToUserId: uuid('assigned_to_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    assignedAt: timestamp('assigned_at', { withTimezone: true }),
    assignedByUserId: uuid('assigned_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),

    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('incidents_organization_id_status_index').on(table.organizationId, table.status),
    index('incidents_property_id_status_index').on(table.propertyId, table.status),
    index('incidents_assigned_to_user_id_status_index').on(table.assignedToUserId, table.status),

    check(
      'incidents_assignment_coherent',
      sql`(assigned_to_user_id IS NULL) = (assigned_at IS NULL) AND (assigned_to_user_id IS NULL) = (assigned_by_user_id IS NULL)`,
    ),
    check(
      'incidents_assigned_requires_assignee',
      sql`status <> 'ASSIGNED' OR assigned_to_user_id IS NOT NULL`,
    ),
    check('incidents_closed_requires_closed_at', sql`status <> 'CLOSED' OR closed_at IS NOT NULL`),
    check(
      'incidents_resolved_requires_resolved_at',
      sql`status NOT IN ('RESOLVED', 'CLOSED') OR resolved_at IS NOT NULL`,
    ),
    check(
      'incidents_category_valid',
      sql`category IN ('PLUMBING', 'ELECTRICITY', 'AIR_CONDITIONING', 'LOCKS_AND_KEYS', 'OTHER')`,
    ),
  ],
);

/**
 * Historique des transitions de statut d'un incident (DEC-059, 2.2 et 6).
 *
 * `fromStatus` est nul pour la ligne de création. Un motif est obligatoire
 * pour la transition RESOLVED vers IN_PROGRESS (DEC-059, 6.3) : règle portée
 * par le service, pas par une contrainte SQL, faute de pouvoir comparer deux
 * colonnes d'énumération dans un CHECK portable.
 */
export const incidentStatusHistory = pgTable(
  'incident_status_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'restrict' }),
    fromStatus: incidentStatusEnum('from_status'),
    toStatus: incidentStatusEnum('to_status').notNull(),
    byUserId: uuid('by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('incident_status_history_incident_id_created_at_index').on(
      table.incidentId,
      table.createdAt,
    ),
  ],
);

/**
 * Commentaire partagé sur un incident (DEC-059, 2.3 et 4.6).
 *
 * Pas de note privée au MVP : tout utilisateur ayant accès à l'incident voit
 * tous les commentaires.
 */
export const incidentComments = pgTable(
  'incident_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'restrict' }),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('incident_comments_incident_id_created_at_index').on(table.incidentId, table.createdAt),
    check(
      'incident_comments_content_length',
      sql`char_length(content) >= 1 AND char_length(content) <= 2000`,
    ),
  ],
);

export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;
export type IncidentStatusHistoryEntry = typeof incidentStatusHistory.$inferSelect;
export type NewIncidentStatusHistoryEntry = typeof incidentStatusHistory.$inferInsert;
export type IncidentComment = typeof incidentComments.$inferSelect;
export type NewIncidentComment = typeof incidentComments.$inferInsert;
