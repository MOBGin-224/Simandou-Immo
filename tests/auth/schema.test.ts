import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { accounts, sessions, users, verifications } from '../../src/db/schema';

/**
 * Conformité du schéma avec ce que Better Auth adresse.
 *
 * Pourquoi ce test existe : l'adaptateur Drizzle n'adresse PAS les colonnes par
 * leur nom physique, mais par leur NOM DE PROPRIETE TypeScript. Renommer
 * `expiresAt` en `expiration` dans le schéma casse l'authentification entière,
 * sans que ni le typage ni la migration ne s'en plaignent. Ce test transforme ce
 * piège silencieux en échec immédiat et nommé.
 *
 * La seconde règle est moins évidente : toute colonne que Better Auth n'écrit
 * PAS doit être nullable ou avoir une valeur par défaut. Sinon chaque insertion
 * de la bibliothèque viole une contrainte NOT NULL, et l'erreur obtenue ne dit
 * rien de la cause.
 */

/** Propriétés que Better Auth lit et écrit, correspondances comprises. */
const ADDRESSED_BY_BETTER_AUTH = {
  users: [
    'id',
    'fullName', // modèle : name
    'phone', // greffon téléphone : phoneNumber
    'phoneVerified', // greffon téléphone : phoneNumberVerified
    'email',
    'emailVerified',
    'image',
    'status', // champ additionnel
    'archivedAt', // champ additionnel
    'createdAt',
    'updatedAt',
  ],
  accounts: [
    'id',
    'accountId',
    'providerId',
    'userId',
    'accessToken',
    'refreshToken',
    'idToken',
    'accessTokenExpiresAt',
    'refreshTokenExpiresAt',
    'scope',
    'password',
    'createdAt',
    'updatedAt',
  ],
  sessions: [
    'id',
    'token',
    'expiresAt',
    'ipAddress',
    'userAgent',
    'userId',
    'createdAt',
    'updatedAt',
  ],
  verifications: ['id', 'identifier', 'value', 'expiresAt', 'createdAt', 'updatedAt'],
} as const;

const TABLES = { users, accounts, sessions, verifications };

describe('conformité du schéma avec Better Auth', () => {
  for (const [name, expected] of Object.entries(ADDRESSED_BY_BETTER_AUTH)) {
    it(`${name} expose toutes les propriétés attendues`, () => {
      const actual = Object.keys(getTableColumns(TABLES[name as keyof typeof TABLES]));

      for (const property of expected) {
        expect(actual, `propriété « ${property} » absente de ${name}`).toContain(property);
      }
    });

    it(`${name} n'impose aucune colonne que Better Auth n'écrit pas`, () => {
      const columns = getTableColumns(TABLES[name as keyof typeof TABLES]);

      for (const [property, column] of Object.entries(columns)) {
        if ((expected as readonly string[]).includes(property)) continue;

        const acceptsOmission = !column.notNull || column.hasDefault;

        expect(
          acceptsOmission,
          `${name}.${property} est obligatoire sans défaut : toute écriture de Better Auth échouerait`,
        ).toBe(true);
      }
    });
  }

  it("isole les secrets d'authentification hors de la table des utilisateurs", () => {
    const userColumns = Object.keys(getTableColumns(users));

    // ADR-006 : aucun secret dans `users`. Le hachage vit dans `accounts`.
    expect(userColumns).not.toContain('password');
    expect(Object.keys(getTableColumns(accounts))).toContain('password');
  });
});
