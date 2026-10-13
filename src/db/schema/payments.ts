import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  check,
  date,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { paymentMethodEnum, paymentStatusEnum } from './enums';
import { organizations } from './organizations';
import { apartments, properties } from './properties';
import { users } from './users';
import { rentInstallments } from './rents';
import { chargeAllocations } from './charges';

/**
 * Paiement (Lot 11, DEC-056).
 *
 * Le déclarant est la personne qui a saisi le paiement, le validateur est celui
 * qui le confirme. La création du montant à l'instant T et l'allocation à la
 * validation sont des phases distinctes, qui doivent rester distinguées dans le
 * schéma et dans le code métier.
 */
export const paymentSequences = pgTable(
  'payment_sequences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'restrict' }),
    year: integer('year').notNull(),
    lastValue: integer('last_value').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [unique('payment_sequences_property_year_unique').on(table.propertyId, table.year)],
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'restrict' }),
    apartmentId: uuid('apartment_id')
      .notNull()
      .references(() => apartments.id, { onDelete: 'restrict' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    method: paymentMethodEnum('method').notNull(),
    provider: varchar('provider'),
    providerTransactionId: varchar('provider_transaction_id'),
    reference: varchar('reference'),
    status: paymentStatusEnum('status').notNull(),
    paidAt: date('paid_at', { mode: 'string' }).notNull(),
    declaredAt: timestamp('declared_at', { withTimezone: true }).notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'restrict' }),
    validatedByUserId: uuid('validated_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    validatedAt: timestamp('validated_at', { withTimezone: true }),
    disputedByUserId: uuid('disputed_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    disputedAt: timestamp('disputed_at', { withTimezone: true }),
    disputeReason: text('dispute_reason'),
    disputeCategory: text('dispute_category'),
    proofUrl: text('proof_url'),
    referenceNumber: text('reference_number').notNull().unique(),
    /**
     * Référence publique pour la vérification par un tiers (DEC-057, point 3.4).
     * Distincte de l'id interne et du referenceNumber, non séquentielle et imprévisible.
     * Format : "R-" suivi de 10 caractères base62.
     */
    publicReference: varchar('public_reference', { length: 12 }).notNull().unique(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  () => [check('payments_positive_amount_check', sql`amount > 0`)],
);

/**
 * Traçabilité des versions successives du reçu PDF (DEC-057, sections 1.4 et 4).
 *
 * Aucune suppression physique (DEC-020). Les versions successives coexistent,
 * la plus récente est active (au plus une active par paiement), les précédentes
 * sont marquées remplacées ou invalidées. Clés étrangères en RESTRICT.
 */
export const paymentReceiptVersions = pgTable(
  'payment_receipt_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'restrict' }),
    version: integer('version').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    generatedByUserId: uuid('generated_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
    replacedAt: timestamp('replaced_at', { withTimezone: true }),
    replacedByUserId: uuid('replaced_by_user_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    replacementReason: text('replacement_reason'),
  },
  (table) => [
    unique('payment_receipt_versions_payment_version_unique').on(table.paymentId, table.version),
    uniqueIndex('payment_receipt_versions_one_active_per_payment')
      .on(table.paymentId)
      .where(sql`is_active = true`),
  ],
);

/**
 * Allocation d'un paiement (Lot 11, DEC-022).
 *
 * Répartit le montant global du paiement sur des créances précises. Une
 * allocation référence exactement UNE créance, loyer OU charge, garantie par la
 * contrainte d'exclusion mutuelle. Les clés étrangères sont en `RESTRICT` :
 * l'allocation est de l'historique financier, elle ne peut pas disparaître
 * avec la créance qu'elle solde (DEC-020 point 7).
 */
export const paymentAllocations = pgTable(
  'payment_allocations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'restrict' }),
    rentInstallmentId: uuid('rent_installment_id').references(() => rentInstallments.id, {
      onDelete: 'restrict',
    }),
    chargeAllocationId: uuid('charge_allocation_id').references(() => chargeAllocations.id, {
      onDelete: 'restrict',
    }),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  () => [
    check(
      'single_receivable_check',
      sql`((rent_installment_id IS NOT NULL)::int + (charge_allocation_id IS NOT NULL)::int) = 1`,
    ),
    check('positive_amount_check', sql`amount > 0`),
  ],
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type PaymentReceiptVersion = typeof paymentReceiptVersions.$inferSelect;
export type NewPaymentReceiptVersion = typeof paymentReceiptVersions.$inferInsert;
