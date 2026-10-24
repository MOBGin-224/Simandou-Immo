import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { interventionStatusEnum } from './enums';
import { incidents } from './incidents';
import { organizations } from './organizations';
import { apartments, properties } from './properties';
import { users } from './users';

/**
 * Intervention (Lot 14, DEC-060).
 *
 * `incidentId` est NULL : une intervention peut exister de façon autonome, pour
 * de la maintenance préventive, sans incident déclaré (DEC-060, 3.3). Quand elle
 * est liée à un incident, le serveur garantit que `propertyId` et `apartmentId`
 * correspondent exactement à ceux de l'incident (DEC-060, 3.4) : une contrainte
 * applicative, pas SQL, faute de pouvoir lire une autre table dans un CHECK.
 *
 * `providerName` et `providerPhone` décrivent l'intervenant externe en texte
 * libre (DEC-060, 6.2) : aucune table `providers` au MVP.
 *
 * `startedAt`, `completedAt` et `cancelledAt` ne sont renseignées qu'à l'entrée
 * dans leur statut et ne sont jamais effacées (DEC-060, 5.2), même règle que
 * `resolvedAt`/`closedAt` sur les incidents.
 *
 * Pas de colonne `currency` : les montants sont toujours en GNF entier
 * (DEC-014, DEC-060 7.2).
 */
export const interventions = pgTable(
  'interventions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'restrict' }),
    apartmentId: uuid('apartment_id').references(() => apartments.id, { onDelete: 'restrict' }),
    incidentId: uuid('incident_id').references(() => incidents.id, { onDelete: 'restrict' }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    assignedToUserId: uuid('assigned_to_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),

    title: varchar('title', { length: 200 }).notNull(),
    description: text('description').notNull(),

    providerName: varchar('provider_name', { length: 200 }),
    providerPhone: varchar('provider_phone', { length: 30 }),

    status: interventionStatusEnum('status').notNull().default('PLANNED'),

    plannedFor: date('planned_for'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),

    estimatedCost: bigint('estimated_cost', { mode: 'number' }),
    actualCost: bigint('actual_cost', { mode: 'number' }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('interventions_organization_id_status_index').on(table.organizationId, table.status),
    index('interventions_property_id_status_index').on(table.propertyId, table.status),
    index('interventions_apartment_id_status_index').on(table.apartmentId, table.status),
    index('interventions_incident_id_index').on(table.incidentId),
    index('interventions_assigned_to_user_id_status_index').on(
      table.assignedToUserId,
      table.status,
    ),

    check(
      'interventions_estimated_cost_non_negative',
      sql`estimated_cost IS NULL OR estimated_cost >= 0`,
    ),
    check('interventions_actual_cost_non_negative', sql`actual_cost IS NULL OR actual_cost >= 0`),
    check(
      'interventions_completed_requires_completed_at',
      sql`status <> 'COMPLETED' OR completed_at IS NOT NULL`,
    ),
    check(
      'interventions_completed_requires_actual_cost',
      sql`status <> 'COMPLETED' OR actual_cost IS NOT NULL`,
    ),
    check(
      'interventions_cancelled_requires_cancelled_at',
      sql`status <> 'CANCELLED' OR cancelled_at IS NOT NULL`,
    ),
    check(
      'interventions_in_progress_requires_started_at',
      sql`status <> 'IN_PROGRESS' OR started_at IS NOT NULL`,
    ),
    check(
      'interventions_property_required_for_incident',
      sql`incident_id IS NULL OR property_id IS NOT NULL`,
    ),
  ],
);

/**
 * Historique des transitions de statut d'une intervention (DEC-060, 2.2 et 9).
 *
 * `fromStatus` est nul pour la ligne de création. Le motif est obligatoire pour
 * la transition vers CANCELLED (DEC-060, 4.4) : règle portée par le service, pas
 * par une contrainte SQL, pour la même raison que l'historique des incidents.
 */
export const interventionStatusHistory = pgTable(
  'intervention_status_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    interventionId: uuid('intervention_id')
      .notNull()
      .references(() => interventions.id, { onDelete: 'restrict' }),
    fromStatus: interventionStatusEnum('from_status'),
    toStatus: interventionStatusEnum('to_status').notNull(),
    byUserId: uuid('by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('intervention_status_history_intervention_id_created_at_index').on(
      table.interventionId,
      table.createdAt,
    ),
  ],
);

export type Intervention = typeof interventions.$inferSelect;
export type NewIntervention = typeof interventions.$inferInsert;
export type InterventionStatusHistoryEntry = typeof interventionStatusHistory.$inferSelect;
export type NewInterventionStatusHistoryEntry = typeof interventionStatusHistory.$inferInsert;
