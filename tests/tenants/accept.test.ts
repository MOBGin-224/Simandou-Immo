import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { can } from '../../src/lib/authorization/service';
import {
  InvitationInvalidError,
  InvitationLoginRequiredError,
} from '../../src/modules/invitations/errors';
import { inviteManager, previewInvitation } from '../../src/modules/managers/service';
import { claimInvitation } from '../../src/modules/tenants/repository';
import { TenantValidationError } from '../../src/modules/tenants/errors';
import {
  acceptTenantInvitation,
  inviteTenant,
  previewTenantInvitation,
  revokeTenantInvitation,
} from '../../src/modules/tenants/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  DAY_MS,
  OPTIONS,
  addApartment,
  addProperty,
  addUser,
  at,
  contextOf,
  freshPhone,
  passwordHasher,
  readTenantAccess,
  scopeRowCount,
} from '../helpers/tenants';

/**
 * MVP-BACKLOG-030 : aperçu et acceptation d'une invitation de locataire
 * (parcours 9, DEC-046).
 *
 * Trois propriétés y sont éprouvées, et chacune correspond à une décision :
 *
 *   1. l'acceptation locataire ne copie AUCUN périmètre d'immeubles (DEC-046) ;
 *   2. un jeton de gestionnaire est INDISCERNABLE d'un jeton inconnu pour ce
 *      module, et réciproquement (ADR-008, DEC-046) ;
 *   3. un lien ne définit JAMAIS le mot de passe d'un compte déjà actif (DEC-041).
 */
describe("Acceptation d'une invitation de locataire", () => {
  let harness: TestDatabase;
  let owner: Awaited<ReturnType<typeof contextOf>>;
  let property: string;
  let apartment: string;
  let hashPassword: (password: string) => Promise<string>;

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    owner = await contextOf(harness, SEED_IDS.ownerA);
    property = await addProperty(harness, 'Résidence Camayenne Nord');
    apartment = await addApartment(harness, property, 'C01');
    hashPassword = passwordHasher(harness);
  });

  afterAll(async () => {
    await harness.close();
  });

  /** Invite une personne neuve et renvoie son invitation, son jeton et son compte. */
  const inviteSomeone = async (overrides: Record<string, unknown> = {}) => {
    const phone = freshPhone();
    const issued = await inviteTenant(
      harness.db,
      owner,
      { apartmentId: apartment, name: 'Aminata Bah', phone, email: '', ...overrides },
      OPTIONS,
    );

    return { issued, phone };
  };

  const accept = (token: string, input: Record<string, unknown> = {}) =>
    acceptTenantInvitation(harness.db, { hashPassword }, { token, ...input }, OPTIONS);

  const preview = (token: string, sessionUserId: string | null = null) =>
    previewTenantInvitation(harness.db, { token, sessionUserId }, OPTIONS);

  const failureOf = (promise: Promise<unknown>) => promise.catch((error: unknown) => error);

  describe('Aperçu', () => {
    it('montre le logement, son immeuble et ce qu il faut faire', async () => {
      const { issued, phone } = await inviteSomeone();
      const view = await preview(issued.token);

      expect(view.inviteeName).toBe('Aminata Bah');
      expect(view.apartmentLabel).toBe('C01');
      expect(view.propertyName).toBe('Résidence Camayenne Nord');
      expect(view.organizationName).toBe('Patrimoine Camayenne');
      expect(view.phone).toBe(phone);
      expect(view.mode).toBe('DEFINE_PASSWORD');
      expect(view.signedInAsOther).toBe(false);
    });

    /** Aucune donnée financière dans l'espace locataire du Lot 7 (DEC-046). */
    it("ne montre aucun montant : il n'en existe aucun avant le bail", async () => {
      const { issued } = await inviteSomeone();
      const view = await preview(issued.token);

      expect(JSON.stringify(view)).not.toMatch(/amount|currency|rent|loyer/i);
    });

    it('ne consomme pas l invitation', async () => {
      const { issued } = await inviteSomeone();

      await preview(issued.token);

      await expect(preview(issued.token)).resolves.toMatchObject({ mode: 'DEFINE_PASSWORD' });
    });

    it('refuse un jeton mal formé, inconnu, expiré ou révoqué de la même façon', async () => {
      const { issued: expiring } = await inviteSomeone();
      const { issued: revoked } = await inviteSomeone();

      await revokeTenantInvitation(harness.db, owner, revoked.invitation.id, OPTIONS);

      const malformed = await failureOf(preview('pas-un-jeton'));
      const unknown = await failureOf(preview('a'.repeat(64)));
      const expired = await failureOf(
        previewTenantInvitation(harness.db, { token: expiring.token }, { now: at(8 * DAY_MS) }),
      );
      const revokedFailure = await failureOf(preview(revoked.token));

      for (const error of [malformed, unknown, expired, revokedFailure]) {
        expect(error).toBeInstanceOf(InvitationInvalidError);
      }

      const messages = new Set(
        [malformed, unknown, expired, revokedFailure].map((error) => (error as Error).message),
      );

      expect(messages.size).toBe(1);
    });

    /**
     * Le filtre sur le rôle (DEC-046) : chaque module ne voit que ses propres
     * invitations, et le refus est le même qu'un jeton inconnu.
     */
    it("rend un jeton de GESTIONNAIRE indiscernable d'un jeton inconnu", async () => {
      const managerInvitation = await inviteManager(
        harness.db,
        owner,
        {
          organizationId: SEED_IDS.organizationA,
          name: 'Gestionnaire invité',
          phone: freshPhone(),
          email: '',
          propertyIds: [property],
        },
        OPTIONS,
      );

      const wrongRole = await failureOf(preview(managerInvitation.token));
      const unknown = await failureOf(preview('b'.repeat(64)));

      expect(wrongRole).toBeInstanceOf(InvitationInvalidError);
      expect((wrongRole as Error).message).toBe((unknown as Error).message);
    });

    it("rend un jeton de LOCATAIRE indiscernable d'un jeton inconnu pour le module Gestionnaires", async () => {
      const { issued } = await inviteSomeone();
      const error = await failureOf(
        previewInvitation(harness.db, { token: issued.token }, OPTIONS),
      );

      expect(error).toBeInstanceOf(InvitationInvalidError);
    });

    it('refuse un logement archivé depuis l émission', async () => {
      const temporary = await addApartment(harness, property, 'C90');
      const issued = await inviteTenant(
        harness.db,
        owner,
        { apartmentId: temporary, name: 'Sera archivé', phone: freshPhone(), email: '' },
        OPTIONS,
      );

      await harness.db
        .update(harness.schema.apartments)
        .set({ archivedAt: new Date() })
        .where(eq(harness.schema.apartments.id, temporary));

      await expect(preview(issued.token)).rejects.toBeInstanceOf(InvitationInvalidError);
    });
  });

  describe('Acceptation', () => {
    it('ouvre l espace locataire et active le compte', async () => {
      const { issued, phone } = await inviteSomeone();
      const accepted = await accept(issued.token, { password: 'mot-de-passe-solide' });

      expect(accepted.activatedAccount).toBe(true);
      expect(accepted.phone).toBe(phone);
      expect(accepted.organizationId).toBe(SEED_IDS.organizationA);

      const access = await readTenantAccess(harness, accepted.userId);

      expect(access?.status).toBe('ACTIVE');
      expect(access?.role).toBe('TENANT');
    });

    /** DEC-046 : aucun périmètre d'immeubles n'est copié à l'acceptation. */
    it("ne copie AUCUN périmètre d'immeubles", async () => {
      const { issued } = await inviteSomeone();
      const accepted = await accept(issued.token, { password: 'mot-de-passe-solide' });

      expect(await scopeRowCount(harness, accepted.accessId)).toBe(0);
    });

    /** Conséquence directe : un locataire n'atteint aucun immeuble (ADR-007). */
    it('ne donne accès à aucun immeuble, même celui de son logement', async () => {
      const { issued } = await inviteSomeone();
      const accepted = await accept(issued.token, { password: 'mot-de-passe-solide' });
      const context = await contextOf(harness, accepted.userId);

      expect(
        can(context, 'apartment.read', {
          organizationId: SEED_IDS.organizationA,
          propertyId: property,
        }),
      ).toBe(false);
    });

    it('donne accès à ses propres données, et seulement aux siennes', async () => {
      const { issued } = await inviteSomeone();
      const accepted = await accept(issued.token, { password: 'mot-de-passe-solide' });
      const context = await contextOf(harness, accepted.userId);

      expect(
        can(context, 'tenant.read', {
          organizationId: SEED_IDS.organizationA,
          ownerUserId: accepted.userId,
        }),
      ).toBe(true);

      expect(
        can(context, 'tenant.read', {
          organizationId: SEED_IDS.organizationA,
          ownerUserId: SEED_IDS.managerA,
        }),
      ).toBe(false);
    });

    it('ne porte pas tenant.revoke, pas même sur lui-même (DEC-047)', async () => {
      const { issued } = await inviteSomeone();
      const accepted = await accept(issued.token, { password: 'mot-de-passe-solide' });
      const context = await contextOf(harness, accepted.userId);

      expect(
        can(context, 'tenant.revoke', {
          organizationId: SEED_IDS.organizationA,
          ownerUserId: accepted.userId,
        }),
      ).toBe(false);
    });

    it('refuse un mot de passe trop court, sans consommer le lien', async () => {
      const { issued } = await inviteSomeone();
      const error = await failureOf(accept(issued.token, { password: 'court' }));

      expect(error).toBeInstanceOf(TenantValidationError);
      await expect(preview(issued.token)).resolves.toMatchObject({ mode: 'DEFINE_PASSWORD' });
    });

    it('consomme le lien : une seconde acceptation échoue', async () => {
      const { issued } = await inviteSomeone();

      await accept(issued.token, { password: 'mot-de-passe-solide' });

      await expect(
        accept(issued.token, { password: 'mot-de-passe-solide' }),
      ).rejects.toBeInstanceOf(InvitationInvalidError);
    });

    it('échoue sans rien écrire quand le lien a été réclamé entre-temps', async () => {
      const { issued } = await inviteSomeone();

      await claimInvitation(harness.db, issued.invitation.id, OPTIONS.now ?? new Date());

      await expect(
        accept(issued.token, { password: 'mot-de-passe-solide' }),
      ).rejects.toBeInstanceOf(InvitationInvalidError);
    });

    /** DEC-041 : un lien ne touche jamais le mot de passe d'un compte actif. */
    it('exige une session du compte invité quand le compte est déjà actif', async () => {
      const person = await addUser(harness, { status: 'ACTIVE' });
      const issued = await inviteTenant(
        harness.db,
        owner,
        { apartmentId: apartment, name: 'Déjà active', phone: person.phone, email: '' },
        OPTIONS,
      );

      await expect(
        accept(issued.token, { password: 'mot-de-passe-solide' }),
      ).rejects.toBeInstanceOf(InvitationLoginRequiredError);
    });

    it('accepte sans mot de passe quand le compte actif présente sa session', async () => {
      const person = await addUser(harness, { status: 'ACTIVE' });
      const issued = await inviteTenant(
        harness.db,
        owner,
        { apartmentId: apartment, name: 'Déjà active', phone: person.phone, email: '' },
        OPTIONS,
      );

      const accepted = await accept(issued.token, { sessionUserId: person.id });

      expect(accepted.activatedAccount).toBe(false);
      expect(accepted.userId).toBe(person.id);
    });

    it('réactive la ligne d accès d un locataire révoqué plutôt que d en créer une seconde', async () => {
      const { issued } = await inviteSomeone();
      const first = await accept(issued.token, { password: 'mot-de-passe-solide' });

      await harness.db
        .update(harness.schema.userAccess)
        .set({ status: 'REVOKED', revokedAt: new Date() })
        .where(eq(harness.schema.userAccess.id, first.accessId));

      const again = await inviteTenant(
        harness.db,
        owner,
        {
          apartmentId: apartment,
          name: 'Aminata Bah',
          phone: first.phone ?? '',
          email: '',
        },
        OPTIONS,
      );

      const second = await accept(again.token, { sessionUserId: first.userId });

      expect(second.accessId).toBe(first.accessId);

      const access = await readTenantAccess(harness, first.userId);

      expect(access?.status).toBe('ACTIVE');
      expect(access?.revokedAt).toBeNull();
    });
  });
});
