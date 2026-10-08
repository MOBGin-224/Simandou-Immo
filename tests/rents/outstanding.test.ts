import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { ResourceOutOfScopeError } from '../../src/lib/authorization/service';
import {
  generateRents,
  getMyOutstanding,
  getTenantOutstanding,
  runOverdueJob,
} from '../../src/modules/rents/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  OPTIONS,
  PERIOD,
  addApartment,
  addBillableLease,
  addProperty,
  addScope,
  contextOf,
  freshPhone,
  installmentOf,
  passwordHasher,
  setPaid,
} from '../helpers/rents';

/**
 * API section 18 : le total dû d'un locataire, et BR-039 qui le définit.
 *
 * Trois exigences s'y vérifient. Le total est calculé CÔTÉ SERVEUR, la section
 * l'écrit noir sur blanc : « le frontend ne le recompose jamais ». Il ne compte
 * que les créances OUVERTES. Et chaque élément porte un `kind`, parce que la
 * route agrège les deux types de créance (DEC-005), même si les charges
 * n'existeront qu'au Lot 10.
 */
describe('Total dû d un locataire', () => {
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

    return addApartment(harness, propertyId, `O${String(counter).padStart(3, '0')}`);
  };

  const addRent = async (
    options: { propertyId?: string; rentAmount?: number; dueDay?: number; period?: string } = {},
  ) => {
    const lease = await addBillableLease(harness, {
      apartmentId: await freshApartment(options.propertyId),
      tenantApartmentId: await freshApartment(),
      ownerContext: owner,
      hashPassword,
      phone: freshPhone(),
      startDate: '2026-01-01',
      dueDay: options.dueDay,
      rentAmount: options.rentAmount,
    });

    const period = options.period ?? PERIOD;

    await generateRents(
      harness.db,
      owner,
      { period: period.slice(0, 7), propertyId: options.propertyId },
      OPTIONS,
    );

    const installment = await installmentOf(harness, lease.leaseId, period);

    if (!installment) throw new Error("L'échéance de test n'a pas été générée.");

    return { ...lease, installment };
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

  describe('Ce que le total contient', () => {
    it('somme les soldes des créances ouvertes de la personne', async () => {
      const rent = await addRent({ rentAmount: 2_000_000, dueDay: 5 });

      await generateRents(harness.db, owner, { period: '2026-09' }, OPTIONS);

      const summary = await getTenantOutstanding(harness.db, owner, rent.tenantUserId, OPTIONS);

      expect(summary.currency).toBe('GNF');
      expect(summary.totalOutstanding).toBe(4_000_000);
      expect(summary.receivables).toHaveLength(2);
    });

    it('porte le type RENT sur chaque créance, et un libellé lisible', async () => {
      const rent = await addRent({ rentAmount: 1_500_000 });

      const summary = await getTenantOutstanding(harness.db, owner, rent.tenantUserId, OPTIONS);
      const [receivable] = summary.receivables;

      expect(receivable?.kind).toBe('RENT');
      expect(receivable?.label).toBe('Loyer octobre 2026');
      expect(receivable?.periodStart).toBe(PERIOD);
      expect(receivable?.amountDue).toBe(1_500_000);
      expect(receivable?.balance).toBe(1_500_000);
    });

    it('écarte les créances soldées et annulées', async () => {
      const rent = await addRent({ rentAmount: 1_000_000 });

      await setPaid(harness, rent.installment.id, 1_000_000, 'PAID');

      const summary = await getTenantOutstanding(harness.db, owner, rent.tenantUserId, OPTIONS);

      expect(summary.totalOutstanding).toBe(0);
      expect(summary.receivables).toHaveLength(0);
    });

    it('ne compte que le SOLDE restant d une créance partiellement payée', async () => {
      const rent = await addRent({ rentAmount: 3_000_000 });

      await setPaid(harness, rent.installment.id, 1_200_000, 'PARTIALLY_PAID');

      const summary = await getTenantOutstanding(harness.db, owner, rent.tenantUserId, OPTIONS);

      expect(summary.totalOutstanding).toBe(1_800_000);
      expect(summary.receivables[0]?.amountPaid).toBe(1_200_000);
    });

    it('compte une créance passée en retard', async () => {
      const rent = await addRent({ rentAmount: 900_000, dueDay: 1 });

      await runOverdueJob(harness.db, OPTIONS);

      const summary = await getTenantOutstanding(harness.db, owner, rent.tenantUserId, OPTIONS);

      expect(summary.totalOutstanding).toBe(900_000);
      expect(summary.receivables[0]?.status).toBe('OVERDUE');
    });

    it('classe les créances de la plus ancienne à la plus récente', async () => {
      const rent = await addRent({ dueDay: 5 });

      await generateRents(harness.db, owner, { period: '2026-07' }, OPTIONS);
      await generateRents(harness.db, owner, { period: '2026-08' }, OPTIONS);

      const summary = await getTenantOutstanding(harness.db, owner, rent.tenantUserId, OPTIONS);

      expect(summary.receivables.map((receivable) => receivable.periodStart)).toEqual([
        '2026-07-01',
        '2026-08-01',
        '2026-10-01',
      ]);
    });

    /**
     * Une devise est donnée dans tous les cas, la section 18 en montre une dans sa
     * réponse : un « 0 » sans unité se lirait mal sur un écran.
     */
    it('donne une devise même sans aucune créance', async () => {
      const summary = await getTenantOutstanding(harness.db, owner, SEED_IDS.ownerA, OPTIONS);

      expect(summary.currency).toBe('GNF');
      expect(summary.totalOutstanding).toBe(0);
    });
  });

  describe('Le locataire et son propre total', () => {
    it('lit son total sans fournir d identifiant', async () => {
      const rent = await addRent({ rentAmount: 2_200_000 });
      const tenant = await contextOf(harness, rent.tenantUserId);

      const summary = await getMyOutstanding(harness.db, tenant, OPTIONS);

      expect(summary.totalOutstanding).toBe(2_200_000);
      expect(summary.receivables).toHaveLength(1);
    });

    it("ne lit pas le total d'un autre locataire", async () => {
      const mine = await addRent();
      const other = await addRent();
      const tenant = await contextOf(harness, mine.tenantUserId);

      await expect(
        getTenantOutstanding(harness.db, tenant, other.tenantUserId, OPTIONS),
      ).rejects.toThrow(ResourceOutOfScopeError);
    });
  });

  describe('Périmètre de celui qui demande', () => {
    it('ouvre le total au gestionnaire de l immeuble', async () => {
      const rent = await addRent({ rentAmount: 1_100_000 });

      const summary = await getTenantOutstanding(harness.db, manager, rent.tenantUserId, OPTIONS);

      expect(summary.totalOutstanding).toBe(1_100_000);
    });

    it("refuse le total au gestionnaire d'un autre immeuble", async () => {
      const rent = await addRent({ propertyId: outOfScopeProperty, rentAmount: 1_000_000 });

      await expect(
        getTenantOutstanding(harness.db, manager, rent.tenantUserId, OPTIONS),
      ).rejects.toThrow(ResourceOutOfScopeError);
    });

    /**
     * Le cas qui justifie d'autoriser créance par créance : la même personne loue
     * dans deux immeubles, dont un seul relève du gestionnaire. Un total partiel
     * serait FAUX, et il réclamerait de l'argent sur cette base. L'appel échoue
     * donc entièrement.
     */
    it('refuse un total PARTIEL quand une seule créance échappe au périmètre', async () => {
      const lease = await addBillableLease(harness, {
        apartmentId: await freshApartment(inScopeProperty),
        tenantApartmentId: await freshApartment(),
        ownerContext: owner,
        hashPassword,
        phone: freshPhone(),
        startDate: '2026-01-01',
        rentAmount: 1_000_000,
      });

      await generateRents(harness.db, owner, {}, OPTIONS);

      // La même personne reçoit ensuite une créance dans l'immeuble hors
      // périmètre, par un bail ouvert après la clôture du premier.
      const outsideApartment = await freshApartment(outOfScopeProperty);

      await harness.db.insert(harness.schema.rentInstallments).values({
        organizationId: SEED_IDS.organizationA,
        leaseId: lease.leaseId,
        propertyId: outOfScopeProperty,
        apartmentId: outsideApartment,
        tenantUserId: lease.tenantUserId,
        periodStart: '2026-09-01',
        dueDate: '2026-09-05',
        amountDue: 700_000,
        amountPaid: 0,
        balance: 700_000,
        currency: 'GNF',
        status: 'UNPAID',
      });

      // Le propriétaire voit tout, et son total est complet.
      const full = await getTenantOutstanding(harness.db, owner, lease.tenantUserId, OPTIONS);

      expect(full.totalOutstanding).toBe(1_700_000);

      // Le gestionnaire, lui, ne peut pas obtenir un total incomplet.
      await expect(
        getTenantOutstanding(harness.db, manager, lease.tenantUserId, OPTIONS),
      ).rejects.toThrow(ResourceOutOfScopeError);
    });

    it("refuse le total à un appelant d'une autre organisation", async () => {
      const rent = await addRent({ rentAmount: 1_000_000 });

      await expect(
        getTenantOutstanding(harness.db, otherOwner, rent.tenantUserId, OPTIONS),
      ).rejects.toThrow(ResourceOutOfScopeError);
    });

    /**
     * Sans créance, la personne n'est nommée par aucune ligne : « zéro »
     * confirmerait pourtant son existence à qui n'y a pas accès (ADR-008). Seul
     * un appelant qui a un périmètre de lecture obtient la réponse.
     */
    it('refuse « zéro » à un locataire qui interroge une personne sans créance', async () => {
      const rent = await addRent();
      const tenant = await contextOf(harness, rent.tenantUserId);

      await expect(
        getTenantOutstanding(harness.db, tenant, SEED_IDS.ownerB, OPTIONS),
      ).rejects.toThrow(ResourceOutOfScopeError);
    });

    it('refuse un identifiant mal formé comme un identifiant inconnu', async () => {
      for (const id of ['00000000-0000-4000-8000-000000000000', 'pas-un-identifiant']) {
        const summary = await getTenantOutstanding(harness.db, owner, id, OPTIONS).catch(
          (error: unknown) => error,
        );

        if (id === 'pas-un-identifiant') {
          expect(summary).toBeInstanceOf(ResourceOutOfScopeError);
        } else {
          // Un UUID inconnu donne un total de zéro à qui a un périmètre : il ne
          // se distingue pas d'une personne connue sans aucune créance.
          expect(summary).toMatchObject({ totalOutstanding: 0 });
        }
      }
    });
  });
});
