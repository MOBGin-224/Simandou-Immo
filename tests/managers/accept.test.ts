import { count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { definePassword } from '../../src/lib/auth/session';
import { can } from '../../src/lib/authorization/service';
import {
  InvitationInvalidError,
  InvitationLoginRequiredError,
  ManagerValidationError,
} from '../../src/modules/managers/errors';
import { claimInvitation } from '../../src/modules/managers/repository';
import {
  acceptManagerInvitation,
  inviteManager,
  previewInvitation,
  resendManagerInvitation,
  revokeManagerInvitation,
} from '../../src/modules/managers/service';
import { createTestAuth, signInHeaders } from '../helpers/auth';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  DAY_MS,
  NOW,
  OPTIONS,
  activeScopeOf,
  addAccess,
  addProperty,
  addScope,
  addUser,
  at,
  contextOf,
  freshPhone,
  passwordHasher,
  readInvitation,
  readManagerAccess,
} from '../helpers/managers';

/**
 * MVP-BACKLOG-025 et 027 : acceptation d'une invitation, activation du compte.
 *
 * C'est la partie la plus sensible du lot : un lien d'invitation est un secret de
 * fait qui crée un accès (ADR-008). Les tests portent donc d'abord sur ce que le
 * lien NE doit PAS permettre, puis sur ce qu'il accorde.
 *
 * Authentification réelle : une activation réussie est prouvée par une connexion
 * effective avec le mot de passe défini, pas par la lecture d'une colonne.
 */
describe("Acceptation d'une invitation de gestionnaire", () => {
  let harness: TestDatabase;
  let auth: ReturnType<typeof createTestAuth>;
  let owner: Awaited<ReturnType<typeof contextOf>>;
  let hashPassword: (password: string) => Promise<string>;

  let propertyOne: string;
  let propertyTwo: string;
  let propertyThree: string;

  const PASSWORD = 'mot-de-passe-solide-2026';

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    auth = createTestAuth(harness.db);
    hashPassword = passwordHasher(harness);
    owner = await contextOf(harness, SEED_IDS.ownerA);

    propertyOne = await addProperty(harness, 'Résidence Kipé');
    propertyTwo = await addProperty(harness, 'Résidence Ratoma');
    propertyThree = await addProperty(harness, 'Résidence Matoto');
  });

  afterAll(async () => {
    await harness.close();
  });

  const failureOf = (promise: Promise<unknown>) => promise.catch((error: unknown) => error);

  /** Invite une personne et renvoie ce qu'il faut pour accepter. */
  async function invite(
    overrides: { phone?: string; propertyIds?: string[]; name?: string } = {},
    options = OPTIONS,
  ) {
    const phone = overrides.phone ?? freshPhone();
    const issued = await inviteManager(
      harness.db,
      owner,
      {
        organizationId: SEED_IDS.organizationA,
        name: overrides.name ?? 'Ibrahima Sow',
        phone,
        email: '',
        propertyIds: overrides.propertyIds ?? [propertyOne],
      },
      options,
    );

    return { ...issued, phone };
  }

  const accept = (
    token: string,
    extra: { password?: unknown; sessionUserId?: string | null } = {},
    options = OPTIONS,
  ) =>
    acceptManagerInvitation(
      harness.db,
      { hashPassword },
      { token, password: PASSWORD, ...extra },
      options,
    );

  const userByPhone = async (phone: string) => {
    const [row] = await harness.db
      .select()
      .from(harness.schema.users)
      .where(eq(harness.schema.users.phone, phone));

    return row;
  };

  const credentialCount = async (userId: string) => {
    const [row] = await harness.db
      .select({ total: count() })
      .from(harness.schema.accounts)
      .where(eq(harness.schema.accounts.userId, userId));

    return row?.total ?? 0;
  };

  describe('Un lien inutilisable répond toujours la même chose (ADR-008)', () => {
    /**
     * Le message ne doit RIEN apprendre : ni qu'un jeton a existé, ni qu'il a
     * servi, ni qu'on l'a retiré.
     */
    it('donne le même message pour un lien inconnu, mal formé, expiré, révoqué ou consommé', async () => {
      const expired = await invite();
      const revoked = await invite();
      const consumed = await invite();

      await revokeManagerInvitation(harness.db, owner, revoked.invitation.id, OPTIONS);
      await accept(consumed.token);

      const attempts = await Promise.all([
        failureOf(accept('x'.repeat(43))),
        failureOf(accept('trop-court')),
        failureOf(accept('')),
        failureOf(accept(expired.token, {}, { ...OPTIONS, now: at(8 * DAY_MS) })),
        failureOf(accept(revoked.token)),
        failureOf(accept(consumed.token)),
      ]);

      for (const attempt of attempts) {
        expect(attempt).toBeInstanceOf(InvitationInvalidError);
      }

      expect(new Set(attempts.map((attempt) => (attempt as Error).message)).size).toBe(1);
    });

    it("traite l'instant exact d'expiration comme déjà expiré", async () => {
      const issued = await invite();
      const failure = await failureOf(
        accept(issued.token, {}, { ...OPTIONS, now: issued.invitation.expiresAt }),
      );

      expect(failure).toBeInstanceOf(InvitationInvalidError);
    });

    it("accepte encore le lien une milliseconde avant l'expiration", async () => {
      const issued = await invite();
      const result = await accept(
        issued.token,
        {},
        { ...OPTIONS, now: new Date(issued.invitation.expiresAt.getTime() - 1) },
      );

      expect(result.activatedAccount).toBe(true);
    });

    /**
     * L'expiration est aussi contrôlée DANS la requête qui consomme le lien : aucun
     * intervalle ne sépare le contrôle de l'usage (DEC-045).
     */
    it('refuse en base la réclamation d un lien périmé', async () => {
      const issued = await invite();

      const claimed = await claimInvitation(
        harness.db,
        issued.invitation.id,
        issued.invitation.expiresAt,
      );

      expect(claimed).toBeUndefined();
      expect((await readInvitation(harness, issued.invitation.id)).status).toBe('PENDING');
    });

    it('refuse un lien d une invitation de locataire', async () => {
      const issued = await invite();

      await harness.db
        .update(harness.schema.invitations)
        .set({ role: 'TENANT' })
        .where(eq(harness.schema.invitations.id, issued.invitation.id));

      expect(await failureOf(accept(issued.token))).toBeInstanceOf(InvitationInvalidError);
    });

    it('refuse un lien dont le compte est devenu suspendu', async () => {
      const issued = await invite();

      await harness.db
        .update(harness.schema.users)
        .set({ status: 'SUSPENDED' })
        .where(eq(harness.schema.users.phone, issued.phone));

      expect(await failureOf(accept(issued.token))).toBeInstanceOf(InvitationInvalidError);
    });
  });

  describe('Usage unique', () => {
    it('refuse un second usage du même lien', async () => {
      const issued = await invite();

      await accept(issued.token);

      expect(await failureOf(accept(issued.token))).toBeInstanceOf(InvitationInvalidError);
    });

    it('marque l invitation comme acceptée, avec sa date', async () => {
      const issued = await invite();

      await accept(issued.token);

      const row = await readInvitation(harness, issued.invitation.id);

      expect(row.status).toBe('ACCEPTED');
      expect(row.acceptedAt?.getTime()).toBe(NOW.getTime());
    });

    /** Un lien renvoyé remplace l'ancien : l'ancien ne doit plus rien ouvrir (BR-013). */
    it('refuse l ancien lien une fois l invitation renvoyée', async () => {
      const issued = await invite();
      const resent = await resendManagerInvitation(
        harness.db,
        owner,
        issued.invitation.id,
        OPTIONS,
      );

      expect(await failureOf(accept(issued.token))).toBeInstanceOf(InvitationInvalidError);

      const result = await accept(resent.token);

      expect(result.activatedAccount).toBe(true);
    });
  });

  describe('Activation d un compte en attente', () => {
    it("crée l'accès, attribue le périmètre et active le compte", async () => {
      const issued = await invite({ propertyIds: [propertyOne, propertyTwo] });
      const result = await accept(issued.token);

      const user = await userByPhone(issued.phone);
      const access = await readManagerAccess(harness, result.userId);

      expect(user?.status).toBe('ACTIVE');
      expect(access?.status).toBe('ACTIVE');
      expect(access?.role).toBe('MANAGER');
      expect(access?.id).toBe(result.accessId);
      expect(await activeScopeOf(harness, result.accessId)).toEqual(
        [propertyOne, propertyTwo].sort(),
      );
      expect(result.activatedAccount).toBe(true);
    });

    /** Preuve d'activation : une connexion effective, pas une colonne lue. */
    it('permet de se connecter avec le mot de passe défini', async () => {
      const issued = await invite();

      await accept(issued.token);

      const headers = await signInHeaders(auth, { phone: issued.phone, password: PASSWORD });

      expect(headers.get('cookie')).toBeTruthy();
    });

    it('ne permet pas de se connecter avec un autre mot de passe', async () => {
      const issued = await invite();

      await accept(issued.token);

      await expect(
        signInHeaders(auth, { phone: issued.phone, password: 'un-autre-mot-de-passe-1' }),
      ).rejects.toThrow();
    });

    it('ne permet aucune connexion AVANT l acceptation', async () => {
      const issued = await invite();

      await expect(
        signInHeaders(auth, { phone: issued.phone, password: PASSWORD }),
      ).rejects.toThrow();
    });

    it('donne exactement le périmètre invité, rien de plus', async () => {
      const issued = await invite({ propertyIds: [propertyOne] });
      const result = await accept(issued.token);
      const context = await contextOf(harness, result.userId);

      const organizationId = SEED_IDS.organizationA;

      expect(can(context, 'property.read', { organizationId, propertyId: propertyOne })).toBe(true);
      expect(can(context, 'property.read', { organizationId, propertyId: propertyTwo })).toBe(
        false,
      );
      expect(
        can(context, 'property.read', {
          organizationId: SEED_IDS.organizationB,
          propertyId: SEED_IDS.propertyB,
        }),
      ).toBe(false);
    });

    /** DEC-025 : le gestionnaire reçoit les capacités de son rôle, pas celles du propriétaire. */
    it('ne donne aucune permission de gestion des gestionnaires', async () => {
      const issued = await invite();
      const result = await accept(issued.token);
      const context = await contextOf(harness, result.userId);
      const resource = { organizationId: SEED_IDS.organizationA, propertyId: propertyOne };

      expect(can(context, 'manager.invite', resource)).toBe(false);
      expect(can(context, 'manager.revoke', resource)).toBe(false);
      expect(can(context, 'property.create', resource)).toBe(false);
    });

    it('refuse sans mot de passe, et laisse l invitation intacte', async () => {
      const issued = await invite();
      const failure = await failureOf(accept(issued.token, { password: undefined }));

      expect(failure).toBeInstanceOf(ManagerValidationError);
      expect((failure as ManagerValidationError).fieldErrors.password).toBeDefined();
      expect((await readInvitation(harness, issued.invitation.id)).status).toBe('PENDING');
    });

    it('refuse un mot de passe trop court, sans rien écrire', async () => {
      const issued = await invite();
      const failure = await failureOf(accept(issued.token, { password: 'court' }));
      const user = await userByPhone(issued.phone);

      expect(failure).toBeInstanceOf(ManagerValidationError);
      expect((await readInvitation(harness, issued.invitation.id)).status).toBe('PENDING');
      expect(user?.status).toBe('PENDING_ACTIVATION');
      expect(await credentialCount(user?.id ?? '')).toBe(0);
      expect(await readManagerAccess(harness, user?.id ?? '')).toBeUndefined();
    });

    it('refuse un mot de passe démesuré', async () => {
      const issued = await invite();
      const failure = await failureOf(accept(issued.token, { password: 'a'.repeat(500) }));

      expect(failure).toBeInstanceOf(ManagerValidationError);
    });

    /**
     * ATOMICITÉ. Si une étape échoue APRÈS la réclamation du lien, rien ne doit
     * subsister : ni lien consommé, ni compte activé, ni mot de passe écrit.
     */
    it('annule tout quand une étape échoue après la réclamation du lien', async () => {
      const issued = await invite();
      const user = await userByPhone(issued.phone);

      // Une course simulée : l'accès est créé par ailleurs entre l'aperçu et l'acceptation.
      await addAccess(harness, { userId: user?.id ?? '', role: 'MANAGER' });

      const failure = await failureOf(accept(issued.token));

      expect(failure).toBeInstanceOf(InvitationInvalidError);
      expect((await readInvitation(harness, issued.invitation.id)).status).toBe('PENDING');
      expect((await userByPhone(issued.phone))?.status).toBe('PENDING_ACTIVATION');
      expect(await credentialCount(user?.id ?? '')).toBe(0);
    });
  });

  describe('Compte déjà actif : le lien ne touche jamais au mot de passe (DEC-041)', () => {
    const OLD_PASSWORD = 'ancien-mot-de-passe-1';

    async function activeInvitee() {
      const user = await addUser(harness, { fullName: 'Déjà inscrit', status: 'ACTIVE' });

      await definePassword(auth, { userId: user.id, password: OLD_PASSWORD });

      return { user, issued: await invite({ phone: user.phone }) };
    }

    it('exige une session de ce compte quand il n y en a aucune', async () => {
      const { issued } = await activeInvitee();
      const failure = await failureOf(accept(issued.token, { sessionUserId: null }));

      expect(failure).toBeInstanceOf(InvitationLoginRequiredError);
      expect((await readInvitation(harness, issued.invitation.id)).status).toBe('PENDING');
    });

    it('refuse une session d un AUTRE compte', async () => {
      const { issued } = await activeInvitee();
      const failure = await failureOf(accept(issued.token, { sessionUserId: SEED_IDS.ownerB }));

      expect(failure).toBeInstanceOf(InvitationLoginRequiredError);
      expect((await readInvitation(harness, issued.invitation.id)).status).toBe('PENDING');
    });

    it('accorde l accès sur présentation de la session du compte invité', async () => {
      const { user, issued } = await activeInvitee();
      const result = await accept(issued.token, { sessionUserId: user.id });

      expect(result.userId).toBe(user.id);
      expect(result.activatedAccount).toBe(false);
      expect(await activeScopeOf(harness, result.accessId)).toEqual([propertyOne]);
    });

    /**
     * LA règle. Même en présentant le bon lien ET la bonne session, et même en
     * fournissant un nouveau mot de passe, l'ancien reste le seul valable.
     */
    it("ne change JAMAIS le mot de passe d'un compte actif, même si on en fournit un", async () => {
      const { user, issued } = await activeInvitee();

      await accept(issued.token, { sessionUserId: user.id, password: 'nouveau-mot-de-passe-1' });

      await expect(
        signInHeaders(auth, { phone: user.phone, password: OLD_PASSWORD }),
      ).resolves.toBeDefined();
      await expect(
        signInHeaders(auth, { phone: user.phone, password: 'nouveau-mot-de-passe-1' }),
      ).rejects.toThrow();
    });

    it('ne change pas le mot de passe quand la session manque, malgré un mot de passe fourni', async () => {
      const { user, issued } = await activeInvitee();

      await failureOf(
        accept(issued.token, { sessionUserId: null, password: 'pirate-mot-de-passe-1' }),
      );

      await expect(
        signInHeaders(auth, { phone: user.phone, password: OLD_PASSWORD }),
      ).resolves.toBeDefined();
      await expect(
        signInHeaders(auth, { phone: user.phone, password: 'pirate-mot-de-passe-1' }),
      ).rejects.toThrow();
    });

    it('ne crée pas de second compte pour ce numéro', async () => {
      const { user, issued } = await activeInvitee();

      await accept(issued.token, { sessionUserId: user.id });

      const [row] = await harness.db
        .select({ total: count() })
        .from(harness.schema.users)
        .where(eq(harness.schema.users.phone, user.phone));

      expect(row?.total).toBe(1);
    });

    it("ne modifie pas le nom d'un compte actif", async () => {
      const { user, issued } = await activeInvitee();

      await accept(issued.token, { sessionUserId: user.id });

      expect((await userByPhone(user.phone))?.fullName).toBe('Déjà inscrit');
    });
  });

  describe("Immeubles archivés depuis l'invitation", () => {
    it('n attribue que les immeubles encore actifs', async () => {
      const kept = await addProperty(harness, 'Immeuble conservé');
      const dropped = await addProperty(harness, 'Immeuble archivé après coup');
      const issued = await invite({ propertyIds: [kept, dropped] });

      await harness.db
        .update(harness.schema.properties)
        .set({ archivedAt: NOW })
        .where(eq(harness.schema.properties.id, dropped));

      const result = await accept(issued.token);

      expect(await activeScopeOf(harness, result.accessId)).toEqual([kept]);
    });

    it('refuse le lien quand TOUS les immeubles sont archivés, et le laisse ouvert', async () => {
      const only = await addProperty(harness, 'Seul immeuble');
      const issued = await invite({ propertyIds: [only] });

      await harness.db
        .update(harness.schema.properties)
        .set({ archivedAt: NOW })
        .where(eq(harness.schema.properties.id, only));

      expect(await failureOf(accept(issued.token))).toBeInstanceOf(InvitationInvalidError);
      expect((await readInvitation(harness, issued.invitation.id)).status).toBe('PENDING');
    });
  });

  describe('Réinvitation d un gestionnaire révoqué (DEC-043)', () => {
    async function revokedManager() {
      const user = await addUser(harness, { fullName: 'Ancien gestionnaire' });
      const accessId = await addAccess(harness, {
        userId: user.id,
        role: 'MANAGER',
        status: 'REVOKED',
      });

      await definePassword(auth, { userId: user.id, password: 'mot-de-passe-existant-1' });

      // Deux immeubles de sa première période, tous deux révoqués avec son accès.
      const previousOne = await addScope(harness, accessId, propertyOne, { revoked: true });
      const previousTwo = await addScope(harness, accessId, propertyTwo, { revoked: true });

      return { user, accessId, previousOne, previousTwo };
    }

    it('réutilise la MÊME ligne d accès, sans second compte ni seconde ligne', async () => {
      const { user, accessId } = await revokedManager();
      const issued = await invite({ phone: user.phone, propertyIds: [propertyTwo] });
      const result = await accept(issued.token, { sessionUserId: user.id });

      expect(result.accessId).toBe(accessId);

      const accesses = await harness.db
        .select()
        .from(harness.schema.userAccess)
        .where(eq(harness.schema.userAccess.userId, user.id));

      expect(accesses).toHaveLength(1);
      expect(accesses[0]?.status).toBe('ACTIVE');
      expect(accesses[0]?.revokedAt).toBeNull();
    });

    it('attribue le périmètre de la NOUVELLE invitation, et laisse révoqué ce qu elle n attribue pas', async () => {
      const { user, accessId } = await revokedManager();
      const issued = await invite({ phone: user.phone, propertyIds: [propertyTwo, propertyThree] });

      await accept(issued.token, { sessionUserId: user.id });

      // propertyOne, de l'ancienne période, n'est pas dans la nouvelle liste.
      expect(await activeScopeOf(harness, accessId)).toEqual([propertyTwo, propertyThree].sort());
    });

    /**
     * Pas de modification rétroactive : la ligne de périmètre d'un immeuble déjà
     * attribué est RÉACTIVÉE, pas remplacée par une copie, et celle d'un immeuble
     * non attribué n'est pas touchée.
     */
    it('réactive la ligne de périmètre existante plutôt que d en créer une autre', async () => {
      const { user, accessId, previousOne, previousTwo } = await revokedManager();
      const issued = await invite({ phone: user.phone, propertyIds: [propertyTwo] });

      await accept(issued.token, { sessionUserId: user.id });

      const rows = await harness.db
        .select()
        .from(harness.schema.managerPropertyAccess)
        .where(eq(harness.schema.managerPropertyAccess.userAccessId, accessId));

      const byId = new Map(rows.map((row) => [row.id, row]));

      expect(rows).toHaveLength(2);
      expect(byId.get(previousTwo)?.revokedAt).toBeNull();
      expect(byId.get(previousOne)?.revokedAt).not.toBeNull();
    });

    it("conserve le compte et son mot de passe d'origine", async () => {
      const { user } = await revokedManager();
      const issued = await invite({ phone: user.phone });

      await accept(issued.token, { sessionUserId: user.id, password: 'mot-de-passe-pirate-1' });

      await expect(
        signInHeaders(auth, { phone: user.phone, password: 'mot-de-passe-existant-1' }),
      ).resolves.toBeDefined();
    });

    it("rend l'accès effectif dans le contexte d'autorisation", async () => {
      const { user } = await revokedManager();

      expect((await contextOf(harness, user.id)).memberships).toHaveLength(0);

      const issued = await invite({ phone: user.phone, propertyIds: [propertyThree] });

      await accept(issued.token, { sessionUserId: user.id });

      const context = await contextOf(harness, user.id);

      expect(context.memberships).toHaveLength(1);
      expect(context.memberships[0]?.propertyIds).toEqual([propertyThree]);
    });
  });

  describe('Aperçu de l invitation (route publique)', () => {
    it("décrit l'invitation sans la consommer", async () => {
      const issued = await invite({
        propertyIds: [propertyOne, propertyTwo],
        name: 'Ibrahima Sow',
      });

      const preview = await previewInvitation(harness.db, { token: issued.token }, OPTIONS);

      expect(preview.organizationName).toBe('Patrimoine Camayenne');
      expect(preview.inviterName).toBe('Aïssatou Barry');
      expect(preview.inviteeName).toBe('Ibrahima Sow');
      expect(preview.phone).toBe(issued.phone);
      expect(preview.propertyNames.sort()).toEqual(['Résidence Kipé', 'Résidence Ratoma']);
      expect(preview.mode).toBe('DEFINE_PASSWORD');
      expect((await readInvitation(harness, issued.invitation.id)).status).toBe('PENDING');

      // Un second aperçu, et l'acceptation, fonctionnent encore.
      await previewInvitation(harness.db, { token: issued.token }, OPTIONS);
      expect((await accept(issued.token)).activatedAccount).toBe(true);
    });

    it('demande de se connecter à un compte actif sans session', async () => {
      const user = await addUser(harness);
      const issued = await invite({ phone: user.phone });

      const preview = await previewInvitation(harness.db, { token: issued.token }, OPTIONS);

      expect(preview.mode).toBe('SIGN_IN_REQUIRED');
      expect(preview.signedInAsOther).toBe(false);
    });

    it('signale une session ouverte avec un AUTRE compte', async () => {
      const user = await addUser(harness);
      const issued = await invite({ phone: user.phone });

      const preview = await previewInvitation(
        harness.db,
        { token: issued.token, sessionUserId: SEED_IDS.ownerB },
        OPTIONS,
      );

      expect(preview.mode).toBe('SIGN_IN_REQUIRED');
      expect(preview.signedInAsOther).toBe(true);
    });

    it('propose de confirmer quand la session est celle du compte invité', async () => {
      const user = await addUser(harness);
      const issued = await invite({ phone: user.phone });

      const preview = await previewInvitation(
        harness.db,
        { token: issued.token, sessionUserId: user.id },
        OPTIONS,
      );

      expect(preview.mode).toBe('CONFIRM');
    });

    it('répond à un lien inutilisable par la même erreur que l acceptation', async () => {
      const revoked = await invite();

      await revokeManagerInvitation(harness.db, owner, revoked.invitation.id, OPTIONS);

      const failures = await Promise.all([
        failureOf(previewInvitation(harness.db, { token: 'x'.repeat(43) }, OPTIONS)),
        failureOf(previewInvitation(harness.db, { token: revoked.token }, OPTIONS)),
        failureOf(previewInvitation(harness.db, { token: 'court' }, OPTIONS)),
      ]);

      for (const failure of failures) expect(failure).toBeInstanceOf(InvitationInvalidError);
    });

    it('ne livre aucun secret dans la vue', async () => {
      const issued = await invite();
      const preview = await previewInvitation(harness.db, { token: issued.token }, OPTIONS);
      const serialized = JSON.stringify(preview);

      expect(serialized).not.toContain(issued.token);
      expect(serialized).not.toContain('tokenHash');
      expect(serialized).not.toContain('password');
    });
  });
});
