import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { invitationStatusEnum, roleEnum } from './enums';
import { organizations } from './organizations';
import { apartments, properties } from './properties';
import { users } from './users';

/**
 * Invitation (ADR-008, DEC-026, DEC-041).
 *
 * Aucune inscription libre : l'accès au produit se fait exclusivement sur
 * invitation, et l'invitation porte son contexte complet. Une table commune sert
 * les gestionnaires, au Lot 6, et les locataires, au Lot 7.
 *
 * Le jeton n'est JAMAIS stocké en clair (SEC-INV-002) : seul son hachage l'est.
 * Conséquence directe, assumée : le lien ne se réaffiche pas. Un lien perdu se
 * renvoie, ce qui régénère le jeton dans la même ligne.
 *
 * `target_user_id` est toujours renseigné pour un gestionnaire : l'invité existe
 * avant d'accepter, sous la forme d'un utilisateur `PENDING_ACTIVATION` (BR-008).
 *
 * `SENT` n'est jamais atteint au MVP, aucun envoi automatique n'existant
 * (DEC-026). `EXPIRED` est dérivé de `expires_at` à la lecture : aucune tâche
 * planifiée ne l'écrit.
 */
export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    targetUserId: uuid('target_user_id').references(() => users.id, { onDelete: 'restrict' }),

    role: roleEnum('role').notNull(),

    /** Contexte d'un locataire (Lot 7). Nuls pour un gestionnaire, dont le périmètre est ailleurs. */
    propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'restrict' }),
    apartmentId: uuid('apartment_id').references(() => apartments.id, { onDelete: 'restrict' }),

    /** Téléphone, ou email, auquel l'invitation est destinée. */
    contact: varchar('contact', { length: 320 }).notNull(),

    /** SHA-256 du jeton, en hexadécimal. 64 caractères. */
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),

    status: invitationStatusEnum('status').notNull().default('PENDING'),

    /** Émission du lien en vigueur, renouvelée à chaque renvoi. */
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('invitations_token_hash_unique').on(table.tokenHash),

    /*
     * UNE invitation ouverte par personne, organisation et rôle.
     *
     * La règle est portée par la base et non par le seul cas d'usage : deux
     * demandes simultanées passeraient chacune le pré-contrôle par lecture, et
     * seule une contrainte arbitre sans faille. C'est ce qui empêche qu'une
     * personne détienne deux liens valables pour le même accès.
     */
    uniqueIndex('invitations_one_open_per_person')
      .on(table.organizationId, table.targetUserId, table.role)
      .where(sql`status IN ('PENDING', 'SENT')`),

    // Un propriétaire n'est pas invité : il naît de l'onboarding, pas d'un lien.
    check('invitations_role_not_owner', sql`role <> 'OWNER'`),
    check('invitations_expiry_after_issue', sql`expires_at > issued_at`),

    // La date et le statut ne peuvent pas diverger : l'un sans l'autre est un état impossible.
    check(
      'invitations_accepted_at_matches_status',
      sql`(status = 'ACCEPTED') = (accepted_at IS NOT NULL)`,
    ),
    check(
      'invitations_revoked_at_matches_status',
      sql`(status = 'REVOKED') = (revoked_at IS NOT NULL)`,
    ),

    index('invitations_organization_status_idx').on(table.organizationId, table.status),
    index('invitations_target_user_idx').on(table.targetUserId),
  ],
);

/**
 * Immeubles du périmètre qu'une invitation de gestionnaire attribuera (DEC-041).
 *
 * Existe parce que le seul `property_id` de `invitations` ne permet pas d'inviter
 * un gestionnaire sur plusieurs immeubles à la fois, ce qu'exigent MVP-FEAT-020
 * et le parcours 4.
 *
 * Le périmètre est RECOPIÉ dans `manager_property_access` à l'acceptation, puis
 * ces lignes ne sont plus jamais modifiées : elles documentent ce qui a été
 * accordé, et par quelle invitation.
 *
 * Les règles « au moins un immeuble, tous de l'organisation, aucun archivé »
 * sont portées par le cas d'usage : une contrainte de base ne compare pas deux
 * tables.
 */
export const invitationProperties = pgTable(
  'invitation_properties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invitationId: uuid('invitation_id')
      .notNull()
      .references(() => invitations.id, { onDelete: 'restrict' }),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'restrict' }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('invitation_properties_unique').on(table.invitationId, table.propertyId),
    index('invitation_properties_property_idx').on(table.propertyId),
  ],
);

export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type InvitationProperty = typeof invitationProperties.$inferSelect;
export type NewInvitationProperty = typeof invitationProperties.$inferInsert;
