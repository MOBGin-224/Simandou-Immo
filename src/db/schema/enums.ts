import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Énumérations PostgreSQL du MVP.
 *
 * Toutes sont créées dans la migration initiale, y compris celles des tables
 * des lots suivants (MVP-BACKLOG-005). Motif : modifier une énumération déjà
 * appliquée est coûteux, et une migration appliquée ne doit pas être réécrite
 * (Database Schema §60). Les figer d'emblée évite une série de migrations
 * correctives.
 *
 * Règles appliquées (DEC-021, Database Schema §46) :
 *   1. valeurs en MAJUSCULES, en anglais ;
 *   2. valeur identique dans la base, le domaine, l'API, le frontend, les tests ;
 *   3. aucune énumération ne contient ARCHIVED : l'archivage est porté par
 *      `archived_at` (DEC-020) ;
 *   4. `rent_status` et `property_status` n'existent pas.
 *
 * Les listes destinées à s'étendre sans changement de logique ne sont pas des
 * énumérations mais du `text` avec contrainte CHECK : `charge_type`,
 * `incident_category`, `expense_category`.
 */

// --- Organisation et identité ------------------------------------------------

export const organizationTypeEnum = pgEnum('organization_type', ['INDIVIDUAL', 'COMPANY']);

export const userStatusEnum = pgEnum('user_status', ['PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED']);

// --- Accès -------------------------------------------------------------------

export const roleEnum = pgEnum('role', ['OWNER', 'MANAGER', 'TENANT']);

export const userAccessStatusEnum = pgEnum('user_access_status', [
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
]);

/**
 * Une seule valeur au MVP (DEC-025). La colonne existe pour ne pas bloquer une
 * granularité future, sans introduire dès maintenant de logique conditionnelle.
 */
export const accessLevelEnum = pgEnum('access_level', ['MANAGE']);

// --- Patrimoine --------------------------------------------------------------

/**
 * `AVAILABLE` n'est pas utilisé : le terme officiel est « Vacant » (DEC-019).
 * `RESERVED` est hors périmètre MVP.
 */
export const apartmentStatusEnum = pgEnum('apartment_status', [
  'VACANT',
  'OCCUPIED',
  'MAINTENANCE',
]);

// --- Relation locative -------------------------------------------------------

export const leaseStatusEnum = pgEnum('lease_status', ['DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED']);

// --- Finance -----------------------------------------------------------------

/**
 * Cycle partagé par les DEUX types de créance, loyer et charge (DEC-005, DEC-015).
 *
 * « À venir » n'y figure pas : c'est un affichage dérivé lorsque le statut est
 * UNPAID et la date d'échéance future, jamais une valeur stockée.
 */
export const receivableStatusEnum = pgEnum('receivable_status', [
  'UNPAID',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'CANCELLED',
]);

/**
 * `INITIATED` n'existe pas : un paiement créé et non confirmé est PENDING.
 * `REFUNDED` est hors MVP : une correction utilise CANCELLED avec trace d'audit
 * (DEC-016).
 */
export const paymentStatusEnum = pgEnum('payment_status', [
  'PENDING',
  'CONFIRMED',
  'FAILED',
  'CANCELLED',
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'CASH',
  'BANK_TRANSFER',
  'MOBILE_MONEY',
  'OTHER',
]);

export const chargeStatusEnum = pgEnum('charge_status', ['DRAFT', 'PUBLISHED', 'CANCELLED']);

/**
 * Seule `EQUAL` au MVP (DEC-029). `CUSTOM` et `CONSUMPTION` seront ajoutées
 * lorsque ces méthodes entreront dans le périmètre.
 */
export const allocationMethodEnum = pgEnum('allocation_method', ['EQUAL']);

export const expenseStatusEnum = pgEnum('expense_status', ['RECORDED', 'CANCELLED']);

// --- Maintenance -------------------------------------------------------------

/**
 * Cycle de l'incident (DEC-017). Distinct de celui de l'intervention.
 * « À traiter » n'est pas un statut : c'est un filtre du tableau de bord
 * gestionnaire portant sur OPEN et ASSIGNED.
 */
export const incidentStatusEnum = pgEnum('incident_status', [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'ON_HOLD',
  'RESOLVED',
  'CLOSED',
]);

export const incidentPriorityEnum = pgEnum('incident_priority', ['LOW', 'NORMAL', 'URGENT']);

/** Cycle de l'intervention (DEC-018), distinct de celui de l'incident. */
export const interventionStatusEnum = pgEnum('intervention_status', [
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);

// --- Invitations et notifications --------------------------------------------

export const invitationStatusEnum = pgEnum('invitation_status', [
  'PENDING',
  'SENT',
  'ACCEPTED',
  'EXPIRED',
  'REVOKED',
]);

/** Seul IN_APP est actif au MVP (DEC-027). Les autres sont définis, inactifs. */
export const notificationChannelEnum = pgEnum('notification_channel', [
  'IN_APP',
  'SMS',
  'WHATSAPP',
  'EMAIL',
]);

/** État de délivrance. L'état « lu » n'est pas un statut : il est porté par `read_at`. */
export const notificationStatusEnum = pgEnum('notification_status', ['PENDING', 'SENT', 'FAILED']);
