import { sql } from 'drizzle-orm';
import {
  bigint,
  char,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { apartmentStatusEnum } from './enums';
import { organizations } from './organizations';

/**
 * Immeuble.
 *
 * Pas de colonne `status` : un immeuble est actif tant que `archived_at` est nul
 * (DEC-020). L'immeuble est aussi l'unité de périmètre d'un gestionnaire
 * (ADR-007).
 */
export const properties = pgTable(
  'properties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),

    name: varchar('name', { length: 200 }).notNull(),
    address: text('address'),
    city: varchar('city', { length: 120 }),
    district: varchar('district', { length: 120 }),
    description: text('description'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => [
    check('properties_name_not_blank', sql`length(btrim(name)) > 0`),
    // Deux immeubles d'une même organisation ne peuvent pas porter le même nom :
    // la confusion serait immédiate pour le gestionnaire.
    unique('properties_org_name_unique').on(table.organizationId, table.name),
    index('properties_organization_idx').on(table.organizationId),
  ],
);

/**
 * Appartement.
 *
 * `organization_id` est dénormalisé depuis l'immeuble afin de vérifier
 * l'isolation et le périmètre SANS jointure, comme l'exige le contrôle d'accès
 * systématique (ADR-007). Il doit rester cohérent avec celui de l'immeuble.
 *
 * `ARCHIVED` n'est pas une valeur de `apartment_status` : un appartement archivé
 * conserve son dernier statut d'occupation et porte `archived_at` (DEC-020).
 */
export const apartments = pgTable(
  'apartments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'restrict' }),

    /** Référence affichée du logement, par exemple A01. Unique dans l'immeuble. */
    number: varchar('number', { length: 30 }).notNull(),
    floor: integer('floor'),
    type: varchar('type', { length: 60 }),
    /** Surface en mètres carrés. Ce n'est pas un montant : `numeric` convient. */
    area: numeric('area', { precision: 10, scale: 2 }),

    status: apartmentStatusEnum('status').notNull().default('VACANT'),

    /**
     * Loyer de référence, indicatif, servant à préremplir un futur contrat.
     *
     * Convention monétaire DEC-014 : entier, exprimé dans la plus petite unité
     * de la devise, avec devise explicite. Pour le GNF, l'exposant de sous-unité
     * est 0. Le mode `number` est retenu plutôt que `bigint` : les montants du
     * produit restent très en dessous de Number.MAX_SAFE_INTEGER, et manipuler
     * des BigInt partout coûterait plus qu'il ne protège.
     */
    referenceRentAmount: bigint('reference_rent_amount', { mode: 'number' }),
    currency: char('currency', { length: 3 }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => [
    unique('apartments_property_number_unique').on(table.propertyId, table.number),
    check('apartments_number_not_blank', sql`length(btrim(number)) > 0`),
    check(
      'apartments_reference_rent_non_negative',
      sql`reference_rent_amount IS NULL OR reference_rent_amount >= 0`,
    ),
    // Un montant sans devise est inexploitable, et une devise sans montant est
    // un résidu. Les deux colonnes vont donc toujours ensemble (DEC-014).
    check(
      'apartments_amount_requires_currency',
      sql`(reference_rent_amount IS NULL) = (currency IS NULL)`,
    ),
    check('apartments_currency_format', sql`currency IS NULL OR currency ~ '^[A-Z]{3}$'`),
    check('apartments_area_positive', sql`area IS NULL OR area > 0`),
    index('apartments_property_status_idx').on(table.propertyId, table.status),
    index('apartments_organization_idx').on(table.organizationId),
  ],
);

export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
export type Apartment = typeof apartments.$inferSelect;
export type NewApartment = typeof apartments.$inferInsert;
