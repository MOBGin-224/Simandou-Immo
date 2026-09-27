import { sql } from 'drizzle-orm';
import { boolean, check, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { userStatusEnum } from './enums';

/**
 * Utilisateur.
 *
 * Volontairement sans `organization_id` : un même utilisateur peut appartenir à
 * plusieurs organisations, et y détenir plusieurs rôles. Ce rattachement est
 * porté par `user_access` (DEC-003).
 *
 * Cette table est aussi le modèle utilisateur de Better Auth (DEC-032,
 * ADR-006). Les identifiants de connexion, dont le hachage du mot de passe,
 * vivent dans `accounts` : aucun secret d'authentification ne figure ici.
 *
 * `REVOKED` n'est pas un statut d'utilisateur : la révocation concerne un accès,
 * pas une personne. Voir `user_access.status`.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fullName: varchar('full_name', { length: 200 }).notNull(),

    /**
     * Identifiant principal sur le marché visé (DEC-032). Unique lorsqu'il est
     * renseigné : PostgreSQL autorise plusieurs NULL dans un index unique, ce
     * qui correspond exactement au besoin.
     *
     * Better Auth lit et écrit cette colonne sous le nom `phoneNumber`, via la
     * correspondance déclarée dans la configuration du greffon téléphone.
     */
    phone: varchar('phone', { length: 30 }).unique(),

    /** Identifiant secondaire, souvent absent en Guinée. */
    email: varchar('email', { length: 320 }).unique(),

    status: userStatusEnum('status').notNull().default('PENDING_ACTIVATION'),

    /**
     * Exigé par le greffon téléphone de Better Auth, qui lit et écrit cette
     * colonne. Reste `false` au MVP : aucun canal de vérification n'existe,
     * l'OTP étant reporté avec DEC-008. C'est pourquoi la configuration
     * désactive `requireVerification`, sans quoi aucune connexion ne serait
     * possible.
     */
    phoneVerified: boolean('phone_verified').notNull().default(false),

    /**
     * Exigé par le modèle utilisateur de Better Auth. Reste `false` au MVP :
     * l'activation d'un compte passe par un lien d'invitation, jamais par un
     * email de confirmation (DEC-026, ADR-008).
     */
    emailVerified: boolean('email_verified').notNull().default(false),

    /**
     * Exigé par le modèle utilisateur de Better Auth, qui refuse de démarrer si
     * la colonne est absente. Aucun avatar n'est exposé au MVP.
     */
    image: varchar('image', { length: 2048 }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  () => [
    check('users_full_name_not_blank', sql`length(btrim(full_name)) > 0`),
    // Un utilisateur doit être joignable par au moins un identifiant, sinon
    // aucune invitation ne peut lui parvenir et le compte est inutilisable.
    check('users_has_identifier', sql`phone IS NOT NULL OR email IS NOT NULL`),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
