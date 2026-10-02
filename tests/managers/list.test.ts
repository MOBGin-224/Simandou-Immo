import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { ResourceOutOfScopeError } from '../../src/lib/authorization/service';
import {
  acceptManagerInvitation,
  inviteManager,
  listManagers,
  revokeManagerInvitation,
} from '../../src/modules/managers/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  DAY_MS,
  OPTIONS,
  addAccess,
  addProperty,
  addScope,
  addUser,
  at,
  contextOf,
  freshPhone,
  passwordHasher,
} from '../helpers/managers';

/**
 * MVP-FEAT-019 et PRD 10.2 : la liste des gestionnaires.
 *
 * Elle réunit les accès et les invitations en attente. Les refus passent d'abord :
 * un gestionnaire, un locataire ou le propriétaire d'une autre organisation ne
 * doivent rien en apprendre.
 */
describe('Liste des gestionnaires', () => {
  let harness: TestDatabase;
  let owner: Awaited<ReturnType<typeof contextOf>>;
  let manager: Awaited<ReturnType<typeof contextOf>>;
  let otherOwner: Awaited<ReturnType<typeof contextOf>>;
  let tenant: Awaited<ReturnType<typeof contextOf>>;
  let hashPassword: (password: string) => Promise<string>;
  let propertyOne: string;
  let propertyTwo: string;

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    hashPassword = passwordHasher(harness);
    owner = await contextOf(harness, SEED_IDS.ownerA);
    manager = await contextOf(harness, SEED_IDS.managerA);
    otherOwner = await contextOf(harness, SEED_IDS.ownerB);

    const tenantUser = await addUser(harness);
    await addAccess(harness, { userId: tenantUser.id, role: 'TENANT' });
    tenant = await contextOf(harness, tenantUser.id);

    propertyOne = await addProperty(harness, 'Résidence Kipé');
    propertyTwo = await addProperty(harness, 'Résidence Ratoma');
  });

  afterAll(async () => {
    await harness.close();
  });

  const failureOf = (promise: Promise<unknown>) => promise.catch((error: unknown) => error);

  const invite = (name: string, options = OPTIONS, propertyIds = [propertyOne]) =>
    inviteManager(
      harness.db,
      owner,
      {
        organizationId: SEED_IDS.organizationA,
        name,
        phone: freshPhone(),
        email: '',
        propertyIds,
      },
      options,
    );

  describe('Refus', () => {
    it('refuse un gestionnaire comme une ressource inexistante', async () => {
      expect(await failureOf(listManagers(harness.db, manager, OPTIONS))).toBeInstanceOf(
        ResourceOutOfScopeError,
      );
    });

    it('refuse un locataire', async () => {
      expect(await failureOf(listManagers(harness.db, tenant, OPTIONS))).toBeInstanceOf(
        ResourceOutOfScopeError,
      );
    });

    it('refuse une personne sans aucun accès', async () => {
      const stranger = await addUser(harness);
      const context = await contextOf(harness, stranger.id);

      expect(await failureOf(listManagers(harness.db, context, OPTIONS))).toBeInstanceOf(
        ResourceOutOfScopeError,
      );
    });
  });

  describe('Isolation', () => {
    it("ne montre au propriétaire A rien de l'organisation B, et inversement", async () => {
      const invitedByA = await invite('Invité de A');

      const forB = await inviteManager(
        harness.db,
        otherOwner,
        {
          organizationId: SEED_IDS.organizationB,
          name: 'Invité de B',
          phone: freshPhone(),
          email: '',
          propertyIds: [SEED_IDS.propertyB],
        },
        OPTIONS,
      );

      const listA = await listManagers(harness.db, owner, OPTIONS);
      const listB = await listManagers(harness.db, otherOwner, OPTIONS);

      expect(listA.managers.some((item) => item.id === invitedByA.invitation.id)).toBe(true);
      expect(listA.managers.some((item) => item.id === forB.invitation.id)).toBe(false);
      expect(listB.managers.some((item) => item.id === forB.invitation.id)).toBe(true);
      expect(listB.managers.some((item) => item.id === invitedByA.invitation.id)).toBe(false);

      expect(listA.managers.every((item) => item.organizationId === SEED_IDS.organizationA)).toBe(
        true,
      );
    });

    it("ne montre pas le gestionnaire de l'organisation B à l'organisation A", async () => {
      const foreign = await addUser(harness, { fullName: 'Gestionnaire étranger' });
      const accessId = await addAccess(harness, {
        userId: foreign.id,
        role: 'MANAGER',
        organizationId: SEED_IDS.organizationB,
      });

      await addScope(harness, accessId, SEED_IDS.propertyB);

      const listA = await listManagers(harness.db, owner, OPTIONS);

      expect(listA.managers.some((item) => item.id === accessId)).toBe(false);
    });
  });

  describe('Contenu', () => {
    it('montre un gestionnaire du seed avec son périmètre', async () => {
      const list = await listManagers(harness.db, owner, OPTIONS);
      const seeded = list.managers.find(
        (item) => item.kind === 'ACCESS' && item.id === SEED_IDS.accessManagerA,
      );

      expect(seeded?.fullName).toBe('Mamadou Diallo');
      expect(seeded?.status).toBe('ACTIVE');
      expect(seeded?.properties.map((property) => property.id)).toEqual([SEED_IDS.propertyA]);
    });

    it('distingue un accès d une invitation, par leur type', async () => {
      const issued = await invite('Invité distinct');
      const list = await listManagers(harness.db, owner, OPTIONS);

      expect(list.managers.find((item) => item.id === issued.invitation.id)?.kind).toBe(
        'INVITATION',
      );
      expect(list.managers.find((item) => item.id === SEED_IDS.accessManagerA)?.kind).toBe(
        'ACCESS',
      );
    });

    it('montre une invitation ouverte avec ses immeubles et son expiration', async () => {
      const issued = await invite('Invité Kipé et Ratoma', OPTIONS, [propertyOne, propertyTwo]);
      const item = (await listManagers(harness.db, owner, OPTIONS)).managers.find(
        (candidate) => candidate.id === issued.invitation.id,
      );

      expect(item?.status).toBe('INVITED');
      expect(item?.properties.map((property) => property.name).sort()).toEqual([
        'Résidence Kipé',
        'Résidence Ratoma',
      ]);
      expect(item?.expiresAt?.getTime()).toBe(issued.invitation.expiresAt.getTime());
    });

    /** DEC-041 : `EXPIRED` est dérivé à la lecture, jamais écrit par une tâche. */
    it('affiche une invitation périmée comme expirée', async () => {
      const issued = await invite('Invité trop tard');
      const list = await listManagers(harness.db, owner, { ...OPTIONS, now: at(8 * DAY_MS) });

      expect(list.managers.find((item) => item.id === issued.invitation.id)?.status).toBe(
        'INVITATION_EXPIRED',
      );
    });

    it('ne répète pas une invitation acceptée : son gestionnaire la remplace', async () => {
      const issued = await invite('Invité accepté');

      const result = await acceptManagerInvitation(
        harness.db,
        { hashPassword },
        { token: issued.token, password: 'mot-de-passe-solide-2026' },
        OPTIONS,
      );

      const list = await listManagers(harness.db, owner, OPTIONS);

      expect(list.managers.some((item) => item.id === issued.invitation.id)).toBe(false);

      const access = list.managers.find((item) => item.id === result.accessId);

      expect(access?.kind).toBe('ACCESS');
      expect(access?.status).toBe('ACTIVE');
      expect(access?.fullName).toBe('Invité accepté');
      expect(access?.invitedAt?.getTime()).toBe(OPTIONS.now?.getTime());
      expect(access?.activatedAt?.getTime()).toBe(OPTIONS.now?.getTime());
    });

    it('ne montre pas une invitation révoquée', async () => {
      const issued = await invite('Invité révoqué');

      await revokeManagerInvitation(harness.db, owner, issued.invitation.id, OPTIONS);

      const list = await listManagers(harness.db, owner, OPTIONS);

      expect(list.managers.some((item) => item.id === issued.invitation.id)).toBe(false);
    });

    it('montre un gestionnaire suspendu et un gestionnaire révoqué, avec leur statut', async () => {
      const suspended = await addUser(harness, { fullName: 'Suspendu' });
      const revoked = await addUser(harness, { fullName: 'Révoqué' });
      const suspendedAccess = await addAccess(harness, {
        userId: suspended.id,
        role: 'MANAGER',
        status: 'SUSPENDED',
      });
      const revokedAccess = await addAccess(harness, {
        userId: revoked.id,
        role: 'MANAGER',
        status: 'REVOKED',
      });

      const list = await listManagers(harness.db, owner, OPTIONS);

      expect(list.managers.find((item) => item.id === suspendedAccess)?.status).toBe('SUSPENDED');
      expect(list.managers.find((item) => item.id === revokedAccess)?.status).toBe('REVOKED');
    });

    it('ne montre pas les immeubles révoqués du périmètre', async () => {
      const user = await addUser(harness, { fullName: 'Périmètre réduit' });
      const accessId = await addAccess(harness, { userId: user.id, role: 'MANAGER' });

      await addScope(harness, accessId, propertyOne);
      await addScope(harness, accessId, propertyTwo, { revoked: true });

      const item = (await listManagers(harness.db, owner, OPTIONS)).managers.find(
        (candidate) => candidate.id === accessId,
      );

      expect(item?.properties.map((property) => property.id)).toEqual([propertyOne]);
    });

    it('signale un immeuble archivé du périmètre sans le retirer', async () => {
      const archived = await addProperty(harness, 'Immeuble qui sera archivé');
      const user = await addUser(harness, { fullName: 'Immeuble archivé' });
      const accessId = await addAccess(harness, { userId: user.id, role: 'MANAGER' });

      await addScope(harness, accessId, archived);
      await harness.db
        .update(harness.schema.properties)
        .set({ archivedAt: OPTIONS.now })
        .where(eq(harness.schema.properties.id, archived));

      const item = (await listManagers(harness.db, owner, OPTIONS)).managers.find(
        (candidate) => candidate.id === accessId,
      );

      expect(item?.properties).toEqual([
        { id: archived, name: 'Immeuble qui sera archivé', archived: true },
      ]);
    });

    it('ne livre aucun secret dans la liste', async () => {
      const issued = await invite('Invité secret');
      const serialized = JSON.stringify(await listManagers(harness.db, owner, OPTIONS));

      expect(serialized).not.toContain(issued.token);
      expect(serialized).not.toContain('tokenHash');
      expect(serialized).not.toContain('password');
    });
  });

  describe('Tri', () => {
    it('place ce qui appelle une action avant les gestionnaires actifs', async () => {
      await invite('Zoé en attente');

      const statuses = (await listManagers(harness.db, owner, OPTIONS)).managers.map(
        (item) => item.status,
      );
      const firstActive = statuses.indexOf('ACTIVE');
      const lastInvited = statuses.lastIndexOf('INVITED');

      expect(lastInvited).toBeLessThan(firstActive);
    });

    it('annonce un total cohérent avec la liste', async () => {
      const list = await listManagers(harness.db, owner, OPTIONS);

      expect(list.meta.total).toBe(list.managers.length);
    });
  });
});
