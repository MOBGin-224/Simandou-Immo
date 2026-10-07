import { sql } from 'drizzle-orm';
import {
  bigint,
  char,
  check,
  date,
  index,
  pgTable,
  smallint,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { leaseStatusEnum } from './enums';
import { organizations } from './organizations';
import { apartments, properties } from './properties';
import { users } from './users';

/**
 * Contrat, ou relation locative (BR-020, BR-030 à BR-033, DEC-046, DEC-049).
 *
 * C'est le bail qui rattache une personne à un logement, et non l'inverse : un
 * locataire n'est pas une propriété permanente de l'appartement (BR-020). Au
 * Lot 7, ce rattachement était porté par l'invitation acceptée, faute de bail ;
 * à partir d'ici, **c'est le bail qui le porte**, et l'invitation retrouve son
 * seul rôle, ouvrir un accès au produit.
 *
 * `organization_id` et `property_id` sont dénormalisés depuis `apartments` afin
 * de vérifier l'isolation et le périmètre SANS jointure, comme l'exige le
 * contrôle d'accès systématique (ADR-007). Ils doivent rester cohérents avec
 * l'appartement référencé, ce que le cas d'usage garantit en les recopiant
 * depuis lui plutôt qu'en les recevant de l'appelant.
 *
 * `tenant_user_id` référence `users` et non une table de profils : aucune table
 * `tenant_profiles` n'existe au MVP (DEC-046). La personne peut n'avoir aucun
 * accès au produit, ce qui est le cas du locataire qui n'utilisera jamais
 * l'application.
 *
 * Aucune colonne `document_id` : les documents contractuels passeront par la
 * table de liaison `lease_documents` (DEC-024), au lot Documents.
 */
export const leases = pgTable(
  'leases',
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
    tenantUserId: uuid('tenant_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    /** Dates CIVILES et non des instants : un bail commence un jour, pas à une heure. */
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),

    /**
     * Loyer de référence du contrat (BR-031).
     *
     * Convention monétaire DEC-014 : entier, exprimé dans la plus petite unité
     * de la devise, avec devise explicite. Le mode `number` suit celui du loyer
     * de référence d'un appartement, pour que les deux se comparent sans
     * conversion.
     */
    rentAmount: bigint('rent_amount', { mode: 'number' }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),

    /** Jour du mois où le loyer est dû. Entre 1 et 31. */
    dueDay: smallint('due_day').notNull(),

    /** Caution. Zéro, et non nul : une caution absente est une caution de zéro. */
    depositAmount: bigint('deposit_amount', { mode: 'number' }).notNull().default(0),

    /**
     * `DRAFT` et `CANCELLED` ne sont PAS atteints au MVP.
     *
     * L'énumération a été figée d'emblée pour les lots suivants (DEC-021), comme
     * toutes les autres. Mais aucun document ne donne de comportement de
     * brouillon à un bail, contrairement à la charge dont l'API décrit
     * explicitement le `DRAFT`, et les routes documentées sont la création, la
     * consultation, la modification et la clôture. Un bail naît donc ACTIF, et
     * c'est le cas d'usage qui l'écrit, le défaut de la colonne restant juste
     * pour le jour où un brouillon aura un sens.
     */
    status: leaseStatusEnum('status').notNull().default('DRAFT'),

    /**
     * Raison de la clôture, libre et facultative (API section 17, BR-033).
     *
     * Texte libre et non énumération : le seul exemple que la documentation donne
     * est « move_out », et inventer la liste des autres serait décider d'un
     * vocabulaire métier à la place du fondateur. La convention du projet pour
     * une liste destinée à s'étendre est d'ailleurs le texte sous contrainte,
     * comme `charge_type` ou `incident_category`.
     */
    terminationReason: varchar('termination_reason', { length: 200 }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    terminatedAt: timestamp('terminated_at', { withTimezone: true }),
  },
  (table) => [
    /*
     * UN seul bail ACTIF par logement (BR-028).
     *
     * La règle est portée par la base et non par le seul cas d'usage : deux
     * créations simultanées passeraient chacune le pré-contrôle par lecture, et
     * seule une contrainte arbitre sans faille. Un logement ne peut donc pas être
     * loué deux fois en même temps, quelles que soient les dates.
     *
     * Les baux DRAFT, ENDED et CANCELLED en sont exclus : plusieurs brouillons
     * peuvent coexister, et l'historique d'un logement compte autant de baux
     * terminés qu'il a eu d'occupants successifs (BR-027).
     */
    uniqueIndex('leases_one_active_per_apartment')
      .on(table.apartmentId)
      .where(sql`status = 'ACTIVE'`),

    /*
     * UNE seule relation locative ACTIVE par personne et par organisation
     * (DEC-049).
     *
     * Portée ICI, au niveau du bail, et non au niveau de l'invitation : la
     * décision le dit explicitement. Une même personne peut donc être locataire
     * chez deux bailleurs différents, mais pas occuper deux logements du même
     * bailleur en même temps.
     */
    uniqueIndex('leases_one_active_per_tenant_and_organization')
      .on(table.organizationId, table.tenantUserId)
      .where(sql`status = 'ACTIVE'`),

    check('leases_rent_amount_non_negative', sql`rent_amount >= 0`),
    check('leases_deposit_amount_non_negative', sql`deposit_amount >= 0`),
    check('leases_due_day_range', sql`due_day BETWEEN 1 AND 31`),
    check('leases_end_after_start', sql`end_date IS NULL OR end_date >= start_date`),
    check('leases_currency_format', sql`currency ~ '^[A-Z]{3}$'`),

    /*
     * La date et le statut ne peuvent pas diverger : l'un sans l'autre est un
     * état impossible. Même garde-fou que sur `invitations`.
     *
     * `CANCELLED` n'est PAS une clôture : un bail annulé n'a jamais produit
     * d'occupation, et ne porte donc pas de `terminated_at`.
     */
    check(
      'leases_terminated_at_matches_status',
      sql`(status = 'ENDED') = (terminated_at IS NOT NULL)`,
    ),

    // Une raison sans clôture est un résidu : les deux vont ensemble.
    check(
      'leases_termination_reason_requires_termination',
      sql`termination_reason IS NULL OR terminated_at IS NOT NULL`,
    ),

    index('leases_apartment_status_idx').on(table.apartmentId, table.status),
    index('leases_tenant_idx').on(table.tenantUserId),
    index('leases_property_status_idx').on(table.propertyId, table.status),
    index('leases_organization_status_idx').on(table.organizationId, table.status),
  ],
);

export type Lease = typeof leases.$inferSelect;
export type NewLease = typeof leases.$inferInsert;
