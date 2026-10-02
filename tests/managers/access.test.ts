import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { can, ResourceOutOfScopeError } from '../../src/lib/authorization/service';
import { ManagerStateError, ManagerValidationError } from '../../src/modules/managers/errors';
import {
  acceptManagerInvitation,
  getManager,
  inviteManager,
  listManagers,
  reactivateManager,
  revokeManager,
  suspendManager,
  updateManagerScope,
} from '../../src/modules/managers/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  NOW,
  OPTIONS,
  activeScopeOf,
  addAccess,
  addProperty,
  addScope,
  addSession,
  addUser,
  contextOf,
  countSessions,
  failingInTransaction,
  freshPhone,
  passwordHasher,
  readManagerAccess,
  scopeRowsOf,
} from '../helpers/managers';

/**
 * MVP-BACKLOG-026 et 027 : la vie d'un gestionnaire actif.
 *
 * Fiche, périmètre, suspension, réactivation, révocation. Les refus passent
 * d'abord (ADR-007), puis la RÉVOCATION IMMÉDIATE (BR-019) et la CONSERVATION DE
 * L'HISTORIQUE (DEC-013), les deux exigences qui ne souffrent aucune approximation.
 *
 * Contre une VRAIE base, avec la vraie migration. L'effet d'une décision est mesuré
 * là où il compte : sur le contexte d'accès, relu en base comme le fait chaque
 * requête, et non sur une colonne.
 */
describe("Vie d'un gestionnaire actif", () => {
  let harness: TestDatabase;
  let owner: Awaited<ReturnType<typeof contextOf>>;
  let manager: Awaited<ReturnType<typeof contextOf>>;
  let otherOwner: Awaited<ReturnType<typeof contextOf>>;
  let tenant: Awaited<ReturnType<typeof contextOf>>;
  let hashPassword: (password: string) => Promise<string>;

  let propertyOne: string;
  let propertyTwo: string;
  let propertyThree: string;

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
    propertyThree = await addProperty(harness, 'Résidence Matoto');
  });

  afterAll(async () => {
    await harness.close();
  });

  const failureOf = (promise: Promise<unknown>) => promise.catch((error: unknown) => error);

  /** Un gestionnaire prêt à l'emploi, créé directement en base. */
  async function provision(
    options: {
      name?: string;
      propertyIds?: string[];
      status?: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
    } = {},
  ) {
    const user = await addUser(harness, { fullName: options.name ?? 'Gestionnaire de test' });
    const accessId = await addAccess(harness, {
      userId: user.id,
      role: 'MANAGER',
      status: options.status ?? 'ACTIVE',
    });

    for (const propertyId of options.propertyIds ?? [propertyOne]) {
      await addScope(harness, accessId, propertyId, { revoked: options.status === 'REVOKED' });
    }

    return { user, accessId };
  }

  /** Périmètre tel que le service d'autorisation le relit, c'est-à-dire ce qui décide vraiment. */
  async function effectiveScope(userId: string): Promise<string[]> {
    const context = await contextOf(harness, userId);

    return context.memberships
      .filter((membership) => membership.role === 'MANAGER')
      .flatMap((membership) => [...membership.propertyIds])
      .sort();
  }

  describe('Refus', () => {
    const operations: [string, (id: string, context: typeof owner) => Promise<unknown>][] = [
      ['consulter', (id, context) => getManager(harness.db, context, id)],
      [
        'modifier le périmètre',
        (id, context) =>
          updateManagerScope(harness.db, context, id, { propertyIds: [propertyTwo] }),
      ],
      ['suspendre', (id, context) => suspendManager(harness.db, context, id, OPTIONS)],
      ['réactiver', (id, context) => reactivateManager(harness.db, context, id, OPTIONS)],
      ['révoquer', (id, context) => revokeManager(harness.db, context, id, OPTIONS)],
    ];

    for (const [label, operate] of operations) {
      describe(label, () => {
        it('refuse un gestionnaire, comme une ressource inexistante', async () => {
          const { accessId } = await provision();

          expect(await failureOf(operate(accessId, manager))).toBeInstanceOf(
            ResourceOutOfScopeError,
          );
        });

        it('refuse un locataire', async () => {
          const { accessId } = await provision();

          expect(await failureOf(operate(accessId, tenant))).toBeInstanceOf(
            ResourceOutOfScopeError,
          );
        });

        it("refuse le propriétaire d'une AUTRE organisation, comme une ressource inexistante", async () => {
          const { accessId } = await provision();

          expect(await failureOf(operate(accessId, otherOwner))).toBeInstanceOf(
            ResourceOutOfScopeError,
          );
        });

        it('traite un identifiant mal formé ou inconnu comme un accès étranger', async () => {
          const { accessId } = await provision();
          const failures = await Promise.all([
            failureOf(operate('pas-un-uuid', owner)),
            failureOf(operate('99999999-9999-4999-8999-999999999999', owner)),
            failureOf(operate(accessId, otherOwner)),
          ]);

          for (const failure of failures) expect(failure).toBeInstanceOf(ResourceOutOfScopeError);

          expect(new Set(failures.map((failure) => (failure as Error).message)).size).toBe(1);
        });

        it("traite l'accès d'un propriétaire comme inexistant : ce n'est pas un gestionnaire", async () => {
          expect(await failureOf(operate(SEED_IDS.accessOwnerA, owner))).toBeInstanceOf(
            ResourceOutOfScopeError,
          );
        });
      });
    }

    it("n'a rien modifié quand l'autorisation a refusé", async () => {
      const { user, accessId } = await provision({ propertyIds: [propertyOne, propertyTwo] });

      for (const [, operate] of operations) await failureOf(operate(accessId, otherOwner));
      for (const [, operate] of operations) await failureOf(operate(accessId, manager));

      expect((await readManagerAccess(harness, user.id))?.status).toBe('ACTIVE');
      expect(await activeScopeOf(harness, accessId)).toEqual([propertyOne, propertyTwo].sort());
    });
  });

  describe('Fiche', () => {
    it('donne les informations du PRD : identité, statut, immeubles', async () => {
      const { accessId, user } = await provision({
        name: 'Aminata Bah',
        propertyIds: [propertyOne, propertyTwo],
      });

      const view = await getManager(harness.db, owner, accessId);

      expect(view.id).toBe(accessId);
      expect(view.fullName).toBe('Aminata Bah');
      expect(view.phone).toBe(user.phone);
      expect(view.status).toBe('ACTIVE');
      expect(view.organizationName).toBe('Patrimoine Camayenne');
      expect(view.properties.map((property) => property.name).sort()).toEqual([
        'Résidence Kipé',
        'Résidence Ratoma',
      ]);
    });

    it("date l'invitation et l'activation à partir de l'invitation acceptée", async () => {
      const issued = await inviteManager(
        harness.db,
        owner,
        {
          organizationId: SEED_IDS.organizationA,
          name: 'Invitée datée',
          phone: freshPhone(),
          email: '',
          propertyIds: [propertyOne],
        },
        OPTIONS,
      );
      const accepted = await acceptManagerInvitation(
        harness.db,
        { hashPassword },
        { token: issued.token, password: 'mot-de-passe-solide-2026' },
        OPTIONS,
      );

      const view = await getManager(harness.db, owner, accepted.accessId);

      expect(view.invitedAt?.getTime()).toBe(NOW.getTime());
      expect(view.activatedAt?.getTime()).toBe(NOW.getTime());
    });

    it('ne montre pas les immeubles révoqués du périmètre', async () => {
      const { accessId } = await provision({ propertyIds: [propertyOne] });

      await addScope(harness, accessId, propertyTwo, { revoked: true });

      const view = await getManager(harness.db, owner, accessId);

      expect(view.properties.map((property) => property.id)).toEqual([propertyOne]);
    });

    it('ne livre aucun secret', async () => {
      const { accessId } = await provision();
      const serialized = JSON.stringify(await getManager(harness.db, owner, accessId));

      expect(serialized).not.toContain('tokenHash');
      expect(serialized).not.toContain('password');
    });
  });

  describe('Périmètre (MVP-FEAT-021, DEC-042)', () => {
    it('ajoute un immeuble', async () => {
      const { user, accessId } = await provision({ propertyIds: [propertyOne] });

      const view = await updateManagerScope(harness.db, owner, accessId, {
        propertyIds: [propertyOne, propertyTwo],
      });

      expect(view.properties.map((property) => property.id).sort()).toEqual(
        [propertyOne, propertyTwo].sort(),
      );
      expect(await effectiveScope(user.id)).toEqual([propertyOne, propertyTwo].sort());
    });

    it('retire un immeuble, dont le gestionnaire perd aussitôt la vue', async () => {
      const { user, accessId } = await provision({ propertyIds: [propertyOne, propertyTwo] });

      await updateManagerScope(harness.db, owner, accessId, { propertyIds: [propertyOne] });

      const context = await contextOf(harness, user.id);
      const resource = (propertyId: string) => ({
        organizationId: SEED_IDS.organizationA,
        propertyId,
      });

      expect(can(context, 'property.read', resource(propertyOne))).toBe(true);
      expect(can(context, 'property.read', resource(propertyTwo))).toBe(false);
    });

    it('remplace la liste entière', async () => {
      const { user, accessId } = await provision({ propertyIds: [propertyOne, propertyTwo] });

      await updateManagerScope(harness.db, owner, accessId, { propertyIds: [propertyThree] });

      expect(await effectiveScope(user.id)).toEqual([propertyThree]);
    });

    it("garde les lignes d'un immeuble retiré, révoquées, sans rien supprimer (DEC-013)", async () => {
      const { accessId } = await provision({ propertyIds: [propertyOne, propertyTwo] });
      const before = await scopeRowsOf(harness, accessId);

      await updateManagerScope(harness.db, owner, accessId, { propertyIds: [propertyOne] });

      const after = await scopeRowsOf(harness, accessId);
      const removed = after.find((row) => row.propertyId === propertyTwo);

      expect(after).toHaveLength(before.length);
      expect(removed?.revokedAt).not.toBeNull();
      expect(after.find((row) => row.propertyId === propertyOne)?.revokedAt).toBeNull();
    });

    /** L'unicité couvre aussi les lignes révoquées : on réactive, on n'insère pas une copie. */
    it("réactive la ligne d'un immeuble retiré puis rattribué, sans la dupliquer", async () => {
      const { accessId } = await provision({ propertyIds: [propertyOne, propertyTwo] });

      await updateManagerScope(harness.db, owner, accessId, { propertyIds: [propertyOne] });

      const removedRow = (await scopeRowsOf(harness, accessId)).find(
        (row) => row.propertyId === propertyTwo,
      );

      await updateManagerScope(harness.db, owner, accessId, {
        propertyIds: [propertyOne, propertyTwo],
      });

      const rows = await scopeRowsOf(harness, accessId);
      const again = rows.filter((row) => row.propertyId === propertyTwo);

      expect(rows).toHaveLength(2);
      expect(again).toHaveLength(1);
      expect(again[0]?.id).toBe(removedRow?.id);
      expect(again[0]?.revokedAt).toBeNull();
    });

    it('ne change rien quand la liste est identique, sans erreur', async () => {
      const { accessId } = await provision({ propertyIds: [propertyOne, propertyTwo] });
      const before = await scopeRowsOf(harness, accessId);

      const view = await updateManagerScope(harness.db, owner, accessId, {
        propertyIds: [propertyTwo, propertyOne],
      });

      expect(view.properties).toHaveLength(2);
      expect(await scopeRowsOf(harness, accessId)).toEqual(before);
    });

    it('refuse une liste vide : un gestionnaire a toujours au moins un immeuble', async () => {
      const { accessId } = await provision({ propertyIds: [propertyOne] });
      const failure = await failureOf(
        updateManagerScope(harness.db, owner, accessId, { propertyIds: [] }),
      );

      expect(failure).toBeInstanceOf(ManagerValidationError);
      expect(await activeScopeOf(harness, accessId)).toEqual([propertyOne]);
    });

    it("refuse un immeuble d'une autre organisation comme un immeuble inexistant", async () => {
      const { accessId } = await provision();
      const foreign = await failureOf(
        updateManagerScope(harness.db, owner, accessId, {
          propertyIds: [propertyOne, SEED_IDS.propertyB],
        }),
      );
      const unknown = await failureOf(
        updateManagerScope(harness.db, owner, accessId, {
          propertyIds: [propertyOne, '99999999-9999-4999-8999-999999999999'],
        }),
      );

      expect(foreign).toBeInstanceOf(ManagerValidationError);
      expect((foreign as ManagerValidationError).fieldErrors).toEqual(
        (unknown as ManagerValidationError).fieldErrors,
      );
    });

    it('refuse de NOUVEAU attribuer un immeuble archivé', async () => {
      const { accessId } = await provision({ propertyIds: [propertyOne] });
      const archived = await addProperty(harness, 'Immeuble archivé du périmètre', {
        archived: true,
      });
      const failure = await failureOf(
        updateManagerScope(harness.db, owner, accessId, { propertyIds: [propertyOne, archived] }),
      );

      expect(failure).toBeInstanceOf(ManagerValidationError);
    });

    /** Archiver un immeuble n'est pas une décision de retirer le gestionnaire. */
    it("laisse dans le périmètre un immeuble archivé depuis qu'il y est", async () => {
      const archivedLater = await addProperty(harness, 'Sera archivé');
      const { accessId } = await provision({ propertyIds: [propertyOne, archivedLater] });

      await harness.db
        .update(harness.schema.properties)
        .set({ archivedAt: NOW })
        .where(eq(harness.schema.properties.id, archivedLater));

      const view = await updateManagerScope(harness.db, owner, accessId, {
        propertyIds: [archivedLater, propertyTwo],
      });

      expect(view.properties.map((property) => property.id).sort()).toEqual(
        [archivedLater, propertyTwo].sort(),
      );
    });

    it("n'applique AUCUN retrait quand un ajout est refusé : tout ou rien", async () => {
      const { accessId } = await provision({ propertyIds: [propertyOne, propertyTwo] });

      const failure = await failureOf(
        updateManagerScope(harness.db, owner, accessId, {
          propertyIds: [propertyOne, SEED_IDS.propertyB],
        }),
      );

      expect(failure).toBeInstanceOf(ManagerValidationError);
      expect(await activeScopeOf(harness, accessId)).toEqual([propertyOne, propertyTwo].sort());
    });

    it("modifie le périmètre d'un accès suspendu, qui reste suspendu", async () => {
      const { user, accessId } = await provision({
        propertyIds: [propertyOne],
        status: 'SUSPENDED',
      });

      await updateManagerScope(harness.db, owner, accessId, { propertyIds: [propertyTwo] });

      expect((await readManagerAccess(harness, user.id))?.status).toBe('SUSPENDED');
      expect(await activeScopeOf(harness, accessId)).toEqual([propertyTwo]);
    });

    it("refuse de modifier le périmètre d'un accès révoqué", async () => {
      const { accessId } = await provision({ propertyIds: [propertyOne], status: 'REVOKED' });
      const failure = await failureOf(
        updateManagerScope(harness.db, owner, accessId, { propertyIds: [propertyTwo] }),
      );

      expect(failure).toBeInstanceOf(ManagerStateError);
      expect((failure as ManagerStateError).message).toMatch(/invitez de nouveau/);
      expect(await activeScopeOf(harness, accessId)).toEqual([]);
    });

    it("n'accorde aucune permission nouvelle, quel que soit le périmètre", async () => {
      const { user, accessId } = await provision({ propertyIds: [propertyOne] });

      await updateManagerScope(harness.db, owner, accessId, {
        propertyIds: [propertyOne, propertyTwo, propertyThree],
      });

      const context = await contextOf(harness, user.id);
      const resource = { organizationId: SEED_IDS.organizationA, propertyId: propertyThree };

      expect(can(context, 'manager.invite', resource)).toBe(false);
      expect(can(context, 'manager.update', resource)).toBe(false);
      expect(can(context, 'property.archive', resource)).toBe(false);
    });
  });

  /**
   * ATOMICITÉ, éprouvée par une PANNE entre deux écritures (DEC-041).
   *
   * Une validation qui échoue avant toute écriture ne prouve pas l'atomicité : elle
   * laisse la base intacte avec ou sans transaction. Ici, une écriture a DÉJÀ eu lieu
   * quand la suivante échoue, et seule la transaction peut la défaire.
   */
  describe('Atomicité', () => {
    it("annule le retrait d'un immeuble quand l'attribution du suivant tombe en panne", async () => {
      const { accessId } = await provision({ propertyIds: [propertyOne] });
      const faulty = failingInTransaction(harness.db, 'insert');

      // Retire propertyOne (une écriture), puis ajoute propertyTwo (l'insertion échoue).
      const failure = await failureOf(
        updateManagerScope(faulty, owner, accessId, { propertyIds: [propertyTwo] }),
      );

      expect((failure as Error).message).toBe('panne simulée');
      expect(await activeScopeOf(harness, accessId)).toEqual([propertyOne]);
    });

    it('annule la révocation entière quand la coupure des sessions tombe en panne', async () => {
      const { user, accessId } = await provision({ propertyIds: [propertyOne, propertyTwo] });

      await addSession(harness, user.id);

      const faulty = failingInTransaction(harness.db, 'delete');
      const failure = await failureOf(revokeManager(faulty, owner, accessId, OPTIONS));

      expect((failure as Error).message).toBe('panne simulée');
      // Ni le statut, ni le périmètre, ni les sessions n'ont bougé.
      expect((await readManagerAccess(harness, user.id))?.status).toBe('ACTIVE');
      expect(await activeScopeOf(harness, accessId)).toEqual([propertyOne, propertyTwo].sort());
      expect(await countSessions(harness, user.id)).toBe(1);
      expect(await effectiveScope(user.id)).toEqual([propertyOne, propertyTwo].sort());
    });
  });

  describe('Suspension et réactivation (DEC-044)', () => {
    it("bloque l'accès à la requête suivante", async () => {
      const { user, accessId } = await provision({ propertyIds: [propertyOne] });

      expect(await effectiveScope(user.id)).toEqual([propertyOne]);

      const view = await suspendManager(harness.db, owner, accessId, OPTIONS);

      expect(view.status).toBe('SUSPENDED');
      expect((await contextOf(harness, user.id)).memberships).toHaveLength(0);
    });

    it('CONSERVE le périmètre : aucune ligne n est touchée', async () => {
      const { accessId } = await provision({ propertyIds: [propertyOne, propertyTwo] });
      const before = await scopeRowsOf(harness, accessId);

      await suspendManager(harness.db, owner, accessId, OPTIONS);

      expect(await scopeRowsOf(harness, accessId)).toEqual(before);
      expect(await activeScopeOf(harness, accessId)).toEqual([propertyOne, propertyTwo].sort());
    });

    it("restitue EXACTEMENT l'accès d'avant à la réactivation", async () => {
      const { user, accessId } = await provision({ propertyIds: [propertyOne, propertyThree] });
      const before = await effectiveScope(user.id);

      await suspendManager(harness.db, owner, accessId, OPTIONS);
      expect(await effectiveScope(user.id)).toEqual([]);

      const view = await reactivateManager(harness.db, owner, accessId, OPTIONS);

      expect(view.status).toBe('ACTIVE');
      expect(await effectiveScope(user.id)).toEqual(before);
    });

    it('ne touche pas aux sessions : la suspension ne concerne que ce rattachement', async () => {
      const { user, accessId } = await provision();

      await addSession(harness, user.id);
      await suspendManager(harness.db, owner, accessId, OPTIONS);

      expect(await countSessions(harness, user.id)).toBe(1);
    });

    it('ne touche pas au compte de la personne, ni à ses accès dans une autre organisation', async () => {
      const { user, accessId } = await provision({ propertyIds: [propertyOne] });
      const accessInB = await addAccess(harness, {
        userId: user.id,
        role: 'MANAGER',
        organizationId: SEED_IDS.organizationB,
      });

      await addScope(harness, accessInB, SEED_IDS.propertyB);
      await suspendManager(harness.db, owner, accessId, OPTIONS);

      const [account] = await harness.db
        .select()
        .from(harness.schema.users)
        .where(eq(harness.schema.users.id, user.id));
      const context = await contextOf(harness, user.id);

      expect(account?.status).toBe('ACTIVE');
      expect(context.memberships).toHaveLength(1);
      expect(context.memberships[0]?.organizationId).toBe(SEED_IDS.organizationB);
    });

    it('refuse de suspendre deux fois, plutôt que de feindre un succès', async () => {
      const { accessId } = await provision();

      await suspendManager(harness.db, owner, accessId, OPTIONS);

      const failure = await failureOf(suspendManager(harness.db, owner, accessId, OPTIONS));

      expect(failure).toBeInstanceOf(ManagerStateError);
      expect((failure as ManagerStateError).status).toBe('SUSPENDED');
    });

    it('refuse de réactiver un accès déjà actif', async () => {
      const { accessId } = await provision();
      const failure = await failureOf(reactivateManager(harness.db, owner, accessId, OPTIONS));

      expect(failure).toBeInstanceOf(ManagerStateError);
      expect((failure as ManagerStateError).status).toBe('ACTIVE');
    });

    /** DEC-044 : REVOKED ne se réactive jamais, c'est la réinvitation. */
    it('refuse de réactiver un accès révoqué, en renvoyant vers la réinvitation', async () => {
      const { user, accessId } = await provision({ status: 'REVOKED' });
      const failure = await failureOf(reactivateManager(harness.db, owner, accessId, OPTIONS));

      expect(failure).toBeInstanceOf(ManagerStateError);
      expect((failure as ManagerStateError).message).toMatch(/invitez de nouveau/);
      expect((await readManagerAccess(harness, user.id))?.status).toBe('REVOKED');
    });

    it('refuse de suspendre un accès révoqué', async () => {
      const { accessId } = await provision({ status: 'REVOKED' });
      const failure = await failureOf(suspendManager(harness.db, owner, accessId, OPTIONS));

      expect(failure).toBeInstanceOf(ManagerStateError);
      expect((failure as ManagerStateError).status).toBe('REVOKED');
    });

    it("n'affecte pas un autre gestionnaire de la même organisation", async () => {
      const first = await provision({ propertyIds: [propertyOne] });
      const second = await provision({ propertyIds: [propertyOne] });

      await suspendManager(harness.db, owner, first.accessId, OPTIONS);

      expect(await effectiveScope(first.user.id)).toEqual([]);
      expect(await effectiveScope(second.user.id)).toEqual([propertyOne]);
    });
  });

  describe('Révocation (MVP-FEAT-022, BR-019, DEC-013)', () => {
    it("retire l'accès À LA REQUÊTE SUIVANTE : le contexte d'autorisation est vide", async () => {
      const { user, accessId } = await provision({ propertyIds: [propertyOne, propertyTwo] });
      const resource = { organizationId: SEED_IDS.organizationA, propertyId: propertyOne };

      expect(can(await contextOf(harness, user.id), 'property.read', resource)).toBe(true);

      const view = await revokeManager(harness.db, owner, accessId, OPTIONS);

      expect(view.status).toBe('REVOKED');
      expect(view.revokedAt?.getTime()).toBe(NOW.getTime());
      expect((await contextOf(harness, user.id)).memberships).toHaveLength(0);
      expect(can(await contextOf(harness, user.id), 'property.read', resource)).toBe(false);
    });

    it('révoque TOUT le périmètre avec lui, sans supprimer aucune ligne', async () => {
      const { accessId } = await provision({
        propertyIds: [propertyOne, propertyTwo, propertyThree],
      });
      const before = await scopeRowsOf(harness, accessId);

      await revokeManager(harness.db, owner, accessId, OPTIONS);

      const after = await scopeRowsOf(harness, accessId);

      expect(after).toHaveLength(before.length);
      expect(after.every((row) => row.revokedAt !== null)).toBe(true);
      expect(after.map((row) => row.id).sort()).toEqual(before.map((row) => row.id).sort());
    });

    it("CONSERVE l'historique : ni la personne, ni son accès, ni ses invitations ne disparaissent", async () => {
      const issued = await inviteManager(
        harness.db,
        owner,
        {
          organizationId: SEED_IDS.organizationA,
          name: 'Historique conservé',
          phone: freshPhone(),
          email: '',
          propertyIds: [propertyOne],
        },
        OPTIONS,
      );
      const accepted = await acceptManagerInvitation(
        harness.db,
        { hashPassword },
        { token: issued.token, password: 'mot-de-passe-solide-2026' },
        OPTIONS,
      );

      await revokeManager(harness.db, owner, accepted.accessId, OPTIONS);

      const [account] = await harness.db
        .select()
        .from(harness.schema.users)
        .where(eq(harness.schema.users.id, accepted.userId));
      const accesses = await harness.db
        .select()
        .from(harness.schema.userAccess)
        .where(eq(harness.schema.userAccess.userId, accepted.userId));
      const [invitation] = await harness.db
        .select()
        .from(harness.schema.invitations)
        .where(eq(harness.schema.invitations.id, issued.invitation.id));

      // La personne reste, avec son nom : ses actions passées restent attribuées à son identité.
      expect(account?.fullName).toBe('Historique conservé');
      expect(account?.status).toBe('ACTIVE');
      expect(accesses).toHaveLength(1);
      expect(accesses[0]?.status).toBe('REVOKED');
      expect(invitation?.status).toBe('ACCEPTED');
    });

    it('révoque aussi un accès suspendu', async () => {
      const { accessId } = await provision();

      await suspendManager(harness.db, owner, accessId, OPTIONS);

      const view = await revokeManager(harness.db, owner, accessId, OPTIONS);

      expect(view.status).toBe('REVOKED');
    });

    it('refuse de révoquer deux fois, plutôt que de feindre un succès', async () => {
      const { accessId } = await provision();

      await revokeManager(harness.db, owner, accessId, OPTIONS);

      const failure = await failureOf(revokeManager(harness.db, owner, accessId, OPTIONS));

      expect(failure).toBeInstanceOf(ManagerStateError);
      expect((failure as ManagerStateError).status).toBe('REVOKED');
    });

    describe('Sessions', () => {
      it("coupe les sessions d'une personne qui n'a plus aucun accès actif", async () => {
        const { user, accessId } = await provision();

        await addSession(harness, user.id);
        await addSession(harness, user.id);

        await revokeManager(harness.db, owner, accessId, OPTIONS);

        expect(await countSessions(harness, user.id)).toBe(0);
      });

      /**
       * Les sessions ne sont pas propres à une organisation : couper celles d'une
       * personne qui travaille encore pour un autre propriétaire la déconnecterait à
       * tort.
       */
      it("GARDE les sessions d'une personne qui a encore un accès actif ailleurs", async () => {
        const { user, accessId } = await provision();
        const accessInB = await addAccess(harness, {
          userId: user.id,
          role: 'MANAGER',
          organizationId: SEED_IDS.organizationB,
        });

        await addScope(harness, accessInB, SEED_IDS.propertyB);
        await addSession(harness, user.id);

        await revokeManager(harness.db, owner, accessId, OPTIONS);

        expect(await countSessions(harness, user.id)).toBe(1);

        const context = await contextOf(harness, user.id);

        expect(context.memberships).toHaveLength(1);
        expect(context.memberships[0]?.organizationId).toBe(SEED_IDS.organizationB);
      });

      it("coupe les sessions d'une personne dont les autres accès sont suspendus ou révoqués", async () => {
        const { user, accessId } = await provision();

        await addAccess(harness, {
          userId: user.id,
          role: 'MANAGER',
          organizationId: SEED_IDS.organizationB,
          status: 'SUSPENDED',
        });
        await addSession(harness, user.id);

        await revokeManager(harness.db, owner, accessId, OPTIONS);

        expect(await countSessions(harness, user.id)).toBe(0);
      });

      it("ne touche jamais aux sessions d'une AUTRE personne", async () => {
        const target = await provision();
        const bystander = await provision();

        await addSession(harness, target.user.id);
        await addSession(harness, bystander.user.id);

        await revokeManager(harness.db, owner, target.accessId, OPTIONS);

        expect(await countSessions(harness, bystander.user.id)).toBe(1);
        expect(await effectiveScope(bystander.user.id)).toEqual([propertyOne]);
      });

      it('ne coupe rien quand la révocation est refusée', async () => {
        const { user, accessId } = await provision({ status: 'REVOKED' });

        await addSession(harness, user.id);
        await failureOf(revokeManager(harness.db, owner, accessId, OPTIONS));

        expect(await countSessions(harness, user.id)).toBe(1);
      });
    });

    describe('Après la révocation', () => {
      it('refuse toute autre opération sur cet accès', async () => {
        const { accessId } = await provision();

        await revokeManager(harness.db, owner, accessId, OPTIONS);

        for (const attempt of [
          suspendManager(harness.db, owner, accessId, OPTIONS),
          reactivateManager(harness.db, owner, accessId, OPTIONS),
          updateManagerScope(harness.db, owner, accessId, { propertyIds: [propertyTwo] }),
        ]) {
          expect(await failureOf(attempt)).toBeInstanceOf(ManagerStateError);
        }
      });

      it('laisse la fiche consultable, avec le statut révoqué et un périmètre vide', async () => {
        const { accessId } = await provision({ propertyIds: [propertyOne, propertyTwo] });

        await revokeManager(harness.db, owner, accessId, OPTIONS);

        const view = await getManager(harness.db, owner, accessId);

        expect(view.status).toBe('REVOKED');
        expect(view.properties).toEqual([]);
        expect(view.revokedAt).not.toBeNull();
      });

      /** DEC-043 : la réinvitation réactive la MÊME ligne, sans doublon dans la liste. */
      it('permet de réinviter la personne, sur la même ligne, sans doublon dans la liste', async () => {
        const phone = freshPhone();
        const input = {
          organizationId: SEED_IDS.organizationA,
          name: 'Réinvitée',
          phone,
          email: '',
          propertyIds: [propertyOne],
        };

        const first = await inviteManager(harness.db, owner, input, OPTIONS);
        const firstAcceptance = await acceptManagerInvitation(
          harness.db,
          { hashPassword },
          { token: first.token, password: 'mot-de-passe-solide-2026' },
          OPTIONS,
        );

        await revokeManager(harness.db, owner, firstAcceptance.accessId, OPTIONS);

        const second = await inviteManager(harness.db, owner, input, OPTIONS);
        const secondAcceptance = await acceptManagerInvitation(
          harness.db,
          { hashPassword },
          { token: second.token, sessionUserId: firstAcceptance.userId },
          OPTIONS,
        );

        expect(secondAcceptance.accessId).toBe(firstAcceptance.accessId);

        const list = await listManagers(harness.db, owner, OPTIONS);
        const forPerson = list.managers.filter((item) => item.phone === phone);

        expect(forPerson).toHaveLength(1);
        expect(forPerson[0]?.status).toBe('ACTIVE');
      });

      it("n'affecte pas un gestionnaire de l'organisation B portant le même immeuble", async () => {
        const mine = await provision({ propertyIds: [propertyOne] });
        const theirs = await addUser(harness);
        const theirAccess = await addAccess(harness, {
          userId: theirs.id,
          role: 'MANAGER',
          organizationId: SEED_IDS.organizationB,
        });

        await addScope(harness, theirAccess, SEED_IDS.propertyB);
        await revokeManager(harness.db, owner, mine.accessId, OPTIONS);

        const [stillActive] = await harness.db
          .select()
          .from(harness.schema.userAccess)
          .where(
            and(
              eq(harness.schema.userAccess.id, theirAccess),
              eq(harness.schema.userAccess.status, 'ACTIVE'),
            ),
          );

        expect(stillActive).toBeDefined();
      });
    });
  });
});
