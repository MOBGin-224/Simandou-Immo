import { index, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';

import { users } from './users';

/**
 * Tables d'authentification de Better Auth (DEC-032, ADR-006).
 *
 * Elles vivent dans notre PostgreSQL et sont versionnées par nos migrations :
 * aucune identité parallèle, aucun store externe, aucune API propriétaire.
 * `users` reste le modèle utilisateur et `users.id` la clé métier unique.
 *
 * Contrainte forte de l'adaptateur Drizzle, vérifiée dans son code source :
 * Better Auth adresse une table par sa CLE D'EXPORT du schéma, et une colonne
 * par son NOM DE PROPRIETE TypeScript, jamais par son nom physique. Les clés
 * doivent donc rester exactement celles qu'attend la bibliothèque, en
 * camelCase, sinon l'adaptateur refuse de démarrer. Le nommage physique en
 * snake_case reste assuré par `casing: 'snake_case'`.
 *
 * Renommer une propriété de ces trois tables casse l'authentification. Un test
 * de conformité garde ce point, voir `tests/auth/schema.test.ts`.
 */

/**
 * Identifiants de connexion.
 *
 * Aucun secret d'authentification ne figure dans `users` : le hachage du mot de
 * passe vit ici, dans `password`, et n'est jamais retourné par une API.
 *
 * `provider_id` vaut `credential` pour un couple identifiant plus mot de passe.
 * Les colonnes de jetons OAuth restent vides au MVP : aucun fournisseur social
 * n'est activé. Elles sont présentes parce que Better Auth les lit et les
 * écrit, et les retirer ferait échouer son contrôle de schéma au démarrage.
 *
 * `onDelete: 'cascade'` est une exception assumée au RESTRICT par défaut du
 * projet. Ces lignes sont des identifiants, pas de l'historique métier : rien
 * de ce que DEC-013 protège ne s'y trouve. La cascade ne peut d'ailleurs pas se
 * déclencher, `user_access` interdisant déjà la suppression d'un utilisateur.
 */
export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** Identifiant chez le fournisseur. Pour `credential`, c'est `users.id`. */
    accountId: varchar('account_id', { length: 320 }).notNull(),

    /** `credential` au MVP. Un fournisseur social y écrirait son propre nom. */
    providerId: varchar('provider_id', { length: 64 }).notNull(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),

    /** Hachage du mot de passe. Jamais exposé, jamais journalisé. */
    password: text('password'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Un utilisateur n'a qu'un compte par fournisseur : sans cette contrainte,
    // deux lignes `credential` pourraient coexister et la connexion dépendrait
    // de l'ordre de lecture, donc du hasard.
    unique('accounts_provider_account_unique').on(table.providerId, table.accountId),
    index('accounts_user_idx').on(table.userId),
  ],
);

/**
 * Sessions actives.
 *
 * Révocables individuellement, ce qui sert directement l'exigence de révocation
 * immédiate d'un accès. Une session révoquée ou expirée ne doit jamais
 * permettre de poursuivre une opération protégée.
 *
 * `ip_address` et `user_agent` sont renseignés par Better Auth. Ce sont des
 * données personnelles : elles n'ont pas à sortir de cette table.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** Jeton porté par le cookie de session. Secret : jamais journalisé. */
    token: varchar('token', { length: 255 }).notNull(),

    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('sessions_token_unique').on(table.token),
    index('sessions_user_idx').on(table.userId),
    // Le balayage des sessions expirées lit cette colonne seule.
    index('sessions_expires_at_idx').on(table.expiresAt),
  ],
);

/**
 * Jetons de vérification et de réinitialisation.
 *
 * Au MVP, cette table sert le lien d'activation et la réinitialisation de mot
 * de passe déclenchée par un utilisateur autorisé (DEC-026). Aucun code à usage
 * unique par SMS n'y transite : l'OTP est reporté avec DEC-008.
 *
 * `value` est un secret à durée de vie courte. Une ligne expirée n'a aucune
 * valeur et doit pouvoir être purgée sans précaution.
 */
export const verifications = pgTable(
  'verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** Ce que le jeton prouve : un téléphone, un email, une demande de reset. */
    identifier: varchar('identifier', { length: 320 }).notNull(),

    /** Le jeton lui-même. Secret : jamais journalisé, jamais retourné. */
    value: text('value').notNull(),

    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('verifications_identifier_idx').on(table.identifier),
    index('verifications_expires_at_idx').on(table.expiresAt),
  ],
);

export type Account = typeof accounts.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Verification = typeof verifications.$inferSelect;
