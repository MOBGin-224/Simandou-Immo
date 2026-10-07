import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import {
  PermissionDeniedError,
  ResourceOutOfScopeError,
} from '../../src/lib/authorization/service';
import {
  TenantNameNotOwnedError,
  TenantStateError,
  TenantValidationError,
} from '../../src/modules/tenants/errors';
import {
  acceptTenantInvitation,
  getMyTenantSpace,
  getTenant,
  inviteTenant,
  reactivateTenant,
  revokeTenant,
  suspendTenant,
  updateTenant,
} from '../../src/modules/tenants/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  OPTIONS,
  addApartment,
  addProperty,
  addScope,
  addSession,
  contextOf,
  countSessions,
  freshPhone,
  passwordHasher,
  readFullName,
  readTenantAccess,
} from '../helpers/tenants';

/**
 * MVP-BACKLOG-031 : fiche d'un locataire, nom, suspension, réactivation,
 * révocation (DEC-046 à DEC-048).
 *
 * Trois règles de décision y sont éprouvées :
 *
 *   1. le périmètre d'un locataire se résout par le LOGEMENT de son invitation
 *      acceptée, ET par sa propre identité (DEC-046) ;
 *   2. propriétaire et gestionnaire suspendent et révoquent, chacun sur son
 *      périmètre, et aucun autre locataire n'atteint la fiche (DEC-047) ;
 *   3. le locataire modifie SON NOM, et seul lui (DEC-048).
 */
describe("Vie de l'accès d'un locataire", () => {
  let harness: TestDatabase;
  let owner: Awaited<ReturnType<typeof contextOf>>;
  let manager: Awaited<ReturnType<typeof contextOf>>;
  let otherOwner: Awaited<ReturnType<typeof contextOf>>;

  let inScopeProperty: string;
  let outOfScopeProperty: string;
  let inScopeApartment: string;
  let outOfScopeApartment: string;
  let hashPassword: (password: string) => Promise<string>;

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    inScopeProperty = await addProperty(harness, 'Résidence Kipé');
    outOfScopeProperty = await addProperty(harness, 'Résidence Dixinn Nord');

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

  /** Crée un locataire ACTIF sur le logement indiqué, et renvoie son accès. */
  const addTenant = async (apartmentId = inScopeApartment) => {
    const phone = freshPhone();
    const issued = await inviteTenant(
      harness.db,
      owner,
      { apartmentId, name: 'Locataire actif', phone, email: '' },
      OPTIONS,
    );

    const accepted = await acceptTenantInvitation(
      harness.db,
      { hashPassword },
      { token: issued.token, password: 'mot-de-passe-solide' },
      OPTIONS,
    );

    return { ...accepted, phone, context: await contextOf(harness, accepted.userId) };
  };

  const failureOf = (promise: Promise<unknown>) => promise.catch((error: unknown) => error);

  describe('Fiche', () => {
    it('porte l identité, le statut et le logement', async () => {
      const tenant = await addTenant();
      const view = await getTenant(harness.db, owner, tenant.userId);

      expect(view.id).toBe(tenant.userId);
      expect(view.fullName).toBe('Locataire actif');
      expect(view.phone).toBe(tenant.phone);
      expect(view.status).toBe('ACTIVE');
      expect(view.apartment?.number).toBe('K01');
      expect(view.apartment?.propertyName).toBe('Résidence Kipé');
      expect(view.activatedAt).not.toBeNull();
    });

    /** DEC-046 : aucune donnée financière dans la fiche du Lot 7. */
    it('ne porte aucune donnée financière', async () => {
      const tenant = await addTenant();
      const view = await getTenant(harness.db, owner, tenant.userId);

      expect(JSON.stringify(view)).not.toMatch(/amount|currency|rent/i);
    });

    it('est accessible au gestionnaire dont le périmètre contient le logement', async () => {
      const tenant = await addTenant();

      await expect(getTenant(harness.db, manager, tenant.userId)).resolves.toMatchObject({
        id: tenant.userId,
      });
    });

    /** Le cœur de DEC-046 : le logement résout le périmètre, pour un accès aussi. */
    it('est inaccessible au gestionnaire quand le logement est hors de son périmètre', async () => {
      const tenant = await addTenant(outOfScopeApartment);

      await expect(getTenant(harness.db, manager, tenant.userId)).rejects.toBeInstanceOf(
        ResourceOutOfScopeError,
      );
    });

    it("est inaccessible au propriétaire d'une autre organisation", async () => {
      const tenant = await addTenant();

      await expect(getTenant(harness.db, otherOwner, tenant.userId)).rejects.toBeInstanceOf(
        ResourceOutOfScopeError,
      );
    });

    it('est accessible au locataire lui-même', async () => {
      const tenant = await addTenant();

      await expect(getTenant(harness.db, tenant.context, tenant.userId)).resolves.toMatchObject({
        id: tenant.userId,
      });
    });

    /** DEC-047 : aucun accès pour un autre locataire, et refus indiscernable. */
    it('est inaccessible à un AUTRE locataire, comme un identifiant inconnu', async () => {
      const first = await addTenant();
      const second = await addTenant();

      const foreign = await failureOf(getTenant(harness.db, second.context, first.userId));
      const unknown = await failureOf(
        getTenant(harness.db, second.context, '00000000-0000-4000-8000-000000000999'),
      );

      expect(foreign).toBeInstanceOf(ResourceOutOfScopeError);
      expect((foreign as Error).message).toBe((unknown as Error).message);
    });

    it("refuse l'identifiant d'un ACCES, qui n'est plus celui d'une personne", async () => {
      // DEC-051 a change l'identifiant de la ressource : un `user_access.id` ne
      // designe plus rien ici, et doit se comporter comme inconnu.
      await expect(getTenant(harness.db, owner, SEED_IDS.accessManagerA)).rejects.toBeInstanceOf(
        ResourceOutOfScopeError,
      );
    });

    it("refuse la personne d'un GESTIONNAIRE : elle n'est pas locataire", async () => {
      await expect(getTenant(harness.db, owner, SEED_IDS.managerA)).rejects.toBeInstanceOf(
        ResourceOutOfScopeError,
      );
    });

    it('refuse un identifiant mal formé', async () => {
      await expect(getTenant(harness.db, owner, 'pas-un-uuid')).rejects.toBeInstanceOf(
        ResourceOutOfScopeError,
      );
    });
  });

  describe('Espace locataire', () => {
    it('donne au locataire sa propre fiche, sans identifiant à fournir', async () => {
      const tenant = await addTenant();
      const space = await getMyTenantSpace(harness.db, tenant.context);

      expect(space?.id).toBe(tenant.userId);
      expect(space?.apartment?.number).toBe('K01');
    });

    it("renvoie null pour un propriétaire : il n'a pas d'espace locataire", async () => {
      expect(await getMyTenantSpace(harness.db, owner)).toBeNull();
    });
  });

  describe('Nom du locataire (DEC-048)', () => {
    it('est modifiable par le locataire lui-même', async () => {
      const tenant = await addTenant();
      const view = await updateTenant(
        harness.db,
        tenant.context,
        tenant.userId,
        { name: '  Aïssatou   Barry  ' },
        OPTIONS,
      );

      expect(view.fullName).toBe('Aïssatou Barry');
      expect(await readFullName(harness, tenant.userId)).toBe('Aïssatou Barry');
    });

    it("n'est PAS modifiable par le propriétaire", async () => {
      const tenant = await addTenant();
      const error = await failureOf(
        updateTenant(harness.db, owner, tenant.userId, { name: 'Nom imposé' }, OPTIONS),
      );

      expect(error).toBeInstanceOf(TenantNameNotOwnedError);
      expect(await readFullName(harness, tenant.userId)).toBe('Locataire actif');
    });

    it("n'est PAS modifiable par le gestionnaire", async () => {
      const tenant = await addTenant();

      await expect(
        updateTenant(harness.db, manager, tenant.userId, { name: 'Nom imposé' }, OPTIONS),
      ).rejects.toBeInstanceOf(TenantNameNotOwnedError);
    });

    it('refuse un nom vide', async () => {
      const tenant = await addTenant();
      const error = await failureOf(
        updateTenant(harness.db, tenant.context, tenant.userId, { name: '  ' }, OPTIONS),
      );

      expect(error).toBeInstanceOf(TenantValidationError);
      expect((error as TenantValidationError).fieldErrors.name).toBeDefined();
    });

    /** Le schéma n'accepte ni téléphone ni email : ils ne passent pas, même fournis. */
    it('ne touche ni le téléphone ni l email, même si on les fournit', async () => {
      const tenant = await addTenant();

      await updateTenant(
        harness.db,
        tenant.context,
        tenant.userId,
        { name: 'Nouveau nom', phone: '+224620009999', email: 'change@example.com' },
        OPTIONS,
      );

      const view = await getTenant(harness.db, owner, tenant.userId);

      expect(view.phone).toBe(tenant.phone);
      expect(view.email).toBeNull();
    });
  });

  describe('Suspension et réactivation (DEC-047)', () => {
    it('suspend puis réactive, par le propriétaire', async () => {
      const tenant = await addTenant();

      expect((await suspendTenant(harness.db, owner, tenant.userId, OPTIONS)).status).toBe(
        'SUSPENDED',
      );
      expect((await reactivateTenant(harness.db, owner, tenant.userId, OPTIONS)).status).toBe(
        'ACTIVE',
      );
    });

    /** La différence assumée avec le gestionnaire (DEC-047). */
    it('est permise au GESTIONNAIRE, sur son périmètre', async () => {
      const tenant = await addTenant();

      expect((await suspendTenant(harness.db, manager, tenant.userId, OPTIONS)).status).toBe(
        'SUSPENDED',
      );
      expect((await reactivateTenant(harness.db, manager, tenant.userId, OPTIONS)).status).toBe(
        'ACTIVE',
      );
    });

    it('refuse une suspension déjà faite, plutôt que de feindre un succès', async () => {
      const tenant = await addTenant();

      await suspendTenant(harness.db, owner, tenant.userId, OPTIONS);

      const error = await failureOf(suspendTenant(harness.db, owner, tenant.userId, OPTIONS));

      expect(error).toBeInstanceOf(TenantStateError);
      expect((error as TenantStateError).status).toBe('SUSPENDED');
    });

    it('refuse de réactiver un accès déjà actif', async () => {
      const tenant = await addTenant();

      await expect(
        reactivateTenant(harness.db, owner, tenant.userId, OPTIONS),
      ).rejects.toBeInstanceOf(TenantStateError);
    });

    it('ferme l accès du suspendu dès la relecture du contexte', async () => {
      const tenant = await addTenant();

      await suspendTenant(harness.db, owner, tenant.userId, OPTIONS);

      const context = await contextOf(harness, tenant.userId);

      expect(context.memberships).toHaveLength(0);
    });

    it('ne touche pas le compte de la personne', async () => {
      const tenant = await addTenant();

      await suspendTenant(harness.db, owner, tenant.userId, OPTIONS);

      const [user] = await harness.db
        .select({ status: harness.schema.users.status })
        .from(harness.schema.users)
        .where(eq(harness.schema.users.id, tenant.userId));

      expect(user?.status).toBe('ACTIVE');
    });
  });

  describe('Révocation (DEC-047)', () => {
    it('révoque depuis un accès actif comme suspendu', async () => {
      const active = await addTenant();
      const suspended = await addTenant();

      await suspendTenant(harness.db, owner, suspended.userId, OPTIONS);

      expect((await revokeTenant(harness.db, owner, active.userId, OPTIONS)).status).toBe(
        'REVOKED',
      );
      expect((await revokeTenant(harness.db, owner, suspended.userId, OPTIONS)).status).toBe(
        'REVOKED',
      );
    });

    it('est permise au gestionnaire, sur son périmètre', async () => {
      const tenant = await addTenant();

      expect((await revokeTenant(harness.db, manager, tenant.userId, OPTIONS)).status).toBe(
        'REVOKED',
      );
    });

    it('est refusée au locataire, même sur son propre accès', async () => {
      const tenant = await addTenant();
      const error = await failureOf(
        revokeTenant(harness.db, tenant.context, tenant.userId, OPTIONS),
      );

      expect(error).toBeInstanceOf(PermissionDeniedError);
      expect((error as PermissionDeniedError).permission).toBe('tenant.revoke');
    });

    it('refuse une révocation déjà faite', async () => {
      const tenant = await addTenant();

      await revokeTenant(harness.db, owner, tenant.userId, OPTIONS);

      await expect(revokeTenant(harness.db, owner, tenant.userId, OPTIONS)).rejects.toBeInstanceOf(
        TenantStateError,
      );
    });

    it('refuse de réactiver un accès révoqué : on réinvite la personne', async () => {
      const tenant = await addTenant();

      await revokeTenant(harness.db, owner, tenant.userId, OPTIONS);

      const error = await failureOf(reactivateTenant(harness.db, owner, tenant.userId, OPTIONS));

      expect(error).toBeInstanceOf(TenantStateError);
      expect((error as TenantStateError).message).toMatch(/invitez de nouveau/i);
    });

    it('conserve la ligne d accès et la personne : rien n est supprimé', async () => {
      const tenant = await addTenant();

      await revokeTenant(harness.db, owner, tenant.userId, OPTIONS);

      const access = await readTenantAccess(harness, tenant.userId);

      expect(access?.userId).toBe(tenant.userId);
      expect(access?.revokedAt).not.toBeNull();
      expect(await readFullName(harness, tenant.userId)).toBe('Locataire actif');
    });

    it('coupe les sessions quand la personne n a plus aucun accès actif', async () => {
      const tenant = await addTenant();

      await addSession(harness, tenant.userId);

      expect(await countSessions(harness, tenant.userId)).toBe(1);

      await revokeTenant(harness.db, owner, tenant.userId, OPTIONS);

      expect(await countSessions(harness, tenant.userId)).toBe(0);
    });

    it('laisse les sessions d une personne qui garde un accès actif ailleurs', async () => {
      const tenant = await addTenant();
      const other = await addProperty(harness, `Immeuble ${freshPhone()}`, {
        organizationId: SEED_IDS.organizationB,
      });

      await addApartment(harness, other, 'Z01', { organizationId: SEED_IDS.organizationB });
      await harness.db.insert(harness.schema.userAccess).values({
        userId: tenant.userId,
        organizationId: SEED_IDS.organizationB,
        role: 'TENANT',
        status: 'ACTIVE',
      });

      await addSession(harness, tenant.userId);
      await revokeTenant(harness.db, owner, tenant.userId, OPTIONS);

      expect(await countSessions(harness, tenant.userId)).toBe(1);
    });
  });
});
