import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { ResourceOutOfScopeError } from '../../src/lib/authorization/service';
import { hashInvitationToken } from '../../src/modules/invitations';
import { InvitationNotOpenError } from '../../src/modules/invitations/errors';
import {
  acceptManagerInvitation,
  getManagerInvitation,
  inviteManager,
  previewInvitation,
  resendManagerInvitation,
  revokeManagerInvitation,
} from '../../src/modules/managers/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  DAY_MS,
  NOW,
  OPTIONS,
  addAccess,
  addProperty,
  addUser,
  at,
  contextOf,
  freshPhone,
  passwordHasher,
  readInvitation,
} from '../helpers/managers';

/**
 * MVP-BACKLOG-025 et 027 : renvoi et révocation d'une invitation.
 *
 * Le renvoi est aussi, au MVP, le mécanisme de récupération d'un lien perdu ou
 * périmé (ADR-008). Les refus passent d'abord : un lien d'une autre organisation,
 * ou d'un autre rôle, doit se comporter comme un lien inexistant.
 */
describe("Renvoi et révocation d'une invitation de gestionnaire", () => {
  let harness: TestDatabase;
  let owner: Awaited<ReturnType<typeof contextOf>>;
  let manager: Awaited<ReturnType<typeof contextOf>>;
  let otherOwner: Awaited<ReturnType<typeof contextOf>>;
  let hashPassword: (password: string) => Promise<string>;
  let propertyOne: string;

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    hashPassword = passwordHasher(harness);
    owner = await contextOf(harness, SEED_IDS.ownerA);
    manager = await contextOf(harness, SEED_IDS.managerA);
    otherOwner = await contextOf(harness, SEED_IDS.ownerB);

    propertyOne = await addProperty(harness, 'Résidence Kipé');
  });

  afterAll(async () => {
    await harness.close();
  });

  const failureOf = (promise: Promise<unknown>) => promise.catch((error: unknown) => error);

  async function invite(options = OPTIONS) {
    return inviteManager(
      harness.db,
      owner,
      {
        organizationId: SEED_IDS.organizationA,
        name: 'Ibrahima Sow',
        phone: freshPhone(),
        email: '',
        propertyIds: [propertyOne],
      },
      options,
    );
  }

  describe('Refus', () => {
    it('refuse un gestionnaire, pour renvoyer comme pour révoquer', async () => {
      const issued = await invite();

      expect(
        await failureOf(
          resendManagerInvitation(harness.db, manager, issued.invitation.id, OPTIONS),
        ),
      ).toBeInstanceOf(ResourceOutOfScopeError);
      expect(
        await failureOf(
          revokeManagerInvitation(harness.db, manager, issued.invitation.id, OPTIONS),
        ),
      ).toBeInstanceOf(ResourceOutOfScopeError);
    });

    it("refuse le propriétaire d'une autre organisation, comme une invitation inexistante", async () => {
      const issued = await invite();

      expect(
        await failureOf(
          resendManagerInvitation(harness.db, otherOwner, issued.invitation.id, OPTIONS),
        ),
      ).toBeInstanceOf(ResourceOutOfScopeError);
      expect(
        await failureOf(
          revokeManagerInvitation(harness.db, otherOwner, issued.invitation.id, OPTIONS),
        ),
      ).toBeInstanceOf(ResourceOutOfScopeError);
      expect(
        await failureOf(
          getManagerInvitation(harness.db, otherOwner, issued.invitation.id, OPTIONS),
        ),
      ).toBeInstanceOf(ResourceOutOfScopeError);
    });

    it("n'a modifié ni le lien ni l'état quand l'autorisation a refusé", async () => {
      const issued = await invite();

      await failureOf(
        resendManagerInvitation(harness.db, otherOwner, issued.invitation.id, OPTIONS),
      );
      await failureOf(
        revokeManagerInvitation(harness.db, otherOwner, issued.invitation.id, OPTIONS),
      );

      const row = await readInvitation(harness, issued.invitation.id);

      expect(row.status).toBe('PENDING');
      expect(row.tokenHash).toBe(hashInvitationToken(issued.token));
    });

    /** Un identifiant mal formé, inconnu ou étranger reçoit la MÊME réponse. */
    it('répond de la même façon à un identifiant mal formé, inconnu ou étranger', async () => {
      const issued = await invite();

      const failures = await Promise.all([
        failureOf(resendManagerInvitation(harness.db, owner, 'pas-un-uuid', OPTIONS)),
        failureOf(
          resendManagerInvitation(
            harness.db,
            owner,
            '99999999-9999-4999-8999-999999999999',
            OPTIONS,
          ),
        ),
        failureOf(resendManagerInvitation(harness.db, otherOwner, issued.invitation.id, OPTIONS)),
      ]);

      for (const failure of failures) expect(failure).toBeInstanceOf(ResourceOutOfScopeError);

      expect(new Set(failures.map((failure) => (failure as Error).message)).size).toBe(1);
    });

    it('traite une invitation de locataire comme inexistante', async () => {
      const issued = await invite();

      await harness.db
        .update(harness.schema.invitations)
        .set({ role: 'TENANT' })
        .where(eq(harness.schema.invitations.id, issued.invitation.id));

      expect(
        await failureOf(resendManagerInvitation(harness.db, owner, issued.invitation.id, OPTIONS)),
      ).toBeInstanceOf(ResourceOutOfScopeError);
    });
  });

  describe('Renvoi', () => {
    it('régénère le jeton dans la même invitation', async () => {
      const issued = await invite();
      const resent = await resendManagerInvitation(
        harness.db,
        owner,
        issued.invitation.id,
        OPTIONS,
      );

      expect(resent.invitation.id).toBe(issued.invitation.id);
      expect(resent.token).not.toBe(issued.token);
      expect(resent.link).toBe(`https://immo.test/invitation/${resent.token}`);
    });

    it("invalide l'ancien lien dès que le nouveau est émis (BR-013)", async () => {
      const issued = await invite();
      const resent = await resendManagerInvitation(
        harness.db,
        owner,
        issued.invitation.id,
        OPTIONS,
      );

      expect(
        await failureOf(previewInvitation(harness.db, { token: issued.token }, OPTIONS)),
      ).toBeDefined();
      await expect(
        previewInvitation(harness.db, { token: resent.token }, OPTIONS),
      ).resolves.toBeDefined();

      const row = await readInvitation(harness, issued.invitation.id);

      expect(row.tokenHash).toBe(hashInvitationToken(resent.token));
      expect(row.tokenHash).not.toBe(hashInvitationToken(issued.token));
    });

    it('fait repartir la durée de validité de zéro', async () => {
      const issued = await invite();
      const later = { ...OPTIONS, now: at(3 * DAY_MS) };
      const resent = await resendManagerInvitation(harness.db, owner, issued.invitation.id, later);

      expect(resent.invitation.issuedAt.getTime()).toBe(NOW.getTime() + 3 * DAY_MS);
      expect(resent.invitation.expiresAt.getTime()).toBe(NOW.getTime() + 10 * DAY_MS);
    });

    /** C'est précisément l'usage du renvoi : récupérer un lien périmé. */
    it('rouvre une invitation expirée', async () => {
      const issued = await invite();
      const later = { ...OPTIONS, now: at(8 * DAY_MS) };

      expect(
        (await getManagerInvitation(harness.db, owner, issued.invitation.id, later)).status,
      ).toBe('EXPIRED');

      const resent = await resendManagerInvitation(harness.db, owner, issued.invitation.id, later);

      expect(resent.invitation.status).toBe('PENDING');

      const result = await acceptManagerInvitation(
        harness.db,
        { hashPassword },
        { token: resent.token, password: 'mot-de-passe-solide-2026' },
        later,
      );

      expect(result.activatedAccount).toBe(true);
    });

    it('refuse une invitation déjà acceptée', async () => {
      const issued = await invite();

      await acceptManagerInvitation(
        harness.db,
        { hashPassword },
        { token: issued.token, password: 'mot-de-passe-solide-2026' },
        OPTIONS,
      );

      const failure = await failureOf(
        resendManagerInvitation(harness.db, owner, issued.invitation.id, OPTIONS),
      );

      expect(failure).toBeInstanceOf(InvitationNotOpenError);
      expect((failure as InvitationNotOpenError).reason).toBe('accepted');
    });

    it('refuse une invitation révoquée', async () => {
      const issued = await invite();

      await revokeManagerInvitation(harness.db, owner, issued.invitation.id, OPTIONS);

      const failure = await failureOf(
        resendManagerInvitation(harness.db, owner, issued.invitation.id, OPTIONS),
      );

      expect((failure as InvitationNotOpenError).reason).toBe('revoked');
    });

    it('refuse une invitation remplacée par une plus récente', async () => {
      const phone = freshPhone();
      const input = {
        organizationId: SEED_IDS.organizationA,
        name: 'Ibrahima Sow',
        phone,
        email: '',
        propertyIds: [propertyOne],
      };
      const first = await inviteManager(harness.db, owner, input, OPTIONS);

      await inviteManager(harness.db, owner, input, { ...OPTIONS, now: at(8 * DAY_MS) });

      const failure = await failureOf(
        resendManagerInvitation(harness.db, owner, first.invitation.id, OPTIONS),
      );

      expect((failure as InvitationNotOpenError).reason).toBe('superseded');
    });
  });

  describe('Révocation', () => {
    it('rend le lien inutilisable aussitôt', async () => {
      const issued = await invite();
      const revoked = await revokeManagerInvitation(
        harness.db,
        owner,
        issued.invitation.id,
        OPTIONS,
      );

      expect(revoked.status).toBe('REVOKED');
      expect(
        await failureOf(previewInvitation(harness.db, { token: issued.token }, OPTIONS)),
      ).toBeDefined();
      expect(
        await failureOf(
          acceptManagerInvitation(
            harness.db,
            { hashPassword },
            { token: issued.token, password: 'mot-de-passe-solide-2026' },
            OPTIONS,
          ),
        ),
      ).toBeDefined();
    });

    it('enregistre la date de révocation', async () => {
      const issued = await invite();

      await revokeManagerInvitation(harness.db, owner, issued.invitation.id, OPTIONS);

      const row = await readInvitation(harness, issued.invitation.id);

      expect(row.status).toBe('REVOKED');
      expect(row.revokedAt?.getTime()).toBe(NOW.getTime());
    });

    it('ne donne aucun accès à la personne invitée', async () => {
      const issued = await invite();

      await revokeManagerInvitation(harness.db, owner, issued.invitation.id, OPTIONS);

      const user = await harness.db.query.users.findFirst({
        where: (users, { eq }) => eq(users.phone, issued.invitation.phone ?? ''),
      });
      const context = await contextOf(harness, user?.id ?? '');

      expect(context.memberships).toHaveLength(0);
    });

    it('refuse une invitation déjà acceptée : c est l accès qu il faut révoquer', async () => {
      const issued = await invite();

      await acceptManagerInvitation(
        harness.db,
        { hashPassword },
        { token: issued.token, password: 'mot-de-passe-solide-2026' },
        OPTIONS,
      );

      const failure = await failureOf(
        revokeManagerInvitation(harness.db, owner, issued.invitation.id, OPTIONS),
      );

      expect((failure as InvitationNotOpenError).reason).toBe('accepted');
    });

    it('refuse une seconde révocation, plutôt que de feindre un succès', async () => {
      const issued = await invite();

      await revokeManagerInvitation(harness.db, owner, issued.invitation.id, OPTIONS);

      const failure = await failureOf(
        revokeManagerInvitation(harness.db, owner, issued.invitation.id, OPTIONS),
      );

      expect((failure as InvitationNotOpenError).reason).toBe('revoked');
    });

    it('permet de réinviter la personne après révocation', async () => {
      const user = await addUser(harness);
      const input = {
        organizationId: SEED_IDS.organizationA,
        name: 'Ibrahima Sow',
        phone: user.phone,
        email: '',
        propertyIds: [propertyOne],
      };
      const first = await inviteManager(harness.db, owner, input, OPTIONS);

      await revokeManagerInvitation(harness.db, owner, first.invitation.id, OPTIONS);

      const second = await inviteManager(harness.db, owner, input, OPTIONS);

      expect(second.invitation.id).not.toBe(first.invitation.id);
      expect(second.invitation.status).toBe('PENDING');
    });
  });

  describe('Consultation', () => {
    it("reflète l'expiration sans qu'aucune tâche n'ait tourné", async () => {
      const issued = await invite();

      expect(
        (await getManagerInvitation(harness.db, owner, issued.invitation.id, OPTIONS)).status,
      ).toBe('PENDING');
      expect(
        (
          await getManagerInvitation(harness.db, owner, issued.invitation.id, {
            ...OPTIONS,
            now: at(8 * DAY_MS),
          })
        ).status,
      ).toBe('EXPIRED');
      // La base n'a pas été modifiée : l'expiration est dérivée, jamais écrite par une lecture.
      expect((await readInvitation(harness, issued.invitation.id)).status).toBe('PENDING');
    });

    it('ne livre pas le lien : la base ne peut pas le restituer', async () => {
      const issued = await invite();
      const view = await getManagerInvitation(harness.db, owner, issued.invitation.id, OPTIONS);
      const serialized = JSON.stringify(view);

      expect(serialized).not.toContain(issued.token);
      expect(serialized).not.toContain('link');
    });

    it("refuse un compte manager d'une autre organisation même détenant l'identifiant", async () => {
      const issued = await invite();
      const intruder = await addUser(harness);

      await addAccess(harness, {
        userId: intruder.id,
        role: 'OWNER',
        organizationId: SEED_IDS.organizationB,
      });

      const context = await contextOf(harness, intruder.id);

      expect(
        await failureOf(getManagerInvitation(harness.db, context, issued.invitation.id, OPTIONS)),
      ).toBeInstanceOf(ResourceOutOfScopeError);
    });
  });
});
