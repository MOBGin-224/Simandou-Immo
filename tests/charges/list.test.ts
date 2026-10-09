import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { ResourceOutOfScopeError } from '../../src/lib/authorization/service';
import { ChargeValidationError } from '../../src/modules/charges/errors';
import {
  cancelCharge,
  listChargeAllocations,
  listCharges,
} from '../../src/modules/charges/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  OPTIONS,
  addApartment,
  addBillableLease,
  addCharge,
  addProperty,
  addPublishedCharge,
  addScope,
  allocationsOfCharge,
  contextOf,
  freshPhone,
  passwordHasher,
  setAllocationPaid,
} from '../helpers/charges';

/**
 * MVP-BACKLOG-054 et API sections 26 et 30 : les deux listes du lot.
 *
 * Celle des CHARGES, qui est l'historique des factures d'un immeuble, et celle
 * des CRÉANCES de charge, qui est le pendant exact de la liste des loyers.
 *
 * L'exigence qui gouverne les deux est API section 67 : les objets non
 * autorisés ne quittent pas le serveur. Le périmètre est donc traduit en SQL, et
 * ces tests le vérifient depuis trois points de vue, le propriétaire, le
 * gestionnaire attribué et celui qui ne l'est pas.
 */
describe('Listes des charges et de leurs créances', () => {
  let harness: TestDatabase;
  let owner: Awaited<ReturnType<typeof contextOf>>;
  let manager: Awaited<ReturnType<typeof contextOf>>;
  let otherOwner: Awaited<ReturnType<typeof contextOf>>;
  let tenant: Awaited<ReturnType<typeof contextOf>>;

  let inScopeProperty: string;
  let outOfScopeProperty: string;
  let tenantUserId: string;

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    owner = await contextOf(harness, SEED_IDS.ownerA);

    inScopeProperty = await addProperty(harness, 'Résidence Kipé');
    outOfScopeProperty = await addProperty(harness, 'Résidence Dixinn Nord');

    const occupied = await addApartment(harness, inScopeProperty, 'A01');

    await addApartment(harness, inScopeProperty, 'A02');
    await addApartment(harness, outOfScopeProperty, 'B01');
    await addScope(harness, SEED_IDS.accessManagerA, inScopeProperty);

    const lease = await addBillableLease(harness, {
      apartmentId: occupied,
      tenantApartmentId: occupied,
      ownerContext: owner,
      hashPassword: passwordHasher(harness),
      phone: freshPhone(),
      startDate: '2026-01-01',
    });

    tenantUserId = lease.tenantUserId;

    manager = await contextOf(harness, SEED_IDS.managerA);
    otherOwner = await contextOf(harness, SEED_IDS.ownerB);
    tenant = await contextOf(harness, tenantUserId);

    // Deux factures publiées et une annulée dans le périmètre, une hors
    // périmètre : de quoi éprouver chaque filtre sans les refabriquer à chaque
    // test.
    await addPublishedCharge(harness, {
      propertyId: inScopeProperty,
      context: owner,
      type: 'WATER',
      periodStart: '2026-09',
      dueDate: '2026-09-10',
      totalAmount: 600_000,
    });

    await addPublishedCharge(harness, {
      propertyId: inScopeProperty,
      context: owner,
      type: 'ELECTRICITY',
      periodStart: '2026-10',
      dueDate: '2026-10-10',
      totalAmount: 1_000_000,
    });

    const cancelled = await addCharge(harness, {
      propertyId: inScopeProperty,
      context: owner,
      type: 'CLEANING',
      periodStart: '2026-08',
      dueDate: '2026-08-10',
    });

    await cancelCharge(harness.db, owner, cancelled.id, OPTIONS);

    await addPublishedCharge(harness, {
      propertyId: outOfScopeProperty,
      context: owner,
      type: 'SECURITY',
      periodStart: '2026-10',
      dueDate: '2026-10-10',
      totalAmount: 400_000,
    });
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('Liste des charges', () => {
    it('montre toutes les charges du périmètre, la plus récente d abord', async () => {
      const collection = await listCharges(harness.db, owner);

      expect(collection.meta.total).toBe(4);
      expect(collection.charges.map((charge) => charge.periodStart)).toEqual([
        '2026-10-01',
        '2026-10-01',
        '2026-09-01',
        '2026-08-01',
      ]);
    });

    it('filtre par immeuble, par période, par nature et par statut', async () => {
      expect(
        (await listCharges(harness.db, owner, { propertyId: inScopeProperty })).meta.total,
      ).toBe(3);
      expect((await listCharges(harness.db, owner, { period: '2026-10' })).meta.total).toBe(2);
      expect((await listCharges(harness.db, owner, { type: 'WATER' })).meta.total).toBe(1);
      expect((await listCharges(harness.db, owner, { status: 'PUBLISHED' })).meta.total).toBe(3);
      expect((await listCharges(harness.db, owner, { status: 'CANCELLED' })).meta.total).toBe(1);
      expect((await listCharges(harness.db, owner, { status: 'DRAFT' })).meta.total).toBe(0);
    });

    /**
     * Le brouillon n'est PAS masqué par défaut, à la différence des loyers soldés
     * sur leur écran : une charge en attente de publication attend une décision,
     * et un brouillon caché serait un brouillon oublié.
     */
    it('compte les brouillons dans la liste par défaut', async () => {
      const draft = await addCharge(harness, {
        propertyId: inScopeProperty,
        context: owner,
        periodStart: '2026-07',
        dueDate: '2026-07-10',
      });

      const collection = await listCharges(harness.db, owner);

      expect(collection.charges.map((charge) => charge.id)).toContain(draft.id);

      await cancelCharge(harness.db, owner, draft.id, OPTIONS);
    });

    it('annonce le nombre de parts et le reste à encaisser de chaque charge', async () => {
      const [charge] = (await listCharges(harness.db, owner, { type: 'WATER' })).charges;

      expect(charge?.unitCount).toBe(2);
      expect(charge?.totalOutstanding).toBe(600_000);
    });

    /** Le total porte sur l'ENSEMBLE du filtre, et non sur la page affichée. */
    it('calcule le reste à encaisser sur tout le filtre', async () => {
      const collection = await listCharges(harness.db, owner, { pageSize: 1 });

      expect(collection.charges).toHaveLength(1);
      expect(collection.totalOutstanding).toBe(2_000_000);
      expect(collection.currency).toBe('GNF');
    });

    it('borne la taille de page demandée', async () => {
      await expect(listCharges(harness.db, owner, { pageSize: 500 })).rejects.toBeInstanceOf(
        ChargeValidationError,
      );
    });

    describe('Périmètre', () => {
      it('réduit la liste du gestionnaire à ses immeubles', async () => {
        const collection = await listCharges(harness.db, manager);
        const scoped = await listCharges(harness.db, owner, { propertyId: inScopeProperty });

        expect(collection.charges.every((charge) => charge.property.id === inScopeProperty)).toBe(
          true,
        );
        // Exactement ce que le propriétaire voit de cet immeuble, et rien de
        // l'autre : le périmètre restreint, il ne filtre pas après lecture.
        expect(collection.meta.total).toBe(scoped.meta.total);
      });

      /**
       * Le propriétaire de l'autre organisation a bien un périmètre, le sien :
       * il reçoit donc une liste VIDE et non « inexistant », parce que la
       * question « mes charges » a un sens pour lui, et sa réponse est aucune.
       */
      it("ne laisse voir aucune charge à l'autre organisation", async () => {
        const collection = await listCharges(harness.db, otherOwner);

        expect(collection.charges).toHaveLength(0);
        expect(collection.meta.total).toBe(0);
      });

      /**
       * Un locataire porte `charge.read`, mais pour SES créances : la liste des
       * charges de l'immeuble lui répond « inexistant », son rattachement étant
       * lui-même (BR-021). C'est la même frontière que pour les loyers.
       */
      it('refuse la liste des charges au locataire', async () => {
        await expect(listCharges(harness.db, tenant)).rejects.toBeInstanceOf(
          ResourceOutOfScopeError,
        );
      });

      it("ignore un immeuble demandé hors périmètre plutôt que de l'ouvrir", async () => {
        const collection = await listCharges(harness.db, manager, {
          propertyId: outOfScopeProperty,
        });

        expect(collection.meta.total).toBe(0);
      });
    });
  });

  describe('Liste des créances de charge', () => {
    it('montre les créances du périmètre, échéance croissante', async () => {
      const collection = await listChargeAllocations(harness.db, owner, {}, OPTIONS);

      expect(collection.meta.total).toBe(5);
      expect(collection.allocations.map((allocation) => allocation.dueDate)).toEqual([
        '2026-09-10',
        '2026-09-10',
        '2026-10-10',
        '2026-10-10',
        '2026-10-10',
      ]);
    });

    it('filtre par charge, par logement, par locataire, par période et par statut', async () => {
      const [water] = (await listCharges(harness.db, owner, { type: 'WATER' })).charges;
      const allocations = await allocationsOfCharge(harness, water?.id as string);

      expect(
        (await listChargeAllocations(harness.db, owner, { chargeId: water?.id }, OPTIONS)).meta
          .total,
      ).toBe(2);
      expect(
        (
          await listChargeAllocations(
            harness.db,
            owner,
            { apartmentId: allocations[0]?.apartmentId },
            OPTIONS,
          )
        ).meta.total,
      ).toBe(2);
      expect(
        (await listChargeAllocations(harness.db, owner, { tenantId: tenantUserId }, OPTIONS)).meta
          .total,
      ).toBe(2);
      expect(
        (await listChargeAllocations(harness.db, owner, { period: '2026-09' }, OPTIONS)).meta.total,
      ).toBe(2);
      expect(
        (await listChargeAllocations(harness.db, owner, { status: 'OUTSTANDING' }, OPTIONS)).meta
          .total,
      ).toBe(5);
    });

    /**
     * BR-052 : la créance d'un logement vacant reste visible du bailleur. C'est
     * elle qui lui dit quelle part de la facture reste à sa charge.
     */
    it('montre les créances sans locataire redevable', async () => {
      const collection = await listChargeAllocations(harness.db, owner, {}, OPTIONS);
      const vacant = collection.allocations.filter((allocation) => allocation.tenant === null);

      expect(vacant.length).toBeGreaterThan(0);
    });

    it('porte le statut d affichage, « À venir » comprise', async () => {
      const collection = await listChargeAllocations(
        harness.db,
        owner,
        { period: '2026-10' },
        { now: new Date('2026-10-01T08:00:00.000Z') },
      );

      expect(collection.allocations.every((allocation) => allocation.status === 'UNPAID')).toBe(
        true,
      );
      expect(
        collection.allocations.every((allocation) => allocation.displayStatus === 'UPCOMING'),
      ).toBe(true);
    });

    it('ne compte dans le total que le solde des créances ouvertes', async () => {
      const [water] = (await listCharges(harness.db, owner, { type: 'WATER' })).charges;
      const [allocation] = await allocationsOfCharge(harness, water?.id as string);

      await setAllocationPaid(harness, allocation?.id as string, 300_000, 'PAID');

      const collection = await listChargeAllocations(
        harness.db,
        owner,
        { chargeId: water?.id },
        OPTIONS,
      );

      expect(collection.totalOutstanding).toBe(300_000);

      // Remise en l'état pour les tests suivants.
      await setAllocationPaid(harness, allocation?.id as string, 0, 'PARTIALLY_PAID');
    });

    it('réduit la liste du gestionnaire à ses immeubles et refuse le locataire', async () => {
      const scoped = await listChargeAllocations(harness.db, manager, {}, OPTIONS);

      expect(
        scoped.allocations.every((allocation) => allocation.organizationId !== undefined),
      ).toBe(true);
      expect(scoped.meta.total).toBe(4);

      await expect(listChargeAllocations(harness.db, tenant, {}, OPTIONS)).rejects.toBeInstanceOf(
        ResourceOutOfScopeError,
      );
    });
  });
});
