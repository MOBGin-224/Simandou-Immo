import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { ResourceOutOfScopeError } from '../../src/lib/authorization/service';
import { hashInvitationToken } from '../../src/modules/invitations';
import { InvitationNotOpenError } from '../../src/modules/invitations/errors';
import { inviteManager } from '../../src/modules/managers/service';
import {
  acceptTenantInvitation,
  getTenantInvitation,
  inviteTenant,
  previewTenantInvitation,
  resendTenantInvitation,
  revokeTenantInvitation,
} from '../../src/modules/tenants/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  DAY_MS,
  NOW,
  OPTIONS,
  addApartment,
  addProperty,
  addScope,
  at,
  contextOf,
  freshPhone,
  passwordHasher,
  readInvitation,
} from '../helpers/tenants';

/**
 * Vie d'une invitation de locataire : consultation, renvoi, révocation
 * (DEC-045, DEC-048, SEC-INV-005).
 *
 * Le renvoi est la seule façon de récupérer un lien, la base ne conservant que
 * le hachage du jeton (SEC-INV-002). La révocation suivie d'une réinvitation est
 * la seule façon de corriger un numéro mal saisi (DEC-048) : les deux parcours
 * sont donc éprouvés de bout en bout.
 */
describe("Vie d'une invitation de locataire", () => {
  let harness: TestDatabase;
  let owner: Awaited<ReturnType<typeof contextOf>>;
  let manager: Awaited<ReturnType<typeof contextOf>>;
  let otherOwner: Awaited<ReturnType<typeof contextOf>>;

  let inScopeProperty: string;
  let inScopeApartment: string;
  let outOfScopeApartment: string;
  let hashPassword: (password: string) => Promise<string>;

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    inScopeProperty = await addProperty(harness, 'Résidence Kipé');
    const outOfScopeProperty = await addProperty(harness, 'Résidence Dixinn Nord');

    await addScope(harness, SEED_IDS.accessManagerA, inScopeProperty);

    inScopeApartment = await addApartment(harness, inScopeProperty, 'K01');
    outOfScopeApartment = await addApartment(harness, outOfScopeProperty, 'D01');

    owner = await contextOf(harness, SEED_IDS.ownerA);
    manager = await contextOf(harness, SEED_IDS.managerA);
    otherOwner = await contextOf(harness, SEED_IDS.ownerB);
    hashPassword = passwordHasher(harness);
  });

  afterAll(async () => {
    await harness.close();
  });

  const inviteOn = (apartmentId = inScopeApartment, phone = freshPhone()) =>
    inviteTenant(
      harness.db,
      owner,
      { apartmentId, name: 'Invitée de test', phone, email: '' },
      OPTIONS,
    );

  const failureOf = (promise: Promise<unknown>) => promise.catch((error: unknown) => error);

  describe('Consultation', () => {
    it('porte le statut réel, le logement et les dates, mais jamais le lien', async () => {
      const issued = await inviteOn();
      const view = await getTenantInvitation(harness.db, owner, issued.invitation.id, OPTIONS);

      expect(view.status).toBe('PENDING');
      expect(view.apartment?.number).toBe('K01');
      expect(view.issuedAt.getTime()).toBe(NOW.getTime());
      expect(JSON.stringify(view)).not.toContain(issued.token);
      expect(JSON.stringify(view)).not.toMatch(/tokenHash|link/);
    });

    it("dérive EXPIRED de la date, sans l'écrire en base", async () => {
      const issued = await inviteOn();
      const view = await getTenantInvitation(harness.db, owner, issued.invitation.id, {
        ...OPTIONS,
        now: at(8 * DAY_MS),
      });

      expect(view.status).toBe('EXPIRED');
      expect((await readInvitation(harness, issued.invitation.id)).status).toBe('PENDING');
    });

    it('est accessible au gestionnaire dont le périmètre contient le logement', async () => {
      const issued = await inviteOn();

      await expect(
        getTenantInvitation(harness.db, manager, issued.invitation.id, OPTIONS),
      ).resolves.toMatchObject({ id: issued.invitation.id });
    });

    it('est inaccessible au gestionnaire quand le logement est hors de son périmètre', async () => {
      const issued = await inviteOn(outOfScopeApartment);

      await expect(
        getTenantInvitation(harness.db, manager, issued.invitation.id, OPTIONS),
      ).rejects.toBeInstanceOf(ResourceOutOfScopeError);
    });

    it("est inaccessible au propriétaire d'une autre organisation", async () => {
      const issued = await inviteOn();

      await expect(
        getTenantInvitation(harness.db, otherOwner, issued.invitation.id, OPTIONS),
      ).rejects.toBeInstanceOf(ResourceOutOfScopeError);
    });

    /** Le double identifiant de DEC-041, vérifié dans les deux sens. */
    it("refuse l'identifiant d'une invitation de GESTIONNAIRE", async () => {
      const managerInvitation = await inviteManager(
        harness.db,
        owner,
        {
          organizationId: SEED_IDS.organizationA,
          name: 'Gestionnaire invité',
          phone: freshPhone(),
          email: '',
          propertyIds: [inScopeProperty],
        },
        OPTIONS,
      );

      const wrongRole = await failureOf(
        getTenantInvitation(harness.db, owner, managerInvitation.invitation.id, OPTIONS),
      );
      const unknown = await failureOf(
        getTenantInvitation(harness.db, owner, '00000000-0000-4000-8000-000000000999', OPTIONS),
      );

      expect(wrongRole).toBeInstanceOf(ResourceOutOfScopeError);
      expect((wrongRole as Error).message).toBe((unknown as Error).message);
    });

    it('refuse un identifiant mal formé', async () => {
      await expect(
        getTenantInvitation(harness.db, owner, 'pas-un-uuid', OPTIONS),
      ).rejects.toBeInstanceOf(ResourceOutOfScopeError);
    });
  });

  describe('Renvoi (DEC-045)', () => {
    it("garde le même identifiant et invalide l'ancien lien aussitôt", async () => {
      const issued = await inviteOn();
      const resent = await resendTenantInvitation(harness.db, owner, issued.invitation.id, OPTIONS);

      expect(resent.invitation.id).toBe(issued.invitation.id);
      expect(resent.token).not.toBe(issued.token);

      const row = await readInvitation(harness, issued.invitation.id);

      expect(row.tokenHash).toBe(hashInvitationToken(resent.token));
      expect(row.tokenHash).not.toBe(hashInvitationToken(issued.token));
    });

    it('fait repartir la durée de validité de zéro', async () => {
      const issued = await inviteOn();
      const later = at(3 * DAY_MS);
      const resent = await resendTenantInvitation(harness.db, owner, issued.invitation.id, {
        ...OPTIONS,
        now: later,
      });

      expect(resent.invitation.expiresAt.getTime()).toBe(later.getTime() + 7 * DAY_MS);
    });

    it('renvoie une invitation EXPIRÉE : c est précisément son usage', async () => {
      const issued = await inviteOn();
      const resent = await resendTenantInvitation(harness.db, owner, issued.invitation.id, {
        ...OPTIONS,
        now: at(9 * DAY_MS),
      });

      expect(resent.invitation.status).toBe('PENDING');
    });

    it("rend le nouveau lien utilisable, et l'ancien inutilisable", async () => {
      const issued = await inviteOn();
      const resent = await resendTenantInvitation(harness.db, owner, issued.invitation.id, OPTIONS);

      await expect(
        previewTenantInvitation(harness.db, { token: resent.token }, OPTIONS),
      ).resolves.toMatchObject({ mode: 'DEFINE_PASSWORD' });

      await expect(
        previewTenantInvitation(harness.db, { token: issued.token }, OPTIONS),
      ).rejects.toThrow();
    });

    it('refuse de renvoyer une invitation acceptée', async () => {
      const issued = await inviteOn();

      await acceptTenantInvitation(
        harness.db,
        { hashPassword },
        { token: issued.token, password: 'mot-de-passe-solide' },
        OPTIONS,
      );

      const error = await failureOf(
        resendTenantInvitation(harness.db, owner, issued.invitation.id, OPTIONS),
      );

      expect(error).toBeInstanceOf(InvitationNotOpenError);
      expect((error as InvitationNotOpenError).reason).toBe('accepted');
    });

    it('refuse de renvoyer une invitation révoquée', async () => {
      const issued = await inviteOn();

      await revokeTenantInvitation(harness.db, owner, issued.invitation.id, OPTIONS);

      const error = await failureOf(
        resendTenantInvitation(harness.db, owner, issued.invitation.id, OPTIONS),
      );

      expect(error).toBeInstanceOf(InvitationNotOpenError);
      expect((error as InvitationNotOpenError).reason).toBe('revoked');
    });

    it('est permis au gestionnaire sur son périmètre', async () => {
      const issued = await inviteOn();

      await expect(
        resendTenantInvitation(harness.db, manager, issued.invitation.id, OPTIONS),
      ).resolves.toMatchObject({ invitation: { id: issued.invitation.id } });
    });
  });

  describe('Révocation (SEC-INV-005)', () => {
    it('rend le lien inutilisable immédiatement', async () => {
      const issued = await inviteOn();
      const view = await revokeTenantInvitation(harness.db, owner, issued.invitation.id, OPTIONS);

      expect(view.status).toBe('REVOKED');

      await expect(
        previewTenantInvitation(harness.db, { token: issued.token }, OPTIONS),
      ).rejects.toThrow();
    });

    it('ne supprime aucun compte', async () => {
      const phone = freshPhone();
      const issued = await inviteOn(inScopeApartment, phone);

      await revokeTenantInvitation(harness.db, owner, issued.invitation.id, OPTIONS);

      const [row] = await harness.db
        .select({ phone: harness.schema.users.phone })
        .from(harness.schema.users)
        .where(eq(harness.schema.users.phone, phone));

      expect(row?.phone).toBe(phone);
    });

    /** La correction d'un numéro mal saisi, telle que DEC-048 la prévoit. */
    it('permet de corriger un numéro mal saisi : révoquer, puis réinviter', async () => {
      const wrong = freshPhone();
      const right = freshPhone();
      const issued = await inviteOn(inScopeApartment, wrong);

      await revokeTenantInvitation(harness.db, owner, issued.invitation.id, OPTIONS);

      const corrected = await inviteOn(inScopeApartment, right);

      expect(corrected.invitation.phone).toBe(right);
      expect(corrected.invitation.id).not.toBe(issued.invitation.id);
    });

    it('refuse de révoquer une invitation déjà acceptée : c est l accès qu il faut révoquer', async () => {
      const issued = await inviteOn();

      await acceptTenantInvitation(
        harness.db,
        { hashPassword },
        { token: issued.token, password: 'mot-de-passe-solide' },
        OPTIONS,
      );

      const error = await failureOf(
        revokeTenantInvitation(harness.db, owner, issued.invitation.id, OPTIONS),
      );

      expect(error).toBeInstanceOf(InvitationNotOpenError);
      expect((error as InvitationNotOpenError).reason).toBe('accepted');
    });

    it('refuse une révocation déjà faite', async () => {
      const issued = await inviteOn();

      await revokeTenantInvitation(harness.db, owner, issued.invitation.id, OPTIONS);

      await expect(
        revokeTenantInvitation(harness.db, owner, issued.invitation.id, OPTIONS),
      ).rejects.toBeInstanceOf(InvitationNotOpenError);
    });

    it('est inaccessible au gestionnaire hors de son périmètre', async () => {
      const issued = await inviteOn(outOfScopeApartment);

      await expect(
        revokeTenantInvitation(harness.db, manager, issued.invitation.id, OPTIONS),
      ).rejects.toBeInstanceOf(ResourceOutOfScopeError);
    });
  });
});
