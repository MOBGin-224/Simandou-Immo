import { index, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { accessLevelEnum, roleEnum, userAccessStatusEnum } from './enums';
import { organizations } from './organizations';
import { properties } from './properties';
import { users } from './users';

/**
 * Rattachement d'un utilisateur à une organisation, avec un rôle.
 *
 * Première des deux dimensions du modèle d'autorisation (ADR-007) :
 *   1. le ROLE, porté ici ;
 *   2. le PERIMETRE d'immeubles, porté par `manager_property_access`.
 *
 * Aucune table `roles` : le rôle est une énumération. Aucune table
 * `permissions` ni `access_permissions` : le catalogue est défini en code et
 * associé statiquement à chaque rôle (DEC-025).
 *
 * L'unicité porte sur le triplet utilisateur, organisation, rôle : un même
 * utilisateur peut donc être à la fois OWNER et MANAGER d'une organisation, ce
 * qui permet à un propriétaire de gérer lui-même son patrimoine sans créer un
 * second compte (DEC-003).
 *
 * La révocation renseigne `revoked_at` et ne supprime jamais l'historique
 * (DEC-013).
 */
export const userAccess = pgTable(
  'user_access',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),

    role: roleEnum('role').notNull(),
    status: userAccessStatusEnum('status').notNull().default('ACTIVE'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    unique('user_access_user_org_role_unique').on(table.userId, table.organizationId, table.role),
    index('user_access_user_idx').on(table.userId),
    index('user_access_organization_role_idx').on(table.organizationId, table.role),
  ],
);

/**
 * Périmètre d'immeubles d'un gestionnaire.
 *
 * Seconde dimension du modèle d'autorisation. Plusieurs gestionnaires peuvent
 * être affectés au même immeuble : ils disposent alors du même ensemble de
 * permissions, appliqué à leur périmètre respectif (DEC-003, DEC-025).
 *
 * La table référence `user_access` et non `users` : le périmètre appartient à un
 * rôle dans une organisation, pas à une personne. Révoquer l'accès révoque donc
 * le périmètre avec lui, sans écriture supplémentaire.
 */
export const managerPropertyAccess = pgTable(
  'manager_property_access',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userAccessId: uuid('user_access_id')
      .notNull()
      .references(() => userAccess.id, { onDelete: 'restrict' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'restrict' }),

    /** Une seule valeur au MVP, `MANAGE` (DEC-025). */
    accessLevel: accessLevelEnum('access_level').notNull().default('MANAGE'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    unique('manager_property_access_unique').on(table.userAccessId, table.propertyId),
    index('manager_property_access_property_idx').on(table.propertyId),
  ],
);

export type UserAccess = typeof userAccess.$inferSelect;
export type NewUserAccess = typeof userAccess.$inferInsert;
export type ManagerPropertyAccess = typeof managerPropertyAccess.$inferSelect;
export type NewManagerPropertyAccess = typeof managerPropertyAccess.$inferInsert;
