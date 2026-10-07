import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { ResourceOutOfScopeError } from '../../src/lib/authorization/service';
import { LeaseConflictError, LeaseValidationError } from '../../src/modules/leases/errors';
import { createLease, listLeasableApartments } from '../../src/modules/leases/service';
import { revokeTenant } from '../../src/modules/tenants/service';
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
  readLease,
} from '../helpers/leases';
import { OPTIONS as TENANT_OPTIONS } from '../helpers/tenants';

/**
 * MVP-BACKLOG-032 et 033 : création d'un bail et ses règles.
 *
 * Contre une VRAIE base, avec la vraie migration : les deux index d'unicité
 * partiels et les contraintes CHECK de `leases` participent aux règles testées,
 * et des doublures les auraient ignorées.
 *
 * Les refus viennent d'abord (ADR-007). Deux règles sont le cœur du lot :
 *
 *   1. un logement n'a qu'un bail actif (BR-028) ;
 *   2. une personne n'a qu'une relation locative active par organisation
 *      (DEC-049), appliquée ICI et non au niveau de l'invitation.
 */
describe("Création d'un bail", () => {
  let harness: TestDatabase;
  let owner: Awaited<ReturnType<typeof contextOf>>;
  let manager: Awaited<ReturnType<typeof contextOf>>;
  let otherOwner: Awaited<ReturnType<typeof contextOf>>;

  let inScopeProperty: string;
  let outOfScopeProperty: string;
  let hashPassword: (password: string) => Promise<string>;

  /** Un logement neuf par test : les règles d'unicité portent sur le logement. */
  let counter = 0;
  const freshApartment = async (propertyId = inScopeProperty) => {
    counter += 1;

    return addApartment(harness, propertyId, `L${String(counter).padStart(3, '0')}`);
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

  /** Locataire prêt à recevoir un bail, invité sur le logement indiqué. */
  const freshTenant = async (apartmentId: string) =>
    addTenant(harness, {
      apartmentId,
      phone: freshPhone(),
      ownerContext: owner,
      hashPassword,
    });

  const input = (overrides: Record<string, unknown> = {}) => ({
    startDate: TODAY,
    rentAmount: 2_500_000,
    currency: 'GNF',
    dueDay: 5,
    depositAmount: 5_000_000,
    ...overrides,
  });

  const failureOf = (promise: Promise<unknown>) => promise.catch((error: unknown) => error);

  describe('Refus', () => {
    it("refuse un logement d'une autre organisation", async () => {
      const apartment = await addApartment(harness, SEED_IDS.propertyB, 'ZB1', {
        organizationId: SEED_IDS.organizationB,
      });
      const tenant = await freshTenant(await freshApartment());

      await expect(
        createLease(
          harness.db,
          owner,
          input({ apartmentId: apartment, tenantId: tenant.accessId }),
          OPTIONS,
        ),
      ).rejects.toBeInstanceOf(ResourceOutOfScopeError);
    });

    it('refuse un logement inexistant', async () => {
      const tenant = await freshTenant(await freshApartment());

      await expect(
        createLease(
          harness.db,
          owner,
          input({
            apartmentId: '00000000-0000-4000-8000-000000000999',
            tenantId: tenant.accessId,
          }),
          OPTIONS,
        ),
      ).rejects.toBeInstanceOf(ResourceOutOfScopeError);
    });

    it('refuse au gestionnaire un logement hors de son périmètre', async () => {
      const apartment = await freshApartment(outOfScopeProperty);
      const tenant = await freshTenant(await freshApartment());

      await expect(
        createLease(
          harness.db,
          manager,
          input({ apartmentId: apartment, tenantId: tenant.accessId }),
          OPTIONS,
        ),
      ).rejects.toBeInstanceOf(ResourceOutOfScopeError);
    });

    it("refuse le propriétaire d'une autre organisation", async () => {
      const apartment = await freshApartment();
      const tenant = await freshTenant(await freshApartment());

      await expect(
        createLease(
          harness.db,
          otherOwner,
          input({ apartmentId: apartment, tenantId: tenant.accessId }),
          OPTIONS,
        ),
      ).rejects.toBeInstanceOf(ResourceOutOfScopeError);
    });

    it('refuse un logement archivé', async () => {
      const apartment = await addApartment(harness, inScopeProperty, 'ARCH1', { archived: true });
      const tenant = await freshTenant(await freshApartment());

      const error = await failureOf(
        createLease(
          harness.db,
          owner,
          input({ apartmentId: apartment, tenantId: tenant.accessId }),
          OPTIONS,
        ),
      );

      expect(error).toBeInstanceOf(LeaseValidationError);
      expect((error as LeaseValidationError).fieldErrors.apartmentId?.[0]).toMatch(/archivé/);
    });

    it("refuse un locataire d'une autre organisation, comme un inconnu", async () => {
      const apartment = await freshApartment();
      const foreignApartment = await addApartment(harness, SEED_IDS.propertyB, 'ZB2', {
        organizationId: SEED_IDS.organizationB,
      });
      const foreign = await addTenant(harness, {
        apartmentId: foreignApartment,
        phone: freshPhone(),
        ownerContext: otherOwner,
        hashPassword,
      });

      const elsewhere = await failureOf(
        createLease(
          harness.db,
          owner,
          input({ apartmentId: apartment, tenantId: foreign.accessId }),
          OPTIONS,
        ),
      );
      const unknown = await failureOf(
        createLease(
          harness.db,
          owner,
          input({
            apartmentId: apartment,
            tenantId: '00000000-0000-4000-8000-000000000998',
          }),
          OPTIONS,
        ),
      );

      expect(elsewhere).toBeInstanceOf(ResourceOutOfScopeError);
      expect((elsewhere as Error).message).toBe((unknown as Error).message);
    });

    it("refuse l'identifiant d'un accès de gestionnaire comme locataire", async () => {
      const apartment = await freshApartment();

      await expect(
        createLease(
          harness.db,
          owner,
          input({ apartmentId: apartment, tenantId: SEED_IDS.accessManagerA }),
          OPTIONS,
        ),
      ).rejects.toBeInstanceOf(ResourceOutOfScopeError);
    });

    it('refuse une date de fin antérieure au début', async () => {
      const apartment = await freshApartment();
      const tenant = await freshTenant(await freshApartment());

      const error = await failureOf(
        createLease(
          harness.db,
          owner,
          input({
            apartmentId: apartment,
            tenantId: tenant.accessId,
            startDate: dayOffset(10),
            endDate: dayOffset(5),
          }),
          OPTIONS,
        ),
      );

      expect(error).toBeInstanceOf(LeaseValidationError);
      expect((error as LeaseValidationError).fieldErrors.endDate).toBeDefined();
    });

    it("refuse une date qui n'existe pas", async () => {
      const apartment = await freshApartment();
      const tenant = await freshTenant(await freshApartment());

      const error = await failureOf(
        createLease(
          harness.db,
          owner,
          input({ apartmentId: apartment, tenantId: tenant.accessId, startDate: '2026-02-31' }),
          OPTIONS,
        ),
      );

      expect(error).toBeInstanceOf(LeaseValidationError);
      expect((error as LeaseValidationError).fieldErrors.startDate?.[0]).toMatch(/date réelle/);
    });

    it("refuse un jour d'échéance hors des bornes", async () => {
      const apartment = await freshApartment();
      const tenant = await freshTenant(await freshApartment());

      for (const dueDay of [0, 32, -1]) {
        const error = await failureOf(
          createLease(
            harness.db,
            owner,
            input({ apartmentId: apartment, tenantId: tenant.accessId, dueDay }),
            OPTIONS,
          ),
        );

        expect(error, `jour ${dueDay}`).toBeInstanceOf(LeaseValidationError);
      }
    });

    it('refuse un loyer négatif ou décimal', async () => {
      const apartment = await freshApartment();
      const tenant = await freshTenant(await freshApartment());

      for (const rentAmount of [-1, 2_500_000.5]) {
        const error = await failureOf(
          createLease(
            harness.db,
            owner,
            input({ apartmentId: apartment, tenantId: tenant.accessId, rentAmount }),
            OPTIONS,
          ),
        );

        expect(error, `loyer ${rentAmount}`).toBeInstanceOf(LeaseValidationError);
      }
    });

    it('refuse une devise mal formée', async () => {
      const apartment = await freshApartment();
      const tenant = await freshTenant(await freshApartment());

      const error = await failureOf(
        createLease(
          harness.db,
          owner,
          input({ apartmentId: apartment, tenantId: tenant.accessId, currency: 'francs' }),
          OPTIONS,
        ),
      );

      expect(error).toBeInstanceOf(LeaseValidationError);
    });
  });

  describe('Règles de simultanéité', () => {
    /** BR-028 : un logement n'a qu'un bail actif. */
    it('refuse un second bail actif sur le même logement', async () => {
      const apartment = await freshApartment();
      const first = await freshTenant(await freshApartment());
      const second = await freshTenant(await freshApartment());

      await createLease(
        harness.db,
        owner,
        input({ apartmentId: apartment, tenantId: first.accessId }),
        OPTIONS,
      );

      const error = await failureOf(
        createLease(
          harness.db,
          owner,
          input({ apartmentId: apartment, tenantId: second.accessId }),
          OPTIONS,
        ),
      );

      expect(error).toBeInstanceOf(LeaseConflictError);
      expect((error as LeaseConflictError).reason).toBe('apartment-occupied');
    });

    /** DEC-049 : une seule relation locative active par organisation. */
    it('refuse un second bail actif pour la même personne dans la même organisation', async () => {
      const tenant = await freshTenant(await freshApartment());
      const first = await freshApartment();
      const second = await freshApartment();

      await createLease(
        harness.db,
        owner,
        input({ apartmentId: first, tenantId: tenant.accessId }),
        OPTIONS,
      );

      const error = await failureOf(
        createLease(
          harness.db,
          owner,
          input({ apartmentId: second, tenantId: tenant.accessId }),
          OPTIONS,
        ),
      );

      expect(error).toBeInstanceOf(LeaseConflictError);
      expect((error as LeaseConflictError).reason).toBe('tenant-engaged');
    });

    it('distingue les deux refus : le message oriente la correction', async () => {
      expect(new LeaseConflictError('apartment-occupied').message).toMatch(/logement/i);
      expect(new LeaseConflictError('tenant-engaged').message).toMatch(/personne/i);
    });

    /** La base arbitre, et pas seulement le pré-contrôle par lecture. */
    it("est portée par la base : l'index refuse même sans pré-contrôle", async () => {
      const apartment = await freshApartment();
      const first = await freshTenant(await freshApartment());
      const second = await freshTenant(await freshApartment());
      const lease = await createLease(
        harness.db,
        owner,
        input({ apartmentId: apartment, tenantId: first.accessId }),
        OPTIONS,
      );

      const row = await readLease(harness, lease.id);

      await expect(
        harness.db.insert(harness.schema.leases).values({
          organizationId: row.organizationId,
          propertyId: row.propertyId,
          apartmentId: row.apartmentId,
          tenantUserId: second.userId,
          startDate: TODAY,
          rentAmount: 1_000_000,
          currency: 'GNF',
          dueDay: 1,
          status: 'ACTIVE',
        }),
      ).rejects.toThrow();
    });
  });

  describe('Bail créé', () => {
    it('naît ACTIF et porte ce qui a été convenu', async () => {
      const apartment = await freshApartment();
      const tenant = await freshTenant(await freshApartment());

      const lease = await createLease(
        harness.db,
        owner,
        input({
          apartmentId: apartment,
          tenantId: tenant.accessId,
          startDate: dayOffset(1),
          endDate: dayOffset(366),
        }),
        OPTIONS,
      );

      expect(lease.status).toBe('ACTIVE');
      expect(lease.startDate).toBe(dayOffset(1));
      expect(lease.endDate).toBe(dayOffset(366));
      expect(lease.rent).toEqual({ amount: 2_500_000, currency: 'GNF' });
      expect(lease.deposit).toEqual({ amount: 5_000_000, currency: 'GNF' });
      expect(lease.dueDay).toBe(5);
      expect(lease.terminatedAt).toBeNull();
      expect(lease.terminationReason).toBeNull();
    });

    /** La dénormalisation n'a de valeur que si elle ne peut pas mentir (ADR-007). */
    it("recopie l'organisation et l'immeuble DEPUIS le logement", async () => {
      const apartment = await freshApartment();
      const tenant = await freshTenant(await freshApartment());

      const lease = await createLease(
        harness.db,
        owner,
        input({ apartmentId: apartment, tenantId: tenant.accessId }),
        OPTIONS,
      );

      const row = await readLease(harness, lease.id);

      expect(row.organizationId).toBe(SEED_IDS.organizationA);
      expect(row.propertyId).toBe(inScopeProperty);
      expect(row.apartmentId).toBe(apartment);
    });

    it('accepte un bail sans terme : le cas courant sur ce marché', async () => {
      const apartment = await freshApartment();
      const tenant = await freshTenant(await freshApartment());

      for (const endDate of [undefined, null, '']) {
        const fresh = await freshApartment();
        const other = await freshTenant(await freshApartment());
        const lease = await createLease(
          harness.db,
          owner,
          input({ apartmentId: fresh, tenantId: other.accessId, endDate }),
          OPTIONS,
        );

        expect(lease.endDate, `fin ${String(endDate)}`).toBeNull();
      }

      void apartment;
      void tenant;
    });

    it('traite une caution absente comme une caution de zéro', async () => {
      const apartment = await freshApartment();
      const tenant = await freshTenant(await freshApartment());

      const lease = await createLease(
        harness.db,
        owner,
        input({ apartmentId: apartment, tenantId: tenant.accessId, depositAmount: undefined }),
        OPTIONS,
      );

      expect(lease.deposit.amount).toBe(0);
    });

    it('est permis au gestionnaire sur son périmètre', async () => {
      const apartment = await freshApartment();
      const tenant = await freshTenant(await freshApartment());

      await expect(
        createLease(
          harness.db,
          manager,
          input({ apartmentId: apartment, tenantId: tenant.accessId }),
          OPTIONS,
        ),
      ).resolves.toMatchObject({ status: 'ACTIVE' });
    });

    it('porte le locataire et son logement dans la vue', async () => {
      const apartment = await freshApartment();
      const tenant = await addTenant(harness, {
        apartmentId: await freshApartment(),
        name: 'Ousmane Sylla',
        phone: freshPhone(),
        ownerContext: owner,
        hashPassword,
      });

      const lease = await createLease(
        harness.db,
        owner,
        input({ apartmentId: apartment, tenantId: tenant.accessId }),
        OPTIONS,
      );

      expect(lease.tenant.fullName).toBe('Ousmane Sylla');
      expect(lease.tenant.accessId).toBe(tenant.accessId);
      expect(lease.tenant.userId).toBe(tenant.userId);
      expect(lease.apartment.id).toBe(apartment);
      expect(lease.apartment.propertyName).toBe('Résidence Kipé');
    });

    /**
     * La frontière de DEC-047, vue de l'autre côté : ne pas avoir d'accès au
     * produit n'empêche pas d'occuper un logement.
     */
    it("accepte un locataire dont l'accès au produit a été révoqué", async () => {
      const apartment = await freshApartment();
      const tenant = await freshTenant(await freshApartment());

      await revokeTenant(harness.db, owner, tenant.accessId, TENANT_OPTIONS);

      await expect(
        createLease(
          harness.db,
          owner,
          input({ apartmentId: apartment, tenantId: tenant.accessId }),
          OPTIONS,
        ),
      ).resolves.toMatchObject({ status: 'ACTIVE' });
    });
  });

  describe('Logements louables', () => {
    it('ne propose pas un logement qui a déjà un bail actif', async () => {
      const apartment = await freshApartment();
      const tenant = await freshTenant(await freshApartment());

      expect((await listLeasableApartments(harness.db, owner)).map((a) => a.id)).toContain(
        apartment,
      );

      await createLease(
        harness.db,
        owner,
        input({ apartmentId: apartment, tenantId: tenant.accessId }),
        OPTIONS,
      );

      expect((await listLeasableApartments(harness.db, owner)).map((a) => a.id)).not.toContain(
        apartment,
      );
    });

    it('ne propose pas un logement archivé', async () => {
      const archived = await addApartment(harness, inScopeProperty, 'ARCH2', { archived: true });

      expect((await listLeasableApartments(harness.db, owner)).map((a) => a.id)).not.toContain(
        archived,
      );
    });

    it('ne propose au gestionnaire que les logements de son périmètre', async () => {
      const inside = await freshApartment();
      const outside = await freshApartment(outOfScopeProperty);

      const proposed = (await listLeasableApartments(harness.db, manager)).map((a) => a.id);

      expect(proposed).toContain(inside);
      expect(proposed).not.toContain(outside);
    });

    it("ne propose rien à un propriétaire d'une autre organisation", async () => {
      const proposed = (await listLeasableApartments(harness.db, otherOwner)).map((a) => a.id);
      const mine = await freshApartment();

      expect(proposed).not.toContain(mine);
    });
  });
});
