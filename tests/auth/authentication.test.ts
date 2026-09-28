import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  AccountNotActiveError,
  InvalidCredentialsError,
  UnauthenticatedError,
  definePassword,
  endSession,
  requireUser,
  resolveSession,
  signInWithPhone,
} from '../../src/lib/auth/session';
import { createTestAuth, signInHeaders } from '../helpers/auth';
import { createTestDatabase, type TestDatabase } from '../helpers/database';

/**
 * MVP-BACKLOG-010 : connexion, refus, déconnexion, expiration, absence de
 * session.
 *
 * Tout est réel : la migration, le schéma, l'instance Better Auth, le hachage du
 * mot de passe, le cookie signé. Aucune doublure. Un test qui passe ici prouve
 * qu'un utilisateur pourrait se connecter en production.
 *
 * Les refus sont majoritaires, et c'est voulu : une authentification se juge à ce
 * qu'elle interdit, pas à ce qu'elle autorise.
 */
describe('Authentification par téléphone et mot de passe', () => {
  let harness: TestDatabase;
  let auth: ReturnType<typeof createTestAuth>;

  const PASSWORD = 'motdepasse-solide-2026';

  const activeUserId = '33333333-3333-4333-8333-333333333301';
  const suspendedUserId = '33333333-3333-4333-8333-333333333302';
  const pendingUserId = '33333333-3333-4333-8333-333333333303';
  const archivedUserId = '33333333-3333-4333-8333-333333333304';

  const ACTIVE_PHONE = '+224620000001';
  const SUSPENDED_PHONE = '+224620000002';
  const PENDING_PHONE = '+224620000003';
  const ARCHIVED_PHONE = '+224620000004';

  beforeAll(async () => {
    harness = await createTestDatabase();
    auth = createTestAuth(harness.db);

    const { db, schema } = harness;

    await db.insert(schema.users).values([
      { id: activeUserId, fullName: 'Aissatou Diallo', phone: ACTIVE_PHONE, status: 'ACTIVE' },
      { id: suspendedUserId, fullName: 'Mamadou Bah', phone: SUSPENDED_PHONE, status: 'SUSPENDED' },
      { id: pendingUserId, fullName: 'Fatoumata Camara', phone: PENDING_PHONE },
      {
        id: archivedUserId,
        fullName: 'Ousmane Sylla',
        phone: ARCHIVED_PHONE,
        status: 'ACTIVE',
        archivedAt: new Date(),
      },
    ]);

    // Les quatre comptes ont un mot de passe : ce que les tests vérifient est le
    // statut métier, pas l'absence d'identifiants.
    for (const userId of [activeUserId, suspendedUserId, pendingUserId, archivedUserId]) {
      await definePassword(auth, { userId, password: PASSWORD });
    }
  }, 120_000);

  afterAll(async () => {
    await harness?.close();
  });

  // --- Connexion -------------------------------------------------------------

  it('connecte un utilisateur actif et renvoie son identite metier', async () => {
    const result = await signInWithPhone(auth, { phone: ACTIVE_PHONE, password: PASSWORD });

    expect(result.token).toBeTruthy();
    expect(result.user).toMatchObject({
      id: activeUserId,
      fullName: 'Aissatou Diallo',
      phone: ACTIVE_PHONE,
      status: 'ACTIVE',
    });
  });

  it('renseigne la date de derniere connexion', async () => {
    const { db, schema } = harness;

    await db
      .update(schema.users)
      .set({ lastLoginAt: null })
      .where(eq(schema.users.id, activeUserId));

    await signInWithPhone(auth, { phone: ACTIVE_PHONE, password: PASSWORD });

    const rows = await db
      .select({ lastLoginAt: schema.users.lastLoginAt })
      .from(schema.users)
      .where(eq(schema.users.id, activeUserId));

    expect(rows[0]?.lastLoginAt).toBeInstanceOf(Date);
  });

  it("n'expose jamais le mot de passe en clair", async () => {
    const { db, schema } = harness;

    const rows = await db
      .select({ password: schema.accounts.password })
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, activeUserId));

    expect(rows[0]?.password).toBeTruthy();
    expect(rows[0]?.password).not.toContain(PASSWORD);
  });

  // --- Refus de connexion ----------------------------------------------------

  it('refuse un mot de passe incorrect', async () => {
    await expect(
      signInWithPhone(auth, { phone: ACTIVE_PHONE, password: 'mauvais-mot-de-passe' }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it("refuse un numero inconnu avec la meme erreur qu'un mot de passe faux", async () => {
    await expect(
      signInWithPhone(auth, { phone: '+224629999999', password: PASSWORD }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('refuse un compte suspendu, meme avec le bon mot de passe', async () => {
    await expect(
      signInWithPhone(auth, { phone: SUSPENDED_PHONE, password: PASSWORD }),
    ).rejects.toThrow(AccountNotActiveError);
  });

  it("refuse un compte qui n'a pas encore ete active", async () => {
    await expect(
      signInWithPhone(auth, { phone: PENDING_PHONE, password: PASSWORD }),
    ).rejects.toThrow(AccountNotActiveError);
  });

  it('refuse un compte archive', async () => {
    await expect(
      signInWithPhone(auth, { phone: ARCHIVED_PHONE, password: PASSWORD }),
    ).rejects.toThrow(AccountNotActiveError);
  });

  it("ne cree aucune session lorsqu'un compte non actif presente le bon mot de passe", async () => {
    const { db, schema } = harness;

    await expect(
      signInWithPhone(auth, { phone: SUSPENDED_PHONE, password: PASSWORD }),
    ).rejects.toThrow(AccountNotActiveError);

    const sessions = await db
      .select({ id: schema.sessions.id })
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, suspendedUserId));

    expect(sessions).toHaveLength(0);
  });

  // --- Session ---------------------------------------------------------------

  describe('session etablie', () => {
    let headers: Headers;

    beforeEach(async () => {
      headers = await signInHeaders(auth, { phone: ACTIVE_PHONE, password: PASSWORD });
    });

    it('resout la session courante', async () => {
      const session = await resolveSession(auth, headers);

      expect(session).not.toBeNull();
      expect(session?.user.id).toBe(activeUserId);
      expect(session?.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('deconnecte, et la session ne vaut plus rien', async () => {
      await endSession(auth, headers);

      expect(await resolveSession(auth, headers)).toBeNull();
      await expect(requireUser(auth, headers)).rejects.toThrow(UnauthenticatedError);
    });

    it('refuse une session expiree', async () => {
      const { db, schema } = harness;

      await db
        .update(schema.sessions)
        .set({ expiresAt: new Date(Date.now() - 1_000) })
        .where(eq(schema.sessions.userId, activeUserId));

      expect(await resolveSession(auth, headers)).toBeNull();
    });

    it('refuse une session dont le compte a ete suspendu entre-temps', async () => {
      const { db, schema } = harness;

      await db
        .update(schema.users)
        .set({ status: 'SUSPENDED' })
        .where(eq(schema.users.id, activeUserId));

      try {
        expect(await resolveSession(auth, headers)).toBeNull();
        await expect(requireUser(auth, headers)).rejects.toThrow(UnauthenticatedError);
      } finally {
        await db
          .update(schema.users)
          .set({ status: 'ACTIVE' })
          .where(eq(schema.users.id, activeUserId));
      }
    });
  });

  // --- Absence de session ----------------------------------------------------

  it('ne resout aucune session sans cookie', async () => {
    expect(await resolveSession(auth, new Headers())).toBeNull();
  });

  it('refuse une operation protegee sans session', async () => {
    await expect(requireUser(auth, new Headers())).rejects.toThrow(UnauthenticatedError);
  });

  it('refuse un cookie de session forge', async () => {
    const forged = new Headers({ cookie: 'better-auth.session_token=jeton-invente' });

    expect(await resolveSession(auth, forged)).toBeNull();
  });
});
