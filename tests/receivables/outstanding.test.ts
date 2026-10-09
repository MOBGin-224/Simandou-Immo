import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { ResourceOutOfScopeError } from '../../src/lib/authorization/service';
import { cancelCharge } from '../../src/modules/charges/service';
import { getMyOutstanding, getTenantOutstanding } from '../../src/modules/receivables/service';
import { generateRents, runOverdueJob } from '../../src/modules/rents/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  OPTIONS,
  PERIOD,
  addApartment,
  addBillableLease,
  addCharge,
  addProperty,
  addPublishedCharge,
  addScope,
  allocationsOfCharge,
  contextOf,
  freshPhone,
  installmentOf,
  passwordHasher,
  setPaid,
} from '../helpers/charges';

/**
 * API section 18 : le total dû d'un locataire, et BR-039 qui le définit.
 *
 * Quatre exigences s'y vérifient. Le total est calculé CÔTÉ SERVEUR, la section
 * l'écrit noir sur blanc : « le frontend ne le recompose jamais ». Il ne compte
 * que les créances OUVERTES. Chaque élément porte un `kind`. Et depuis le Lot
 * 10, il agrège les DEUX créances du MVP, loyers et charges confondus (DEC-005,
 * BR-039, BR-055) : c'est l'exemple même de la décision verrouillée, « loyer
 * 2 500 000 plus charge eau 300 000 égale 2 800 000 dû ».
 *
 * Le fichier a changé de dossier au Lot 10 avec le cas d'usage : le total dû
 * n'appartient plus au module Loyers, qui ne pouvait pas répondre seul à une
 * question qui additionne les deux types.
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

  /**
   * DEC-005, et c'est la raison pour laquelle le lot des charges passe avant
   * celui des paiements : le total dû additionne les deux types de créance, et un
   * paiement global devra les solder dans un ordre déterministe (DEC-022).
   */
  describe('Les deux créances réunies', () => {
    it('additionne le loyer et la part de charge de la personne', async () => {
      const property = await addProperty(harness, 'Résidence Totale');
      const apartment = await addApartment(harness, property, 'T01');

      const lease = await addBillableLease(harness, {
        apartmentId: apartment,
        tenantApartmentId: apartment,
        ownerContext: owner,
        hashPassword,
        phone: freshPhone(),
        startDate: '2026-01-01',
        rentAmount: 2_500_000,
        dueDay: 5,
      });

      await generateRents(harness.db, owner, { period: '2026-10', propertyId: property }, OPTIONS);

      await addPublishedCharge(harness, {
        propertyId: property,
        context: owner,
        type: 'WATER',
        periodStart: '2026-10',
        dueDate: '2026-10-10',
        totalAmount: 300_000,
      });

      const summary = await getTenantOutstanding(harness.db, owner, lease.tenantUserId, OPTIONS);

      expect(summary.totalOutstanding).toBe(2_800_000);
      expect(summary.receivables.map((receivable) => receivable.kind)).toEqual(['RENT', 'CHARGE']);
      expect(summary.receivables.map((receivable) => receivable.balance)).toEqual([
        2_500_000, 300_000,
      ]);
    });

    it('porte le type CHARGE et le libellé que la section 18 documente', async () => {
      const property = await addProperty(harness, 'Résidence Libellé');
      const apartment = await addApartment(harness, property, 'L01');

      const lease = await addBillableLease(harness, {
        apartmentId: apartment,
        tenantApartmentId: apartment,
        ownerContext: owner,
        hashPassword,
        phone: freshPhone(),
        startDate: '2026-01-01',
      });

      await addPublishedCharge(harness, {
        propertyId: property,
        context: owner,
        type: 'WATER',
        periodStart: '2026-10',
        dueDate: '2026-10-10',
        totalAmount: 450_000,
      });

      const summary = await getTenantOutstanding(harness.db, owner, lease.tenantUserId, OPTIONS);
      const [receivable] = summary.receivables;

      expect(receivable?.kind).toBe('CHARGE');
      expect(receivable?.label).toBe('Eau octobre 2026');
      expect(receivable?.amountDue).toBe(450_000);
      expect(receivable?.periodStart).toBe('2026-10-01');
    });

    /**
     * L'ordre d'allocation de DEC-022 : échéance croissante, puis LOYER AVANT
     * CHARGE à date égale. C'est l'ordre dans lequel un paiement global les
     * soldera, donc le seul ordre d'affichage qui ne mentira pas sur ce qu'un
     * versement règle.
     */
    it('place le loyer avant la charge à date d échéance égale', async () => {
      const property = await addProperty(harness, 'Résidence Ordre');
      const apartment = await addApartment(harness, property, 'R01');

      const lease = await addBillableLease(harness, {
        apartmentId: apartment,
        tenantApartmentId: apartment,
        ownerContext: owner,
        hashPassword,
        phone: freshPhone(),
        startDate: '2026-01-01',
        dueDay: 10,
      });

      await generateRents(harness.db, owner, { period: '2026-10', propertyId: property }, OPTIONS);

      await addPublishedCharge(harness, {
        propertyId: property,
        context: owner,
        periodStart: '2026-10',
        dueDate: '2026-10-10',
        totalAmount: 100_000,
      });

      const summary = await getTenantOutstanding(harness.db, owner, lease.tenantUserId, OPTIONS);

      expect(summary.receivables.map((receivable) => receivable.dueDate)).toEqual([
        '2026-10-10',
        '2026-10-10',
      ]);
      expect(summary.receivables.map((receivable) => receivable.kind)).toEqual(['RENT', 'CHARGE']);
    });

    it('écarte du total les créances d une charge annulée', async () => {
      const property = await addProperty(harness, 'Résidence Annulée');
      const apartment = await addApartment(harness, property, 'N01');

      const lease = await addBillableLease(harness, {
        apartmentId: apartment,
        tenantApartmentId: apartment,
        ownerContext: owner,
        hashPassword,
        phone: freshPhone(),
        startDate: '2026-01-01',
      });

      const charge = await addPublishedCharge(harness, {
        propertyId: property,
        context: owner,
        totalAmount: 700_000,
      });

      expect(
        (await getTenantOutstanding(harness.db, owner, lease.tenantUserId, OPTIONS))
          .totalOutstanding,
      ).toBe(700_000);

      await cancelCharge(harness.db, owner, charge.id, OPTIONS);

      const summary = await getTenantOutstanding(harness.db, owner, lease.tenantUserId, OPTIONS);

      expect(summary.totalOutstanding).toBe(0);
      expect(summary.receivables).toHaveLength(0);
    });

    /** Une charge en brouillon ne doit RIEN à personne (BR-052). */
    it('ignore une charge restée en brouillon', async () => {
      const property = await addProperty(harness, 'Résidence Brouillon');
      const apartment = await addApartment(harness, property, 'B01');

      const lease = await addBillableLease(harness, {
        apartmentId: apartment,
        tenantApartmentId: apartment,
        ownerContext: owner,
        hashPassword,
        phone: freshPhone(),
        startDate: '2026-01-01',
      });

      await addCharge(harness, { propertyId: property, context: owner, totalAmount: 800_000 });

      const summary = await getTenantOutstanding(harness.db, owner, lease.tenantUserId, OPTIONS);

      expect(summary.totalOutstanding).toBe(0);
    });

    /**
     * La part d'un logement vacant n'a aucune personne redevable (BR-052) : elle
     * n'entre donc dans le total de personne, tout en restant visible du
     * bailleur.
     */
    it("n ajoute au total de personne la part d'un logement vacant", async () => {
      const property = await addProperty(harness, 'Résidence Vacante');
      const occupied = await addApartment(harness, property, 'V01');

      await addApartment(harness, property, 'V02');

      const lease = await addBillableLease(harness, {
        apartmentId: occupied,
        tenantApartmentId: occupied,
        ownerContext: owner,
        hashPassword,
        phone: freshPhone(),
        startDate: '2026-01-01',
      });

      const charge = await addPublishedCharge(harness, {
        propertyId: property,
        context: owner,
        totalAmount: 600_000,
      });

      const summary = await getTenantOutstanding(harness.db, owner, lease.tenantUserId, OPTIONS);

      expect(summary.totalOutstanding).toBe(300_000);
      expect(await allocationsOfCharge(harness, charge.id)).toHaveLength(2);
    });

    it('donne au locataire son propre total, loyer et charges confondus', async () => {
      const property = await addProperty(harness, 'Résidence Locataire');
      const apartment = await addApartment(harness, property, 'C01');

      const lease = await addBillableLease(harness, {
        apartmentId: apartment,
        tenantApartmentId: apartment,
        ownerContext: owner,
        hashPassword,
        phone: freshPhone(),
        startDate: '2026-01-01',
        rentAmount: 1_000_000,
        dueDay: 5,
      });

      await generateRents(harness.db, owner, { period: '2026-10', propertyId: property }, OPTIONS);

      await addPublishedCharge(harness, {
        propertyId: property,
        context: owner,
        totalAmount: 250_000,
      });

      const tenant = await contextOf(harness, lease.tenantUserId);
      const summary = await getMyOutstanding(harness.db, tenant, OPTIONS);

      expect(summary.totalOutstanding).toBe(1_250_000);
      expect(summary.receivables).toHaveLength(2);
    });

    /**
     * Le pendant, pour les charges, du total partiel refusé sur les loyers : la
     * permission est portée par CHAQUE créance, et `charge.read` ne s'exerce que
     * sur le périmètre de l'appelant.
     */
    it('refuse un total dont une créance de charge échappe au périmètre', async () => {
      const outside = await addProperty(harness, 'Résidence Hors Périmètre');
      const apartment = await addApartment(harness, outside, 'H01');

      const lease = await addBillableLease(harness, {
        apartmentId: apartment,
        tenantApartmentId: apartment,
        ownerContext: owner,
        hashPassword,
        phone: freshPhone(),
        startDate: '2026-01-01',
      });

      await addPublishedCharge(harness, {
        propertyId: outside,
        context: owner,
        totalAmount: 120_000,
      });

      await expect(
        getTenantOutstanding(harness.db, manager, lease.tenantUserId, OPTIONS),
      ).rejects.toThrow(ResourceOutOfScopeError);
    });
  });
});
