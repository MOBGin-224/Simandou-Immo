import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { ResourceOutOfScopeError } from '../../src/lib/authorization/service';
import {
  createLease,
  listLeases,
  listMyLeases,
  terminateLease,
} from '../../src/modules/leases/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  OPTIONS,
  TODAY,
  addApartment,
  addProperty,
  addScope,
  addTenant,
  contextOf,
  dayOffset,
  freshPhone,
  passwordHasher,
} from '../helpers/leases';

/**
 * MVP-BACKLOG-035 : liste des baux et historique.
 *
 * L'historique locatif se RECONSTRUIT des baux et n'est pas dupliqué (Database
 * Schema section 18) : la liste est donc le seul endroit où il se lit, et son
 * ordre compte, le bail en cours avant les baux terminés.
 */
describe('Liste des baux', () => {
  let harness: TestDatabase;
  let owner: Awaited<ReturnType<typeof contextOf>>;
  let manager: Awaited<ReturnType<typeof contextOf>>;
  let otherOwner: Awaited<ReturnType<typeof contextOf>>;

  let inScopeProperty: string;
  let outOfScopeProperty: string;
  let hashPassword: (password: string) => Promise<string>;

  let counter = 0;
  const freshApartment = async (propertyId = inScopeProperty) => {
    counter += 1;

    return addApartment(harness, propertyId, `S${String(counter).padStart(3, '0')}`);
  };

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    inScopeProperty = await addProperty(harness, 'Résidence Kipé');
    outOfScopeProperty = await addProperty(harness, 'Résidence Dixinn Nord');

    await addScope(harness, SEED_IDS.accessManagerA, inScopeProperty);

    owner = await contextOf(harness, SEED_IDS.ownerA);
    manager = await contextOf(harness, SEED_IDS.managerA);
    otherOwner = await contextOf(harness, SEED_IDS.ownerB);
    hashPassword = passwordHasher(harness);
  });

  afterAll(async () => {
    await harness.close();
  });

  const addLease = async (
    options: { propertyId?: string; startDate?: string; apartmentId?: string } = {},
  ) => {
    const apartment = options.apartmentId ?? (await freshApartment(options.propertyId));
    const tenant = await addTenant(harness, {
      apartmentId: await freshApartment(),
      phone: freshPhone(),
      ownerContext: owner,
      hashPassword,
    });

    const lease = await createLease(
      harness.db,
      owner,
      {
        apartmentId: apartment,
        tenantId: tenant.accessId,
        startDate: options.startDate ?? TODAY,
        rentAmount: 2_500_000,
        currency: 'GNF',
        dueDay: 5,
      },
      OPTIONS,
    );

    return { lease, apartment, tenant, context: await contextOf(harness, tenant.userId) };
  };

  const idsOf = async (context = owner, query: Record<string, unknown> = {}): Promise<string[]> =>
    (await listLeases(harness.db, context, query, OPTIONS)).leases.map((l) => l.id);

  describe('Périmètre', () => {
    it('montre au gestionnaire les baux de son périmètre seulement', async () => {
      const inside = await addLease();
      const outside = await addLease({ propertyId: outOfScopeProperty });

      const visible = await idsOf(manager);

      expect(visible).toContain(inside.lease.id);
      expect(visible).not.toContain(outside.lease.id);
    });

    it('montre au propriétaire toute son organisation', async () => {
      const inside = await addLease();
      const outside = await addLease({ propertyId: outOfScopeProperty });

      const visible = await idsOf(owner);

      expect(visible).toContain(inside.lease.id);
      expect(visible).toContain(outside.lease.id);
    });

    it("ne montre rien au propriétaire d'une autre organisation", async () => {
      const mine = await addLease();

      expect(await idsOf(otherOwner)).not.toContain(mine.lease.id);
    });

    /** BR-021 : le locataire passe par son espace, pas par cette liste. */
    it('refuse un locataire : son rattachement est lui-même, pas un immeuble', async () => {
      const { context } = await addLease();

      await expect(listLeases(harness.db, context, {}, OPTIONS)).rejects.toBeInstanceOf(
        ResourceOutOfScopeError,
      );
    });
  });

  describe('Filtres', () => {
    it('filtre par immeuble', async () => {
      const inside = await addLease();
      const outside = await addLease({ propertyId: outOfScopeProperty });

      const visible = await idsOf(owner, { propertyId: inScopeProperty });

      expect(visible).toContain(inside.lease.id);
      expect(visible).not.toContain(outside.lease.id);
    });

    it('filtre par logement', async () => {
      const first = await addLease();
      const second = await addLease();

      const visible = await idsOf(owner, { apartmentId: first.apartment });

      expect(visible).toContain(first.lease.id);
      expect(visible).not.toContain(second.lease.id);
    });

    it('filtre par locataire, désigné par son identifiant de ressource', async () => {
      const first = await addLease();
      const second = await addLease();

      const visible = await idsOf(owner, { tenantId: first.tenant.accessId });

      expect(visible).toContain(first.lease.id);
      expect(visible).not.toContain(second.lease.id);
    });

    it('ne donne aucune ligne pour un locataire inconnu, sans le distinguer', async () => {
      const collection = await listLeases(
        harness.db,
        owner,
        { tenantId: '00000000-0000-4000-8000-000000000999' },
        OPTIONS,
      );

      expect(collection.leases).toHaveLength(0);
      expect(collection.meta.total).toBe(0);
    });

    it('filtre par statut', async () => {
      const active = await addLease();
      const ended = await addLease();

      await terminateLease(harness.db, owner, ended.lease.id, { terminationDate: TODAY }, OPTIONS);

      expect(await idsOf(owner, { status: 'ACTIVE' })).toContain(active.lease.id);
      expect(await idsOf(owner, { status: 'ACTIVE' })).not.toContain(ended.lease.id);
      expect(await idsOf(owner, { status: 'ENDED' })).toContain(ended.lease.id);
    });

    it('refuse un statut inconnu et une taille de page trop grande', async () => {
      await expect(listLeases(harness.db, owner, { status: 'INCONNU' }, OPTIONS)).rejects.toThrow();
      await expect(listLeases(harness.db, owner, { pageSize: 5000 }, OPTIONS)).rejects.toThrow();
    });

    it('pagine, et annonce le total avant pagination', async () => {
      await addLease();
      await addLease();
      await addLease();

      const collection = await listLeases(harness.db, owner, { pageSize: 2, page: 1 }, OPTIONS);

      expect(collection.leases.length).toBeLessThanOrEqual(2);
      expect(collection.meta.total).toBeGreaterThan(2);
      expect(collection.meta.page).toBe(1);
    });
  });

  describe('Historique', () => {
    /** BR-027 : plusieurs contrats successifs sur un même logement. */
    it("reconstruit l'historique d'un logement, le bail en cours d'abord", async () => {
      const first = await addLease({ startDate: dayOffset(-60) });

      await terminateLease(
        harness.db,
        owner,
        first.lease.id,
        { terminationDate: dayOffset(-10) },
        OPTIONS,
      );

      const second = await addLease({ apartmentId: first.apartment, startDate: dayOffset(-5) });

      const history = (
        await listLeases(harness.db, owner, { apartmentId: first.apartment }, OPTIONS)
      ).leases;

      expect(history).toHaveLength(2);
      expect(history[0]?.id).toBe(second.lease.id);
      expect(history[0]?.status).toBe('ACTIVE');
      expect(history[1]?.id).toBe(first.lease.id);
      expect(history[1]?.status).toBe('ENDED');
    });
  });

  describe('Espace locataire', () => {
    it('donne au locataire SON bail, sans identifiant à fournir', async () => {
      const { lease, context } = await addLease();
      const mine = await listMyLeases(harness.db, context);

      expect(mine.map((item) => item.id)).toEqual([lease.id]);
    });

    it('garde son bail clôturé dans son historique', async () => {
      const { lease, context } = await addLease();

      await terminateLease(harness.db, owner, lease.id, { terminationDate: TODAY }, OPTIONS);

      const mine = await listMyLeases(harness.db, context);

      expect(mine[0]?.status).toBe('ENDED');
    });

    it('ne donne rien à un propriétaire : il n a pas de bail', async () => {
      expect(await listMyLeases(harness.db, owner)).toHaveLength(0);
    });

    it("ne donne jamais le bail d'un autre", async () => {
      const first = await addLease();
      const second = await addLease();

      const mine = await listMyLeases(harness.db, second.context);

      expect(mine.map((item) => item.id)).not.toContain(first.lease.id);
    });
  });
});
