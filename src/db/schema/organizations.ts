import { sql } from 'drizzle-orm';
import { char, check, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { organizationTypeEnum } from './enums';

/**
 * Organisation : la frontière d'isolation multi-tenant.
 *
 * Toute table métier porte un `organization_id` afin que l'isolation soit
 * vérifiable sans jointure. L'autorisation reste implémentée dans le service
 * applicatif, jamais en RLS (ADR-005, ADR-007).
 *
 * Pas de colonne `status` : l'archivage est porté par `archived_at` (DEC-020).
 */
export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 200 }).notNull(),
    type: organizationTypeEnum('type').notNull(),

    /**
     * Devise par défaut des montants de l'organisation, en ISO 4217 (DEC-014).
     * Chaque montant porte malgré tout sa propre devise : cette colonne ne sert
     * qu'à préremplir, jamais à déduire la devise d'un montant existant.
     */
    defaultCurrency: char('default_currency', { length: 3 }).notNull().default('GNF'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  () => [
    check('organizations_name_not_blank', sql`length(btrim(name)) > 0`),
    check('organizations_currency_format', sql`default_currency ~ '^[A-Z]{3}$'`),
  ],
);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
