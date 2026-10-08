import { sql } from 'drizzle-orm';
import {
  bigint,
  char,
  check,
  date,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { receivableStatusEnum } from './enums';
import { leases } from './leases';
import { organizations } from './organizations';
import { apartments, properties } from './properties';
import { users } from './users';

/**
 * Créance de loyer pour une période précise (BR-034 à BR-037, DEC-015,
 * Database Schema sections 19 à 21).
 *
 * C'est la PREMIÈRE des deux créances du MVP (DEC-005). La seconde,
 * `charge_allocations`, viendra au Lot 10 et partagera avec celle-ci sa
 * structure financière, son énumération de statut et son mécanisme
 * d'allocation : les colonnes financières sont donc nommées ici de façon à
 * pouvoir être relues à l'identique là-bas, et non spécialisées « loyer ».
 *
 * `organization_id`, `property_id`, `apartment_id` et `tenant_user_id` sont
 * dénormalisés depuis le bail, pour la même raison que le bail les dénormalise
 * depuis son logement : vérifier l'isolation et le périmètre SANS jointure, ce
 * qu'exige le contrôle d'accès systématique (ADR-007). Le cas d'usage les
 * recopie depuis le bail plutôt que de les recevoir de l'appelant, ce qui rend
 * un couple incohérent impossible à écrire.
 *
 * Aucune colonne `period` en texte libre : `period_start` est une DATE
 * normalisée au premier jour de la période. Une chaîne « septembre 2026 » ne se
 * compare pas, ne s'ordonne pas et s'écrit de dix façons.
 */
export const rentInstallments = pgTable(
  'rent_installments',
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

    /**
     * Premier jour de la période couverte, date CIVILE (section 19).
     *
     * C'est elle qui identifie la période sans ambiguïté (BR-035) : le libellé
     * « Loyer septembre 2026 » se compose à l'affichage depuis cette date, et
     * n'est jamais stocké.
     */
    periodStart: date('period_start').notNull(),

    /**
     * Jour où le loyer est dû, date civile elle aussi.
     *
     * Dérivée du `due_day` du bail au moment de la génération, et non relue
     * depuis lui ensuite : si les parties renégocient le jour d'échéance, les
     * échéances déjà nées gardent la date qui leur a été annoncée.
     */
    dueDate: date('due_date').notNull(),

    /** Montant attendu (BR-036). Convention monétaire DEC-014, comme le bail. */
    amountDue: bigint('amount_due', { mode: 'number' }).notNull(),

    /**
     * Montant payé et solde : DÉRIVÉS, stockés pour la performance (section 21).
     *
     * La source de vérité est la somme des allocations rattachées à des
     * paiements CONFIRMED. Ces deux colonnes ne doivent jamais être écrites hors
     * de la transaction qui crée, annule ou corrige une allocation, ce qui
     * n'arrivera qu'au Lot 11 : au Lot 9, une échéance naît à zéro payé.
     */
    amountPaid: bigint('amount_paid', { mode: 'number' }).notNull().default(0),
    balance: bigint('balance', { mode: 'number' }).notNull(),

    currency: char('currency', { length: 3 }).notNull(),

    /**
     * Statut partagé avec la créance de charge (DEC-015).
     *
     * Naît `UNPAID` : le défaut de la colonne et le cas d'usage disent la même
     * chose. « À venir » n'est PAS ici, c'est une dérivation d'affichage quand
     * le statut est `UNPAID` et l'échéance future (BR-037). `OVERDUE` est écrit
     * par un job idempotent, jamais au moment de la lecture.
     */
    status: receivableStatusEnum('status').notNull().default('UNPAID'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /*
     * UNE seule échéance par contrat et par période (section 20).
     *
     * C'est la contrainte CENTRALE du lot : c'est elle, et elle seule, qui rend
     * la génération idempotente. Le job peut être rejoué, déclenché deux fois
     * par la plateforme ou doublé par une génération manuelle sans créer de
     * dette en double, ce qu'exige DEC-028. Un pré-contrôle par lecture ne
     * suffirait pas : deux exécutions simultanées passeraient chacune.
     */
    uniqueIndex('rent_installments_one_per_lease_and_period').on(table.leaseId, table.periodStart),

    /*
     * Période normalisée au premier jour du mois.
     *
     * La contrainte encode ce que « premier jour de la période » veut dire pour
     * un loyer, qui se paie au mois (le bail porte un JOUR d'échéance, donc un
     * rythme mensuel). Elle reste vraie d'un rythme trimestriel ou annuel, qui
     * commencerait aussi un premier du mois : seule une période à cheval sur un
     * mois la rouvrirait.
     */
    check('rent_installments_period_starts_month', sql`EXTRACT(DAY FROM period_start) = 1`),

    /*
     * Invariants financiers de la section 21, portés par la BASE.
     *
     * Les trois premiers sont écrits dans le document ; le quatrième lie le
     * solde aux deux montants dont il est dérivé. Sans lui, une allocation mal
     * écrite laisserait une ligne dont le solde ne correspond plus à rien, et
     * seul un contrôle d'intégrité périodique s'en apercevrait. Ici, la
     * transaction échoue.
     */
    check('rent_installments_amount_due_non_negative', sql`amount_due >= 0`),
    check('rent_installments_amount_paid_non_negative', sql`amount_paid >= 0`),
    check('rent_installments_amount_paid_within_due', sql`amount_paid <= amount_due`),
    check('rent_installments_balance_is_derived', sql`balance = amount_due - amount_paid`),

    check('rent_installments_currency_format', sql`currency ~ '^[A-Z]{3}$'`),

    /*
     * Deux cohérences de statut, et deux seulement.
     *
     * `PAID` sans solde nul et `UNPAID` avec un paiement sont des états
     * impossibles, au même titre qu'un bail clôturé sans date de clôture.
     * `PARTIALLY_PAID` et `OVERDUE` n'en reçoivent pas : le premier dépend d'un
     * solde strictement positif ET d'un paiement, le second d'une date relue
     * chaque jour, et une contrainte sur la date du jour serait non
     * déterministe, donc interdite dans un CHECK.
     */
    check('rent_installments_paid_has_no_balance', sql`status <> 'PAID' OR balance = 0`),
    check('rent_installments_unpaid_has_no_payment', sql`status <> 'UNPAID' OR amount_paid = 0`),

    /*
     * Index de lecture.
     *
     * Les quatre premiers servent les filtres de la liste (API section 18) et la
     * traduction du périmètre en SQL. Le dernier sert le job qui bascule en
     * `OVERDUE` : il balaie par date d'échéance et par statut, sur toute la
     * base et non sur une organisation.
     */
    index('rent_installments_organization_status_idx').on(table.organizationId, table.status),
    index('rent_installments_property_status_idx').on(table.propertyId, table.status),
    index('rent_installments_apartment_idx').on(table.apartmentId),
    index('rent_installments_tenant_status_idx').on(table.tenantUserId, table.status),
    index('rent_installments_lease_period_idx').on(table.leaseId, table.periodStart),
    index('rent_installments_status_due_date_idx').on(table.status, table.dueDate),
  ],
);

export type RentInstallment = typeof rentInstallments.$inferSelect;
export type NewRentInstallment = typeof rentInstallments.$inferInsert;
