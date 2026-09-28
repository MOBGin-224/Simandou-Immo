import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { betterAuth } from 'better-auth/minimal';
import { phoneNumber } from 'better-auth/plugins/phone-number';
import { eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import * as schema from '@/db/schema';
import { users } from '@/db/schema';

/**
 * Configuration de Better Auth (DEC-032, ADR-006).
 *
 * C'est le SEUL module du projet autorisé à importer `better-auth`, avec le
 * gestionnaire de route HTTP. Le code métier passe par le service interne de
 * `@/lib/auth`, jamais par la bibliothèque : toute violation est un défaut
 * bloquant en revue.
 *
 * La fabrique prend sa base de données en paramètre plutôt que de l'importer.
 * C'est ce qui permet aux tests de construire une instance réelle sur PGlite,
 * donc de vérifier l'authentification contre le vrai schéma et non contre des
 * doublures.
 *
 * `better-auth/minimal` est l'entrée prévue lorsque l'accès aux données passe
 * par un adaptateur : elle évite d'embarquer Kysely, inutile ici puisque
 * Drizzle est notre seul chemin vers PostgreSQL (ADR-004).
 */

/**
 * Instance Drizzle attendue, quel que soit son pilote : `postgres-js` en
 * applicatif, PGlite en test.
 *
 * Volontairement pas le type de l'adaptateur Better Auth, qui est un simple
 * `{ [key: string]: any }` : il désactiverait tout contrôle de type dans les
 * hooks ci-dessous, c'est-à-dire précisément dans le code qui décide si une
 * connexion est autorisée.
 */
export type AuthDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * Politique minimale de robustesse du mot de passe.
 *
 * 10 caractères plutôt que les 8 par défaut de la bibliothèque. Le MVP n'a
 * aucun second facteur et la récupération de compte dépend d'un tiers
 * (DEC-026) : la longueur est donc la seule barrière réellement disponible.
 */
export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 128;

/** Durée de vie d'une session, et fréquence de son renouvellement glissant. */
export const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;
export const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24;

/** Identifiant de fournisseur utilisé par Better Auth pour un mot de passe. */
export const CREDENTIAL_PROVIDER_ID = 'credential';

export type CreateAuthOptions = {
  database: AuthDatabase;
  secret: string;
  baseURL: string;
};

export function createAuth({ database, secret, baseURL }: CreateAuthOptions) {
  return betterAuth({
    appName: 'SIMANDOU IMMO',
    secret,
    baseURL,

    database: drizzleAdapter(database, {
      provider: 'pg',
      // Nos tables sont au pluriel, les modèles de Better Auth au singulier.
      usePlural: true,
      schema,
    }),

    advanced: {
      database: {
        // Toutes les clés primaires du projet sont des UUID. Sans cette option,
        // Better Auth génère des chaînes courtes qu'une colonne uuid refuse.
        generateId: 'uuid',
      },
    },

    user: {
      fields: {
        // `users.full_name` porte le nom, pas une colonne `name`.
        name: 'fullName',
      },
      additionalFields: {
        /**
         * Exposés pour que le contrôle de session dispose du statut métier sans
         * requête supplémentaire. `input: false` interdit à un client de les
         * modifier par l'API de mise à jour du profil : le statut est le
         * résultat d'une décision métier, jamais d'une saisie.
         */
        status: { type: 'string', required: false, input: false },
        archivedAt: { type: 'date', required: false, input: false },
      },
    },

    emailAndPassword: {
      /**
       * Volontairement désactivé. Le seul parcours de connexion du MVP est
       * téléphone plus mot de passe (DEC-032). Laisser ce chemin ouvert
       * ajouterait une seconde porte non spécifiée, et surtout
       * `/sign-up/email` autoriserait une inscription libre alors que l'entrée
       * se fait exclusivement par invitation (ADR-008).
       *
       * Les deux longueurs restent lues même désactivé : elles s'appliquent à
       * tout mot de passe, y compris celui défini à l'activation.
       */
      enabled: false,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
    },

    session: {
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
    },

    plugins: [
      phoneNumber({
        /**
         * Aucune vérification par code à usage unique : l'OTP est reporté avec
         * DEC-008, faute de fournisseur SMS au MVP. Activer ce drapeau rendrait
         * toute connexion impossible, `phone_verified` restant `false`.
         */
        requireVerification: false,

        /**
         * Le greffon exige cette fonction, même sans OTP. Aucun fournisseur SMS
         * n'est intégré au MVP (DEC-008) : elle échoue donc bruyamment au lieu
         * de faire croire qu'un code a été envoyé.
         *
         * Conséquence assumée : les points d'entrée `/phone-number/send-otp`,
         * `/phone-number/verify` et `/phone-number/request-password-reset`
         * restent inutilisables. C'est le comportement voulu, la
         * réinitialisation passant par un lien régénéré par un utilisateur
         * autorisé (DEC-026), jamais par un code.
         */
        sendOTP() {
          throw new Error(
            "Aucun fournisseur SMS n'est intégré au MVP (DEC-008) : " +
              "l'envoi d'un code à usage unique est indisponible.",
          );
        },

        // Correspondance avec nos colonnes existantes : le greffon parle de
        // `phoneNumber`, notre table de `phone`.
        schema: {
          user: {
            fields: {
              phoneNumber: 'phone',
              phoneNumberVerified: 'phoneVerified',
            },
          },
        },
      }),
    ],

    databaseHooks: {
      session: {
        create: {
          /**
           * Un utilisateur qui n'est pas ACTIF n'obtient jamais de session,
           * même avec le bon mot de passe. Sans ce contrôle, suspendre un
           * compte n'empêcherait pas de se connecter : le statut ne serait
           * qu'une étiquette.
           *
           * Renvoyer `false` fait échouer la création de session, donc la
           * connexion, sans qu'aucune ligne ne soit écrite.
           */
          async before(session) {
            const [user] = await database
              .select({ status: users.status, archivedAt: users.archivedAt })
              .from(users)
              .where(eq(users.id, session.userId))
              .limit(1);

            if (!user) return false;
            if (user.archivedAt !== null) return false;

            return user.status === 'ACTIVE';
          },

          /**
           * Trace de la dernière connexion réussie. C'est la raison d'être de
           * la colonne `last_login_at`, renseignée ici et nulle part ailleurs.
           */
          async after(session) {
            await database
              .update(users)
              .set({ lastLoginAt: new Date() })
              .where(eq(users.id, session.userId));
          },
        },
      },
    },
  });
}

export type AuthInstance = ReturnType<typeof createAuth>;
