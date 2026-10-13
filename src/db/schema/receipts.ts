import { sql } from 'drizzle-orm';
import {
  bigint,
  char,
  check,
  date,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

import { leaseReceiptVersionStatusEnum } from './enums';
import { leases } from './leases';
import { organizations } from './organizations';
import { payments } from './payments';
import { apartments, properties } from './properties';
import { users } from './users';

/**
 * Quittance formelle (Lot 12, DEC-058).
 *
 * Distincte du reçu de paiement du Lot 11 (DEC-057) : la quittance atteste
 * qu'un bail est libéré de ses obligations financières pour une période
 * entière, le reçu atteste un paiement précis (DEC-058, 1.1 et 1.2).
 *
 * `organization_id`, `property_id`, `apartment_id` et `tenant_user_id` sont
 * dénormalisés depuis le bail, pour la même raison que `rent_installments`
 * les dénormalise déjà : vérifier l'isolation et le périmètre SANS jointure
 * (ADR-007).
 *
 * Remplace DEC-024 sur le seul modèle des quittances (DEC-058, section 9) :
 * aucune table `receipts` à `document_id` n'est créée, c'est `lease_receipts`
 * qui porte le modèle.
 */
export const leaseReceipts = pgTable(
  'lease_receipts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    leaseId: uuid('lease_id')
      .notNull()
      .references(() => leases.id, { onDelete: 'restrict' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'restrict' }),
    apartmentId: uuid('apartment_id')
      .notNull()
      .references(() => apartments.id, { onDelete: 'restrict' }),
    tenantUserId: uuid('tenant_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    /** Premier jour du mois couvert (DEC-058, 2.1 et 2.2), date civile. */
    periodStart: date('period_start').notNull(),

    /** Format CODE-IMMEUBLE-AAAA-MM-NNNN (DEC-058, 4.1). */
    referenceNumber: varchar('reference_number', { length: 32 }).notNull().unique(),

    /**
     * Référence publique de vérification (DEC-058, 7.4). Préfixe `Q-`, distinct
     * du préfixe `R-` des reçus de paiement (DEC-057).
     */
    publicReference: varchar('public_reference', { length: 12 }).notNull().unique(),

    /** Somme des créances couvertes (DEC-058, 2.1 et 4.1). */
    totalAttested: bigint('total_attested', { mode: 'number' }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),

    /**
     * Version active. Nulle tant qu'aucune version n'a encore été insérée.
     *
     * Référence circulaire vers `lease_receipt_versions`, annotée `AnyPgColumn`
     * (exigé par Drizzle pour une référence avant déclaration dans le même
     * fichier) : les deux tables se créent dans la même migration, cette
     * contrainte est donc ajoutée par une instruction séparée après les deux
     * `CREATE TABLE`.
     */
    currentVersionId: uuid('current_version_id').references(
      (): AnyPgColumn => leaseReceiptVersions.id,
      { onDelete: 'restrict' },
    ),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /**
     * Clé métier unique (DEC-058, 2.2) : une seule quittance par bail et par
     * période. C'est la même forme que `rent_installments_one_per_lease_and_period`.
     */
    uniqueIndex('lease_receipts_one_per_lease_and_period').on(table.leaseId, table.periodStart),

    check('lease_receipts_period_starts_month', sql`EXTRACT(DAY FROM period_start) = 1`),
    check('lease_receipts_public_reference_prefix', sql`public_reference LIKE 'Q-%'`),
    check('lease_receipts_total_attested_non_negative', sql`total_attested >= 0`),
    check('lease_receipts_currency_format', sql`currency ~ '^[A-Z]{3}$'`),
  ],
);

/**
 * Version figée d'une quittance formelle (DEC-058, section 5).
 *
 * Une version ÉMISE n'est jamais réécrite ; seule une nouvelle version peut
 * succéder à une version INVALIDÉE. `frozen_content` porte le contenu figé au
 * moment de l'émission, pour que le PDF soit régénéré à la volée sans jamais
 * recalculer depuis l'état courant des créances (DEC-058, 4.2 et 5.7).
 */
export const leaseReceiptVersions = pgTable(
  'lease_receipt_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leaseReceiptId: uuid('lease_receipt_id')
      .notNull()
      .references(() => leaseReceipts.id, { onDelete: 'restrict' }),

    /** Commence à 1 (DEC-058, 5.1). */
    version: integer('version').notNull(),

    status: leaseReceiptVersionStatusEnum('status').notNull(),

    emittedAt: timestamp('emitted_at', { withTimezone: true }).notNull(),

    /** Nulle pour une émission automatique par le job (DEC-058, 3.3 et 3.4). */
    emittedByUserId: uuid('emitted_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),

    invalidatedAt: timestamp('invalidated_at', { withTimezone: true }),
    invalidationReason: text('invalidation_reason'),

    /** Paiement annulé ou contesté à l'origine de l'invalidation, s'il y en a un. */
    invalidationTriggerPaymentId: uuid('invalidation_trigger_payment_id').references(
      () => payments.id,
      { onDelete: 'restrict' },
    ),

    /** Contenu figé : créances et allocations couvertes au moment de l'émission. */
    frozenContent: jsonb('frozen_content').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('lease_receipt_versions_one_per_receipt_and_version').on(
      table.leaseReceiptId,
      table.version,
    ),

    check(
      'lease_receipt_versions_invalidated_requires_reason_and_date',
      sql`status <> 'INVALIDEE' OR (invalidation_reason IS NOT NULL AND invalidated_at IS NOT NULL)`,
    ),
    check(
      'lease_receipt_versions_emise_has_no_invalidated_at',
      sql`status <> 'EMISE' OR invalidated_at IS NULL`,
    ),
  ],
);

export type LeaseReceipt = typeof leaseReceipts.$inferSelect;
export type NewLeaseReceipt = typeof leaseReceipts.$inferInsert;
export type LeaseReceiptVersion = typeof leaseReceiptVersions.$inferSelect;
export type NewLeaseReceiptVersion = typeof leaseReceiptVersions.$inferInsert;
