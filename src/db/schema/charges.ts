import { sql } from 'drizzle-orm';
import {
  bigint,
  char,
  check,
  date,
  index,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { allocationMethodEnum, chargeStatusEnum, receivableStatusEnum } from './enums';
import { leases } from './leases';
import { organizations } from './organizations';
import { apartments, properties } from './properties';
import { users } from './users';

/**
 * Charge commune d'un immeuble (BR-049 à BR-054, Database Schema sections 28 et
 * 29).
 *
 * Une charge part d'un montant GLOBAL qui appartient à l'immeuble, une facture
 * d'eau par exemple (BR-049). Elle ne doit rien à personne tant qu'elle n'est pas
 * publiée : c'est la publication qui crée les créances, une par logement
 * concerné (DEC-005), et une charge en brouillon n'est visible d'aucun locataire.
 *
 * `type` est du TEXTE sous contrainte et non une énumération, parce que la liste
 * des natures de charge est destinée à s'étendre sans changement de logique
 * (DEC-021) : ajouter « ascenseur » ou « internet » ne change rien au calcul,
 * là où ajouter un statut en changerait le cycle.
 *
 * Aucune colonne `document_id` : le justificatif se rattache par
 * `charge_documents` (DEC-024), au lot Documents.
 */
export const charges = pgTable(
  'charges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),

    /**
     * Immeuble qui supporte la charge.
     *
     * C'est le niveau auquel une facture commune arrive (BR-049), et c'est aussi
     * le niveau auquel le périmètre d'un gestionnaire se vérifie (ADR-007) : la
     * colonne est donc lue sans jointure par le contrôle d'accès, comme sur les
     * échéances de loyer.
     */
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'restrict' }),

    /** Nature de la charge. Liste extensible, tenue par une contrainte CHECK. */
    type: varchar('type', { length: 40 }).notNull(),

    /**
     * Premier jour de la période couverte, date CIVILE.
     *
     * Même convention que la créance de loyer : une période s'identifie par une
     * date normalisée, jamais par un libellé « septembre 2026 » qui ne se compare
     * ni ne s'ordonne.
     */
    periodStart: date('period_start').notNull(),

    /**
     * Jour où la part est due.
     *
     * Portée par la CHARGE et recopiée sur chaque créance à la publication
     * (section 28) : les douze parts d'une même facture sont dues le même jour,
     * et le lire sur la charge évite douze dates qui pourraient diverger.
     */
    dueDate: date('due_date').notNull(),

    /** Montant global à répartir (BR-049). Convention monétaire DEC-014. */
    totalAmount: bigint('total_amount', { mode: 'number' }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),

    /**
     * Méthode de répartition, et elle est TOUJOURS explicite (BR-050).
     *
     * Seule `EQUAL` existe au MVP (DEC-029). La colonne n'en reste pas moins
     * nécessaire : une charge publiée doit indiquer comment elle a été calculée,
     * et `CUSTOM` comme `CONSUMPTION` arriveront sans migration.
     */
    allocationMethod: allocationMethodEnum('allocation_method').notNull().default('EQUAL'),

    /**
     * Cycle de vie de la charge, distinct de celui de ses créances.
     *
     * `DRAFT` à la naissance : la charge existe, elle ne doit rien. `PUBLISHED`
     * après la répartition, et une charge publiée ne peut pas l'être deux fois
     * (BR-052). `CANCELLED` annule la charge ET ses créances, sans rien
     * supprimer (BR-054).
     */
    status: chargeStatusEnum('status').notNull().default('DRAFT'),

    /** Fournisseur à l'origine de la facture, par exemple « SEG ». Facultatif. */
    supplierName: varchar('supplier_name', { length: 120 }),

    publishedAt: timestamp('published_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),

    /**
     * Personne qui a enregistré la charge.
     *
     * Exigée par la section 28, et c'est une trace : une charge est une somme
     * réclamée à des locataires, donc elle doit toujours pouvoir être rattachée à
     * qui l'a saisie (BR-054).
     */
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /*
     * Liste fermée des natures de charge (section 29).
     *
     * `text` plus CHECK et non énumération : la liste s'étend sans changement de
     * logique (DEC-021), et une contrainte se modifie par une migration ordinaire
     * là où une énumération déjà appliquée est coûteuse à faire évoluer.
     *
     * `tests/charges/schema.test.ts` confronte cette liste à `CHARGE_TYPES` du
     * module, valeur par valeur : les deux ne peuvent pas diverger sans qu'un
     * test le voie.
     */
    check(
      'charges_type_allowed',
      sql`type IN ('WATER', 'ELECTRICITY', 'SECURITY', 'CLEANING', 'OTHER')`,
    ),

    /*
     * Un montant STRICTEMENT positif, à la différence d'une créance.
     *
     * La section 28 l'écrit ainsi, et c'est juste : une facture de zéro n'est pas
     * une charge, et la publier créerait des créances de zéro franc à réclamer à
     * douze locataires. Une part, elle, peut valoir zéro, ce qui arrive sur un
     * reste d'arrondi.
     */
    check('charges_total_amount_positive', sql`total_amount > 0`),
    check('charges_currency_format', sql`currency ~ '^[A-Z]{3}$'`),

    /* Même normalisation que la période d'un loyer : le premier du mois. */
    check('charges_period_starts_month', sql`EXTRACT(DAY FROM period_start) = 1`),

    /*
     * L'échéance ne précède pas la période qu'elle règle.
     *
     * API section 29 : « la période et la date d'échéance sont valides » sans dire
     * ce que valide veut dire. Une facture d'eau de septembre payable le 10
     * septembre comme le 10 octobre est normale ; payable en août, elle réclamerait
     * une somme avant que la consommation ait eu lieu.
     */
    check('charges_due_date_after_period', sql`due_date >= period_start`),

    check(
      'charges_supplier_name_not_blank',
      sql`supplier_name IS NULL OR length(btrim(supplier_name)) > 0`,
    ),

    /*
     * Trois cohérences de statut, portées par la BASE.
     *
     * Une charge publiée a une date de publication, un brouillon n'en a pas, et
     * une annulation a toujours sa date. Le pendant exact de
     * `leases_terminated_at_matches_status` : un état et sa date ne doivent pas
     * pouvoir se contredire. Une charge publiée PUIS annulée garde ses deux dates,
     * ce que ces contraintes autorisent, l'historique devant rester lisible.
     */
    check('charges_published_has_date', sql`status <> 'PUBLISHED' OR published_at IS NOT NULL`),
    check('charges_draft_has_no_published_date', sql`status <> 'DRAFT' OR published_at IS NULL`),
    check(
      'charges_cancelled_at_matches_status',
      sql`(status = 'CANCELLED') = (cancelled_at IS NOT NULL)`,
    ),

    /* Index de lecture : la liste filtrée (API section 30) et le périmètre. */
    index('charges_property_period_idx').on(table.propertyId, table.periodStart),
    index('charges_organization_status_idx').on(table.organizationId, table.status),
    index('charges_property_status_idx').on(table.propertyId, table.status),
  ],
);

/**
 * Créance de charge, la part d'un logement (DEC-005, Database Schema section 30).
 *
 * > **DEC-005, décision verrouillée.** Une part de charge est une **créance
 * > payable**, au même titre qu'une échéance de loyer.
 *
 * C'est la SECONDE créance du MVP, et elle est volontairement bâtie comme la
 * première : mêmes colonnes financières, même énumération de statut
 * `receivable_status` (DEC-015), mêmes invariants portés par la base. Un
 * paiement allouera donc à l'une ou à l'autre sans que le moteur d'allocation
 * ait deux formes à connaître (DEC-022, Lot 11).
 *
 * Ce qui la DISTINGUE de l'échéance de loyer tient en trois points, et ils
 * expliquent chacun une colonne :
 *
 *   1. elle naît d'une répartition et non d'un contrat, d'où `charge_id` et
 *      `calculation_basis` ;
 *   2. elle est portée par un LOGEMENT et non par un bail, d'où `lease_id` et
 *      `tenant_user_id` NULLABLES : un logement vacant doit sa part, sans
 *      locataire redevable (BR-052) ;
 *   3. elle n'est pas générée en série tous les mois : elle naît une fois, à la
 *      publication, et la publication n'est pas rejouable (BR-052).
 */
export const chargeAllocations = pgTable(
  'charge_allocations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    chargeId: uuid('charge_id')
      .notNull()
      .references(() => charges.id, { onDelete: 'restrict' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'restrict' }),
    apartmentId: uuid('apartment_id')
      .notNull()
      .references(() => apartments.id, { onDelete: 'restrict' }),

    /**
     * Bail et personne redevables, FIGÉS à la publication (section 30).
     *
     * Renseignés depuis le bail actif du logement au moment de la répartition, et
     * jamais recalculés ensuite : la part d'une facture de septembre est due par
     * qui occupait le logement quand elle a été répartie, et l'arrivée d'un
     * nouveau locataire ne lui transfère pas une dette qui n'est pas la sienne.
     *
     * Tous deux NULS pour un logement vacant : la créance existe alors au niveau
     * du logement, reste visible du propriétaire et du gestionnaire, et
     * n'apparaît dans aucun espace locataire (BR-052).
     */
    leaseId: uuid('lease_id').references(() => leases.id, { onDelete: 'restrict' }),
    tenantUserId: uuid('tenant_user_id').references(() => users.id, { onDelete: 'restrict' }),

    /** Période et échéance RECOPIÉES de la charge (sections 28 et 30). */
    periodStart: date('period_start').notNull(),
    dueDate: date('due_date').notNull(),

    /** Part calculée. Peut valoir zéro, à la différence du total d'une charge. */
    amountDue: bigint('amount_due', { mode: 'number' }).notNull(),

    /**
     * Montant payé et solde : DÉRIVÉS, stockés pour la performance (section 21).
     *
     * La source de vérité est la somme des allocations rattachées à des paiements
     * CONFIRMED. Comme pour le loyer, ces deux colonnes ne doivent jamais être
     * écrites hors de la transaction qui crée, annule ou corrige une allocation,
     * ce qui n'arrivera qu'au Lot 11 : au Lot 10, une part naît à zéro payé.
     */
    amountPaid: bigint('amount_paid', { mode: 'number' }).notNull().default(0),
    balance: bigint('balance', { mode: 'number' }).notNull(),

    currency: char('currency', { length: 3 }).notNull(),

    /** Statut partagé avec la créance de loyer (DEC-015). Naît `UNPAID`. */
    status: receivableStatusEnum('status').notNull().default('UNPAID'),

    /**
     * Justification du calcul, en JSONB (section 31).
     *
     * EXPLICATIVE et jamais source de calcul : elle permet au gestionnaire comme
     * au locataire de comprendre le montant affiché, ce qu'exige la transparence
     * de l'API section 31. Format normalisé du MVP :
     *
     * ```json
     * { "method": "EQUAL", "totalAmount": 3600000, "unitCount": 12,
     *   "baseShare": 300000, "roundingAdjustment": 0 }
     * ```
     *
     * Recalculer la part à la lecture produirait un autre nombre le jour où un
     * logement est archivé : la justification est donc FIGÉE avec la créance.
     */
    calculationBasis: jsonb('calculation_basis').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /*
     * UNE seule part par charge et par logement (section 30).
     *
     * La contrainte CENTRALE du lot, exactement comme `UNIQUE (lease_id,
     * period_start)` l'est pour le loyer : c'est elle qui rend la publication non
     * rejouable en base, et pas seulement dans le cas d'usage. Deux appels
     * simultanés sur la même charge ne peuvent donc pas produire deux jeux de
     * créances, et le bailleur ne réclame jamais deux fois la même facture.
     */
    uniqueIndex('charge_allocations_one_per_charge_and_apartment').on(
      table.chargeId,
      table.apartmentId,
    ),

    /* Mêmes invariants financiers que l'échéance de loyer (section 21). */
    check('charge_allocations_amount_due_non_negative', sql`amount_due >= 0`),
    check('charge_allocations_amount_paid_non_negative', sql`amount_paid >= 0`),
    check('charge_allocations_amount_paid_within_due', sql`amount_paid <= amount_due`),
    check('charge_allocations_balance_is_derived', sql`balance = amount_due - amount_paid`),
    check('charge_allocations_currency_format', sql`currency ~ '^[A-Z]{3}$'`),
    check('charge_allocations_period_starts_month', sql`EXTRACT(DAY FROM period_start) = 1`),

    /* Mêmes deux cohérences de statut, et pour les mêmes raisons. */
    check('charge_allocations_paid_has_no_balance', sql`status <> 'PAID' OR balance = 0`),
    check('charge_allocations_unpaid_has_no_payment', sql`status <> 'UNPAID' OR amount_paid = 0`),

    /*
     * Le bail et la personne vont ENSEMBLE, ou pas du tout.
     *
     * Les deux sont lus du même bail actif au même instant (section 30) : une
     * créance qui porterait un bail sans sa personne, ou l'inverse, viendrait
     * forcément d'une écriture partielle. Un logement vacant n'a ni l'un ni
     * l'autre, et c'est le seul cas de nullité prévu.
     */
    check(
      'charge_allocations_lease_and_tenant_together',
      sql`(lease_id IS NULL) = (tenant_user_id IS NULL)`,
    ),

    /*
     * Index de lecture.
     *
     * Les quatre premiers sont ceux de la section 56, et servent le périmètre, la
     * liste des créances d'un locataire et le filtre par échéance. Le dernier sert
     * le job qui bascule en `OVERDUE`, qui balaie par statut et par date sur toute
     * la base.
     */
    index('charge_allocations_charge_idx').on(table.chargeId),
    index('charge_allocations_tenant_status_idx').on(table.tenantUserId, table.status),
    index('charge_allocations_organization_due_date_idx').on(table.organizationId, table.dueDate),
    index('charge_allocations_property_status_idx').on(table.propertyId, table.status),
    index('charge_allocations_apartment_idx').on(table.apartmentId),
    index('charge_allocations_status_due_date_idx').on(table.status, table.dueDate),
  ],
);

export type Charge = typeof charges.$inferSelect;
export type NewCharge = typeof charges.$inferInsert;
export type ChargeAllocation = typeof chargeAllocations.$inferSelect;
export type NewChargeAllocation = typeof chargeAllocations.$inferInsert;
