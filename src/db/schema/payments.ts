import { sql } from 'drizzle-orm';
import {
  bigint,
  char,
  check,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { paymentMethodEnum, paymentStatusEnum } from './enums';
import { organizations } from './organizations';
import { properties } from './properties';
import { users } from './users';
import { rentInstallments } from './rents';
import { chargeAllocations } from './charges';

/**
 * Paiement (Lot 11).
 *
 * Un paiement appartient à une organisation, un immeuble et une personne
 * (le locataire). Il représente un versement global dont le montant est alloué
 * à une ou plusieurs créances (DEC-022).
 */
export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  propertyId: uuid('property_id')
    .notNull()
    .references(() => properties.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  currency: char('currency', { length: 3 }).notNull(),
  method: paymentMethodEnum('method').notNull(),
  reference: text('reference'),
  status: paymentStatusEnum('status').notNull(),
  cancellationReason: text('cancellation_reason'),
  recordedByUserId: uuid('recorded_by_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

/**
 * Allocation d'un paiement (Lot 11).
 *
 * Répartit le montant global du paiement sur des créances précises (DEC-022).
 * Une allocation référence exactement UNE créance, loyer OU charge.
 */
export const paymentAllocations = pgTable(
  'payment_allocations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'cascade' }),
    rentInstallmentId: uuid('rent_installment_id').references(() => rentInstallments.id, {
      onDelete: 'cascade',
    }),
    chargeAllocationId: uuid('charge_allocation_id').references(() => chargeAllocations.id, {
      onDelete: 'cascade',
    }),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      'single_receivable_check',
      sql`((rent_installment_id IS NOT NULL)::int + (charge_allocation_id IS NOT NULL)::int) = 1`
    ),
    check('positive_amount_check', sql`amount > 0`),
  ]
);
