import { sql } from 'drizzle-orm';
import {
  bigint,
  char,
  check,
  date,
  pgTable,
  text,
  timestamp,
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
 * Paiement (Lot 11).
 *
 * Un paiement appartient à une organisation, un immeuble, un logement et une
 * personne (le locataire). Il représente un versement global dont le montant est
 * alloué à une ou plusieurs créances (DEC-022).
 *
 * Colonnes alignées sur `database.md` section « Table : `payments` ». Trois
 * écarts assumés, tous arbitrés :
 *
 *   1. `recorded_by_user_id` et non `created_by` : DEC-055, au rang 1 et
 *      VERROUILLÉE, nomme cette colonne et exige la traçabilité de l'auteur. Elle
 *      l'emporte sur `database.md` par la règle de préséance du registre.
 *   2. `recorded_at` a été retirée : `database.md` ne la mentionne pas, et
 *      `created_at` porte déjà l'horodatage technique d'enregistrement.
 *   3. `tenant_id` et non `tenant_user_id` : le nom de la doc diverge, mais
 *      renommer la colonne casserait la clé étrangère de la migration 0007. Une
 *      migration dédiée le ferait.
 *
 * Toutes les clés étrangères sont en `RESTRICT` : DEC-020 point 6 exclut tout
 * `DELETE` physique sur une entité métier, et le point 7 interdit `CASCADE` sur
 * toute relation portant de l'historique. Un paiement est de l'historique
 * financier : supprimer un locataire, un immeuble ou un logement ne doit pas
 * emporter les versements qu'ils expliquent.
 */
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
    /** Fournisseur de paiement, NULL tant que DEC-034 reste ouverte. */
    provider: varchar('provider'),
    /** Référence du fournisseur, à indexer et à unique par fournisseur. */
    providerTransactionId: varchar('provider_transaction_id'),
    reference: varchar('reference'),
    status: paymentStatusEnum('status').notNull(),
    /**
     * Date MÉTIÈRE du paiement, distincte de `created_at` qui est l'horodatage
     * technique. Les deux diffèrent pour un versement en espèces saisi après
     * coup : c'est tout l'intérêt de la séparation.
     */
    paidAt: date('paid_at', { mode: 'string' }).notNull(),
    /** Instantan de confirmation. Renseigné à la saisie manuelle (DEC-055). */
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    /** Instantan d'annulation. NULL tant que le paiement est vivant. */
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    /**
     * Motif d'annulation.
     *
     * Colonne ABSENTE de `database.md`, qui ne décrit pas l'annulation. Elle est
     * conservée parce que DEC-016 exige une correction de paiement « accompagnée
     * d'une trace d'audit », et que le motif en est la partie lisible. Son
     * maintien est un écart signalé, non une divergence corrigée ici.
     */
    cancellationReason: text('cancellation_reason'),
    recordedByUserId: uuid('recorded_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  () => [check('payments_positive_amount_check', sql`amount > 0`)],
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
