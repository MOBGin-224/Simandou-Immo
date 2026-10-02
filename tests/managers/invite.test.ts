import { createHash } from 'node:crypto';

import { count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { ResourceOutOfScopeError } from '../../src/lib/authorization/service';
import {
  InvitationTargetUnavailableError,
  ManagerInvitationConflictError,
  ManagerValidationError,
} from '../../src/modules/managers/errors';
import { inviteManager } from '../../src/modules/managers/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  DAY_MS,
  NOW,
  OPTIONS,
  addAccess,
  addProperty,
  addScope,
  addUser,
  at,
  contextOf,
  freshPhone,
  readInvitation,
} from '../helpers/managers';

/**
 * MVP-BACKLOG-025 : invitation d'un gestionnaire.
 *
 * Contre une VRAIE base, avec la vraie migration : l'index d'unicité partiel, les
 * clés étrangères et les contraintes CHECK de `invitations` participent aux
 * règles testées, et des doublures les auraient ignorées.
 *
 * Les refus viennent d'abord (ADR-007) : une fonctionnalité non sécurisée ne fait
 * pas partie du MVP. Chaque test crée ses propres numéros et immeubles ; aucun ne
 * dépend de l'ordre.
 */
describe("Invitation d'un gestionnaire", () => {
  let harness: TestDatabase;
  let owner: Awaited<ReturnType<typeof contextOf>>;
  let manager: Awaited<ReturnType<typeof contextOf>>;
  let tenant: Awaited<ReturnType<typeof contextOf>>;
  let otherOwner: Awaited<ReturnType<typeof contextOf>>;

  let propertyOne: string;
  let propertyTwo: string;

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    const tenantUser = await addUser(harness, { fullName: 'Locataire de test' });
    await addAccess(harness, { userId: tenantUser.id, role: 'TENANT' });

    owner = await contextOf(harness, SEED_IDS.ownerA);
    manager = await contextOf(harness, SEED_IDS.managerA);
    otherOwner = await contextOf(harness, SEED_IDS.ownerB);
    tenant = await contextOf(harness, tenantUser.id);

    propertyOne = await addProperty(harness, 'Résidence Kipé');
    propertyTwo = await addProperty(harness, 'Résidence Dixinn Nord');
  });

  afterAll(async () => {
    await harness.close();
  });

  /** Entrée valide, que chaque test modifie sur un seul point. */
  const input = (overrides: Record<string, unknown> = {}) => ({
    organizationId: SEED_IDS.organizationA,
    name: 'Ibrahima Sow',
    phone: freshPhone(),
    email: '',
    propertyIds: [propertyOne],
    ...overrides,
  });

  const invite = (overrides: Record<string, unknown> = {}, context = owner) =>
    inviteManager(harness.db, context, input(overrides), OPTIONS);

  const failureOf = (promise: Promise<unknown>) => promise.catch((error: unknown) => error);

  const countUsersWithPhone = async (phone: string) => {
    const [row] = await harness.db
      .select({ total: count() })
      .from(harness.schema.users)
      .where(eq(harness.schema.users.phone, phone));

    return row?.total ?? 0;
  };

  describe('Refus', () => {
    /**
     * `manager.invite` est réservée au propriétaire (DEC-025). La ressource est de
     * niveau organisation : un gestionnaire n'en atteint aucune, et reçoit donc
     * « inexistant » et non « interdit » (ADR-007).
     */
    it('refuse un gestionnaire, comme une ressource inexistante', async () => {
      const failure = await failureOf(invite({}, manager));

      expect(failure).toBeInstanceOf(ResourceOutOfScopeError);
    });

    it('refuse un locataire', async () => {
      const failure = await failureOf(invite({}, tenant));

      expect(failure).toBeInstanceOf(ResourceOutOfScopeError);
    });

    it("refuse le propriétaire d'une AUTRE organisation, comme une ressource inexistante", async () => {
      const failure = await failureOf(invite({}, otherOwner));

      expect(failure).toBeInstanceOf(ResourceOutOfScopeError);
    });

    it('ne crée rien quand le refus vient de l autorisation', async () => {
      const phone = freshPhone();

      await failureOf(invite({ phone }, manager));

      expect(await countUsersWithPhone(phone)).toBe(0);
    });

    /**
     * Un immeuble d'une autre organisation et un immeuble qui n'existe pas
     * reçoivent le MÊME refus : les distinguer apprendrait à un propriétaire quels
     * identifiants désignent un immeuble ailleurs.
     */
    it("refuse un immeuble d'une autre organisation comme un immeuble inexistant", async () => {
      const foreign = await failureOf(invite({ propertyIds: [SEED_IDS.propertyB] }));
      const unknown = await failureOf(
        invite({ propertyIds: ['99999999-9999-4999-8999-999999999999'] }),
      );

      expect(foreign).toBeInstanceOf(ManagerValidationError);
      expect(unknown).toBeInstanceOf(ManagerValidationError);
      expect((foreign as ManagerValidationError).fieldErrors).toEqual(
        (unknown as ManagerValidationError).fieldErrors,
      );
    });

    it('refuse un immeuble archivé', async () => {
      const archived = await addProperty(harness, 'Immeuble archivé', { archived: true });
      const failure = await failureOf(invite({ propertyIds: [archived] }));

      expect(failure).toBeInstanceOf(ManagerValidationError);
      expect((failure as ManagerValidationError).fieldErrors.propertyIds).toBeDefined();
    });

    it("refuse l'ensemble quand UN seul immeuble est invalide", async () => {
      const phone = freshPhone();
      const failure = await failureOf(
        invite({ phone, propertyIds: [propertyOne, SEED_IDS.propertyB] }),
      );

      expect(failure).toBeInstanceOf(ManagerValidationError);
      // Rien n'a été créé : pas de profil préliminaire sans invitation.
      expect(await countUsersWithPhone(phone)).toBe(0);
    });

    it('refuse une invitation sans immeuble (DEC-042)', async () => {
      const failure = await failureOf(invite({ propertyIds: [] }));

      expect(failure).toBeInstanceOf(ManagerValidationError);
      expect((failure as ManagerValidationError).fieldErrors.propertyIds).toBeDefined();
    });

    it('refuse un numéro qui n est pas au format international', async () => {
      const failure = await failureOf(invite({ phone: '620 00 00 00' }));

      expect(failure).toBeInstanceOf(ManagerValidationError);
      expect((failure as ManagerValidationError).fieldErrors.phone).toBeDefined();
    });

    it('refuse un nom vide, en désignant le champ fautif', async () => {
      const failure = await failureOf(invite({ name: '   ' }));

      expect(failure).toBeInstanceOf(ManagerValidationError);
      expect((failure as ManagerValidationError).fieldErrors.name).toBeDefined();
    });

    it('refuse une organisation qui n est pas un identifiant', async () => {
      const failure = await failureOf(invite({ organizationId: 'pas-un-uuid' }));

      expect(failure).toBeInstanceOf(ManagerValidationError);
    });
  });

  describe('Création', () => {
    it('crée une invitation ouverte, valable le temps configuré', async () => {
      const issued = await invite();
      const row = await readInvitation(harness, issued.invitation.id);

      expect(row.status).toBe('PENDING');
      expect(row.role).toBe('MANAGER');
      expect(row.organizationId).toBe(SEED_IDS.organizationA);
      expect(row.invitedBy).toBe(SEED_IDS.ownerA);
      expect(row.issuedAt.getTime()).toBe(NOW.getTime());
      expect(row.expiresAt.getTime()).toBe(NOW.getTime() + 7 * DAY_MS);
    });

    /** DEC-045 : la durée vient de la configuration, ici fournie explicitement. */
    it('applique la durée de validité demandée', async () => {
      const issued = await inviteManager(harness.db, owner, input(), { ...OPTIONS, ttlDays: 3 });

      expect(issued.invitation.expiresAt.getTime()).toBe(NOW.getTime() + 3 * DAY_MS);
    });

    /**
     * SEC-INV-002 : la base ne conserve JAMAIS le jeton. Seul son hachage y est,
     * et le jeton renvoyé le reproduit.
     */
    it('ne stocke que le hachage du jeton, jamais le jeton', async () => {
      const issued = await invite();
      const row = await readInvitation(harness, issued.invitation.id);

      expect(row.tokenHash).toBe(createHash('sha256').update(issued.token).digest('hex'));
      expect(row.tokenHash).not.toBe(issued.token);
      expect(JSON.stringify(row)).not.toContain(issued.token);
    });

    it('renvoie un lien bâti sur l adresse du site', async () => {
      const issued = await invite();

      expect(issued.link).toBe(`https://immo.test/invitation/${issued.token}`);
    });

    it('émet des jetons différents à chaque invitation', async () => {
      const first = await invite();
      const second = await invite();

      expect(first.token).not.toBe(second.token);
    });

    it('ne renvoie jamais le hachage du jeton dans la vue', async () => {
      const issued = await invite();

      expect(JSON.stringify(issued.invitation)).not.toContain('tokenHash');
      expect(JSON.stringify(issued.invitation)).not.toContain(
        createHash('sha256').update(issued.token).digest('hex'),
      );
    });

    it('enregistre les immeubles du périmètre, sans les attribuer encore', async () => {
      const issued = await invite({ propertyIds: [propertyOne, propertyTwo] });

      const rows = await harness.db
        .select()
        .from(harness.schema.invitationProperties)
        .where(eq(harness.schema.invitationProperties.invitationId, issued.invitation.id));

      expect(rows.map((row) => row.propertyId).sort()).toEqual([propertyOne, propertyTwo].sort());

      // L'accès n'existe pas encore : il naît à l'acceptation (DEC-041).
      const accesses = await harness.db
        .select()
        .from(harness.schema.userAccess)
        .where(eq(harness.schema.userAccess.role, 'MANAGER'));
      const invitee = await harness.db
        .select({ id: harness.schema.users.id })
        .from(harness.schema.users)
        .where(eq(harness.schema.users.phone, issued.invitation.phone ?? ''));

      expect(accesses.some((access) => access.userId === invitee[0]?.id)).toBe(false);
    });

    it('retire les doublons de la liste des immeubles', async () => {
      const issued = await invite({ propertyIds: [propertyOne, propertyOne] });

      expect(issued.invitation.properties).toHaveLength(1);
    });

    it('normalise le numéro avant de le stocker', async () => {
      const issued = await invite({ phone: '+224 621 99 00 11' });

      expect(issued.invitation.phone).toBe('+224621990011');
    });

    it('conserve l email quand il est fourni, et accepte son absence', async () => {
      const withEmail = await invite({ email: 'ibrahima@example.com' });
      const without = await invite({ email: '' });

      expect(withEmail.invitation.email).toBe('ibrahima@example.com');
      expect(without.invitation.email).toBeNull();
    });
  });

  describe('Profil préliminaire et unicité du numéro (BR-009, DEC-041)', () => {
    it('crée un profil en attente d activation, sans accès', async () => {
      const phone = freshPhone();

      await invite({ phone });

      const [user] = await harness.db
        .select()
        .from(harness.schema.users)
        .where(eq(harness.schema.users.phone, phone));

      expect(user?.status).toBe('PENDING_ACTIVATION');
    });

    /**
     * Un numéro déjà associé à un utilisateur ACTIF ne crée JAMAIS un second
     * compte : c'est le même, réutilisé, et son nom n'est pas réécrit.
     */
    it('réutilise un compte actif sans le dupliquer ni le renommer', async () => {
      const issued = await invite({ phone: '+224620000003', name: 'Nom usurpé' });

      expect(await countUsersWithPhone('+224620000003')).toBe(1);

      const [user] = await harness.db
        .select()
        .from(harness.schema.users)
        .where(eq(harness.schema.users.phone, '+224620000003'));

      expect(user?.id).toBe(SEED_IDS.ownerB);
      expect(user?.fullName).toBe('Fatoumata Camara');
      expect(user?.status).toBe('ACTIVE');
      expect((await readInvitation(harness, issued.invitation.id)).targetUserId).toBe(
        SEED_IDS.ownerB,
      );
    });

    it('réutilise un profil en attente et met à jour son nom', async () => {
      const phone = freshPhone();

      await invite({ phone, name: 'Premier nom' });
      // Une invitation encore ouverte bloque la suivante : on la révoque d'abord
      // en la laissant expirer.
      await inviteManager(harness.db, owner, input({ phone, name: 'Nom corrigé' }), {
        ...OPTIONS,
        now: at(8 * DAY_MS),
      });

      expect(await countUsersWithPhone(phone)).toBe(1);

      const [user] = await harness.db
        .select()
        .from(harness.schema.users)
        .where(eq(harness.schema.users.phone, phone));

      expect(user?.fullName).toBe('Nom corrigé');
    });

    it('refuse un compte suspendu, sans dire pourquoi', async () => {
      const suspended = await addUser(harness, { status: 'SUSPENDED' });
      const failure = await failureOf(invite({ phone: suspended.phone }));

      expect(failure).toBeInstanceOf(InvitationTargetUnavailableError);
    });

    it('refuse un compte archivé, sans dire pourquoi', async () => {
      const archived = await addUser(harness, { archived: true });
      const failure = await failureOf(invite({ phone: archived.phone }));

      expect(failure).toBeInstanceOf(InvitationTargetUnavailableError);
    });

    it('refuse un email déjà porté par un autre compte, sans rien créer', async () => {
      const holder = await addUser(harness, { email: 'deja.pris@example.com' });
      const phone = freshPhone();
      const failure = await failureOf(invite({ phone, email: 'deja.pris@example.com' }));

      expect(holder.id).toBeDefined();
      expect(failure).toBeInstanceOf(ManagerValidationError);
      expect((failure as ManagerValidationError).fieldErrors.email).toBeDefined();
      expect(await countUsersWithPhone(phone)).toBe(0);
    });
  });

  describe('Doublons de rôle et d invitation', () => {
    it("refuse d'inviter le propriétaire de l'organisation", async () => {
      const failure = await failureOf(invite({ phone: '+224620000001' }));

      expect(failure).toBeInstanceOf(ManagerInvitationConflictError);
      expect((failure as ManagerInvitationConflictError).reason).toBe('already-owner');
    });

    it('refuse un gestionnaire actif', async () => {
      const failure = await failureOf(invite({ phone: '+224620000002' }));

      expect(failure).toBeInstanceOf(ManagerInvitationConflictError);
      expect((failure as ManagerInvitationConflictError).reason).toBe('already-manager');
    });

    it('refuse un gestionnaire suspendu', async () => {
      const user = await addUser(harness);

      await addAccess(harness, { userId: user.id, role: 'MANAGER', status: 'SUSPENDED' });

      const failure = await failureOf(invite({ phone: user.phone }));

      expect((failure as ManagerInvitationConflictError).reason).toBe('already-manager');
    });

    /** DEC-043 : un gestionnaire RÉVOQUÉ peut être réinvité. */
    it('accepte la réinvitation d un gestionnaire révoqué', async () => {
      const user = await addUser(harness);

      await addAccess(harness, { userId: user.id, role: 'MANAGER', status: 'REVOKED' });

      const issued = await invite({ phone: user.phone });

      expect(issued.invitation.status).toBe('PENDING');
    });

    it('accepte un locataire de l organisation comme futur gestionnaire', async () => {
      const user = await addUser(harness);

      await addAccess(harness, { userId: user.id, role: 'TENANT' });

      const issued = await invite({ phone: user.phone });

      expect(issued.invitation.status).toBe('PENDING');
    });

    it('refuse une seconde invitation tant que la première est valable', async () => {
      const phone = freshPhone();

      await invite({ phone });

      const failure = await failureOf(invite({ phone }));

      expect(failure).toBeInstanceOf(ManagerInvitationConflictError);
      expect((failure as ManagerInvitationConflictError).reason).toBe('invitation-open');
    });

    it('remplace une invitation périmée, que l index partiel compterait sinon comme ouverte', async () => {
      const phone = freshPhone();
      const first = await invite({ phone });

      const second = await inviteManager(harness.db, owner, input({ phone }), {
        ...OPTIONS,
        now: at(8 * DAY_MS),
      });

      expect(second.invitation.id).not.toBe(first.invitation.id);
      // La première est clôturée, pas supprimée : l'invitation garde sa trace.
      expect((await readInvitation(harness, first.invitation.id)).status).toBe('EXPIRED');
      expect((await readInvitation(harness, second.invitation.id)).status).toBe('PENDING');
    });

    it('autorise deux personnes différentes à être invitées en même temps', async () => {
      const first = await invite();
      const second = await invite();

      expect(first.invitation.status).toBe('PENDING');
      expect(second.invitation.status).toBe('PENDING');
    });

    it("n'est pas gênée par une invitation d'une autre organisation pour la même personne", async () => {
      const propertyOfB = SEED_IDS.propertyB;
      const person = await addUser(harness);

      const forB = await inviteManager(
        harness.db,
        otherOwner,
        {
          organizationId: SEED_IDS.organizationB,
          name: 'Personne',
          phone: person.phone,
          email: '',
          propertyIds: [propertyOfB],
        },
        OPTIONS,
      );
      const forA = await invite({ phone: person.phone });

      expect(forB.invitation.organizationId).toBe(SEED_IDS.organizationB);
      expect(forA.invitation.organizationId).toBe(SEED_IDS.organizationA);
    });
  });

  describe('Contraintes de base', () => {
    /**
     * Deux demandes simultanées passent chacune le pré-contrôle : c'est l'index
     * partiel qui arbitre. On l'éprouve directement, sans passer par le cas
     * d'usage, pour prouver que la règle est portée par la base.
     */
    it('empêche en base deux invitations ouvertes pour la même personne', async () => {
      const issued = await invite();
      const [row] = await harness.db
        .select()
        .from(harness.schema.invitations)
        .where(eq(harness.schema.invitations.id, issued.invitation.id));

      const duplicate = harness.db.insert(harness.schema.invitations).values({
        organizationId: row?.organizationId ?? '',
        invitedBy: SEED_IDS.ownerA,
        targetUserId: row?.targetUserId ?? '',
        role: 'MANAGER',
        contact: '+224600000000',
        tokenHash: 'a'.repeat(64),
        issuedAt: NOW,
        expiresAt: at(DAY_MS),
      });

      await expect(duplicate).rejects.toThrow();
    });

    it('un gestionnaire garde son périmètre inchangé tant qu aucune invitation n est acceptée', async () => {
      const user = await addUser(harness);
      const accessId = await addAccess(harness, { userId: user.id, role: 'MANAGER' });

      await addScope(harness, accessId, propertyOne);
      await invite({ phone: user.phone }).catch(() => undefined);

      const scopes = await harness.db
        .select()
        .from(harness.schema.managerPropertyAccess)
        .where(eq(harness.schema.managerPropertyAccess.userAccessId, accessId));

      expect(scopes).toHaveLength(1);
      expect(scopes[0]?.revokedAt).toBeNull();
    });
  });
});
