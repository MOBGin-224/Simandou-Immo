import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  InvalidCredentialsError,
  UnauthenticatedError,
  WeakPasswordError,
  changePassword,
  definePassword,
  listActiveSessions,
  resolveSession,
  revokeSession,
  signInWithPhone,
} from '../../src/lib/auth/session';
import { MIN_PASSWORD_LENGTH } from '../../src/lib/auth/instance';
import { createTestAuth, signInHeaders } from '../helpers/auth';
import { createTestDatabase, type TestDatabase } from '../helpers/database';

/**
 * MVP-BACKLOG-008 : définition du mot de passe, changement, révocation
 * individuelle de session.
 *
 * Chaque test vérifie les DEUX faces d'une opération : que le nouveau chemin
 * s'ouvre, et que l'ancien se ferme. Un changement de mot de passe qui laisse
 * l'ancien fonctionner est un défaut invisible tant qu'on ne teste que le
 * succès.
 */
describe('Mot de passe et sessions', () => {
  let harness: TestDatabase;
  let auth: ReturnType<typeof createTestAuth>;

  const userId = '44444444-4444-4444-8444-444444444401';
  const otherUserId = '44444444-4444-4444-8444-444444444402';
  const PHONE = '+224621000001';
  const OTHER_PHONE = '+224621000002';
  const PASSWORD = 'motdepasse-initial-2026';
  const NEW_PASSWORD = 'motdepasse-remplace-2026';

  beforeAll(async () => {
    harness = await createTestDatabase();
    auth = createTestAuth(harness.db);

    await harness.db.insert(harness.schema.users).values([
      { id: userId, fullName: 'Kadiatou Toure', phone: PHONE, status: 'ACTIVE' },
      { id: otherUserId, fullName: 'Ibrahima Conde', phone: OTHER_PHONE, status: 'ACTIVE' },
    ]);

    await definePassword(auth, { userId: otherUserId, password: PASSWORD });
  }, 120_000);

  afterAll(async () => {
    await harness?.close();
  });

  /** Chaque test part du même état : un mot de passe connu, aucune session. */
  beforeEach(async () => {
    const { db, schema } = harness;

    await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
    await definePassword(auth, { userId, password: PASSWORD });
  });

  // --- Définition du mot de passe --------------------------------------------

  it('refuse un mot de passe plus court que la politique minimale', async () => {
    const tooShort = 'a'.repeat(MIN_PASSWORD_LENGTH - 1);

    await expect(definePassword(auth, { userId, password: tooShort })).rejects.toThrow(
      WeakPasswordError,
    );
  });

  it("ne crée jamais deux jeux d'identifiants pour le même utilisateur", async () => {
    const { db, schema } = harness;

    await definePassword(auth, { userId, password: NEW_PASSWORD });
    await definePassword(auth, { userId, password: PASSWORD });

    const accounts = await db
      .select({ id: schema.accounts.id })
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, userId));

    expect(accounts).toHaveLength(1);
  });

  it("remplace le mot de passe : le nouveau ouvre, l'ancien ferme", async () => {
    await definePassword(auth, { userId, password: NEW_PASSWORD });

    const result = await signInWithPhone(auth, { phone: PHONE, password: NEW_PASSWORD });
    expect(result.user.id).toBe(userId);

    await expect(signInWithPhone(auth, { phone: PHONE, password: PASSWORD })).rejects.toThrow(
      InvalidCredentialsError,
    );
  });

  // --- Changement de mot de passe --------------------------------------------

  it("change le mot de passe et ferme l'ancien", async () => {
    const headers = await signInHeaders(auth, { phone: PHONE, password: PASSWORD });

    await changePassword(auth, headers, {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    const result = await signInWithPhone(auth, { phone: PHONE, password: NEW_PASSWORD });
    expect(result.user.id).toBe(userId);

    await expect(signInWithPhone(auth, { phone: PHONE, password: PASSWORD })).rejects.toThrow(
      InvalidCredentialsError,
    );
  });

  it('révoque les autres sessions et renvoie le jeton de la nouvelle', async () => {
    const first = await signInHeaders(auth, { phone: PHONE, password: PASSWORD });
    const second = await signInHeaders(auth, { phone: PHONE, password: PASSWORD });

    const { token } = await changePassword(auth, second, {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    // Le jeton renvoyé est celui de la session de remplacement. Sans lui,
    // l'appelant se retrouverait déconnecté sans comprendre pourquoi.
    expect(token).toBeTruthy();

    // La session ouverte sur un autre appareil ne vaut plus rien.
    expect(await resolveSession(auth, first)).toBeNull();
  });

  it('refuse un changement dont le mot de passe actuel est faux', async () => {
    const headers = await signInHeaders(auth, { phone: PHONE, password: PASSWORD });

    await expect(
      changePassword(auth, headers, {
        currentPassword: 'ce-n-est-pas-le-bon',
        newPassword: NEW_PASSWORD,
      }),
    ).rejects.toThrow();

    // L'ancien mot de passe reste valable : rien n'a été modifié.
    const result = await signInWithPhone(auth, { phone: PHONE, password: PASSWORD });
    expect(result.user.id).toBe(userId);
  });

  it('refuse un nouveau mot de passe trop court, sans rien modifier', async () => {
    const headers = await signInHeaders(auth, { phone: PHONE, password: PASSWORD });

    await expect(
      changePassword(auth, headers, {
        currentPassword: PASSWORD,
        newPassword: 'court',
      }),
    ).rejects.toThrow(WeakPasswordError);

    const result = await signInWithPhone(auth, { phone: PHONE, password: PASSWORD });
    expect(result.user.id).toBe(userId);
  });

  it('refuse un changement de mot de passe sans session', async () => {
    await expect(
      changePassword(auth, new Headers(), {
        currentPassword: PASSWORD,
        newPassword: NEW_PASSWORD,
      }),
    ).rejects.toThrow(UnauthenticatedError);
  });

  // --- Révocation individuelle de session ------------------------------------

  it("liste les sessions de l'utilisateur courant, et seulement les siennes", async () => {
    await signInHeaders(auth, { phone: OTHER_PHONE, password: PASSWORD });

    const headers = await signInHeaders(auth, { phone: PHONE, password: PASSWORD });
    await signInHeaders(auth, { phone: PHONE, password: PASSWORD });

    const sessions = await listActiveSessions(auth, headers);

    expect(sessions).toHaveLength(2);
  });

  it('révoque une session précise sans toucher à la session courante', async () => {
    const other = await signInHeaders(auth, { phone: PHONE, password: PASSWORD });
    const current = await signInHeaders(auth, { phone: PHONE, password: PASSWORD });

    const otherSession = await resolveSession(auth, other);
    expect(otherSession).not.toBeNull();

    await revokeSession(auth, current, otherSession?.token ?? '');

    expect(await resolveSession(auth, other)).toBeNull();
    expect(await resolveSession(auth, current)).not.toBeNull();
  });

  it('refuse une révocation sans session', async () => {
    await expect(revokeSession(auth, new Headers(), 'un-jeton')).rejects.toThrow(
      UnauthenticatedError,
    );
  });
});
