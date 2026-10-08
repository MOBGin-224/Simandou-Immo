import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { ResourceOutOfScopeError } from '../../src/lib/authorization/service';
import { generateRents, getRent, listMyRents, listRents } from '../../src/modules/rents/service';
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
 * MVP-BACKLOG-039 : liste et fiche des échéances, et MVP-BACKLOG-038 pour le
 * statut affiché.
 *
 * Deux points de fond s'y vérifient. Le périmètre, qui ne doit laisser sortir
 * aucune créance d'un autre bailleur (API section 67). Et « À venir », qui est
 * une DÉRIVATION d'affichage et jamais une valeur stockée (BR-037) : la colonne
 * doit rester `UNPAID` pendant que l'écran lit autre chose.
 */
describe('Liste des échéances de loyer', () => {
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

    return addApartment(harness, propertyId, `L${String(counter).padStart(3, '0')}`);
  };

  const addLease = async (
    options: { propertyId?: string; startDate?: string; dueDay?: number; rentAmount?: number } = {},
  ) =>
    addBillableLease(harness, {
      apartmentId: await freshApartment(options.propertyId),
      tenantApartmentId: await freshApartment(),
      ownerContext: owner,
      hashPassword,
      phone: freshPhone(),
      startDate: options.startDate ?? '2026-01-01',
      dueDay: options.dueDay,
      rentAmount: options.rentAmount,
    });

  /** Bail facturé sur la période en cours, avec l'échéance qui en est née. */
  const addRent = async (
    options: { propertyId?: string; dueDay?: number; rentAmount?: number } = {},
  ) => {
    const lease = await addLease(options);

    await generateRents(harness.db, owner, { propertyId: options.propertyId }, OPTIONS);

    const installment = await installmentOf(harness, lease.leaseId, PERIOD);

    if (!installment) throw new Error("L'échéance de test n'a pas été générée.");

    return { ...lease, installment };
  };

  const idsOf = async (context = owner, query: Record<string, unknown> = {}) =>
    (await listRents(harness.db, context, query, OPTIONS)).rents.map((rent) => rent.id);

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

  describe('Périmètre', () => {
    it('montre au gestionnaire les échéances de son périmètre seulement', async () => {
      const inside = await addRent();
      const outside = await addRent({ propertyId: outOfScopeProperty });

      const visible = await idsOf(manager, { status: 'ALL' });

      expect(visible).toContain(inside.installment.id);
      expect(visible).not.toContain(outside.installment.id);
    });

    it('montre au propriétaire toute son organisation', async () => {
      const inside = await addRent();
      const outside = await addRent({ propertyId: outOfScopeProperty });

      const visible = await idsOf(owner, { status: 'ALL' });

      expect(visible).toContain(inside.installment.id);
      expect(visible).toContain(outside.installment.id);
    });

    it("ne montre rien au propriétaire d'une autre organisation", async () => {
      const rent = await addRent();

      expect(await idsOf(otherOwner, { status: 'ALL' })).not.toContain(rent.installment.id);
    });

    /**
     * Même frontière que pour les baux : le locataire consulte SES loyers par son
     * espace, pas par cette liste, son rattachement étant lui-même (BR-021).
     */
    it('répond « inexistant » à un locataire', async () => {
      const rent = await addRent();
      const tenant = await contextOf(harness, rent.tenantUserId);

      await expect(listRents(harness.db, tenant, {}, OPTIONS)).rejects.toThrow(
        ResourceOutOfScopeError,
      );
    });
  });

  /**
   * BR-037 : « À venir » est une dérivation de présentation, le backend ne la
   * persiste jamais. Le test vérifie les DEUX faces : ce que l'écran lit, et ce
   * que la colonne contient.
   */
  describe('Statut affiché, « À venir » comprise', () => {
    it('affiche « À venir » une échéance impayée non encore due, sans la stocker', async () => {
      const rent = await addRent({ dueDay: 28 });

      const [item] = (await listRents(harness.db, owner, { leaseId: rent.leaseId }, OPTIONS)).rents;

      expect(item?.status).toBe('UNPAID');
      expect(item?.displayStatus).toBe('UPCOMING');

      const stored = await installmentOf(harness, rent.leaseId, PERIOD);

      expect(stored?.status).toBe('UNPAID');
    });

    it('affiche « impayée » une échéance dont le jour est passé', async () => {
      const rent = await addRent({ dueDay: 1 });

      const [item] = (await listRents(harness.db, owner, { leaseId: rent.leaseId }, OPTIONS)).rents;

      expect(item?.displayStatus).toBe('UNPAID');
    });

    it('affiche « impayée » une échéance due le jour même', async () => {
      const rent = await addRent({ dueDay: 2 });

      const [item] = (await listRents(harness.db, owner, { leaseId: rent.leaseId }, OPTIONS)).rents;

      expect(item?.displayStatus).toBe('UNPAID');
    });

    /**
     * Un paiement partiel reçu avant l'échéance ne s'annonce PAS « À venir » :
     * de l'argent a déjà été versé, et l'effacer de l'affichage serait un
     * mensonge. La règle du document ne vise que `UNPAID`.
     */
    it('n affiche jamais « À venir » une échéance déjà partiellement payée', async () => {
      const rent = await addRent({ dueDay: 28, rentAmount: 1_000_000 });

      await setPaid(harness, rent.installment.id, 400_000, 'PARTIALLY_PAID');

      const [item] = (await listRents(harness.db, owner, { leaseId: rent.leaseId }, OPTIONS)).rents;

      expect(item?.displayStatus).toBe('PARTIALLY_PAID');
    });
  });

  describe('Filtres', () => {
    it('ne garde par défaut que les créances ouvertes', async () => {
      const open = await addRent();
      const paid = await addRent();

      await setPaid(harness, paid.installment.id, paid.installment.amountDue, 'PAID');

      const visible = await idsOf(owner);

      expect(visible).toContain(open.installment.id);
      expect(visible).not.toContain(paid.installment.id);
    });

    it('filtre sur les créances soldées', async () => {
      const open = await addRent();
      const paid = await addRent();

      await setPaid(harness, paid.installment.id, paid.installment.amountDue, 'PAID');

      const visible = await idsOf(owner, { status: 'PAID' });

      expect(visible).toContain(paid.installment.id);
      expect(visible).not.toContain(open.installment.id);
    });

    it('filtre sur « À venir », qui n est pourtant pas une valeur de colonne', async () => {
      const upcoming = await addRent({ dueDay: 28 });
      const due = await addRent({ dueDay: 1 });

      const visible = await idsOf(owner, { status: 'UPCOMING' });

      expect(visible).toContain(upcoming.installment.id);
      expect(visible).not.toContain(due.installment.id);
    });

    it('filtre par immeuble, par logement, par locataire et par bail', async () => {
      const rent = await addRent();
      const other = await addRent();

      for (const query of [
        { propertyId: inScopeProperty, expected: true },
        { apartmentId: rent.apartmentId, expected: true },
        { tenantId: rent.tenantUserId, expected: true },
        { leaseId: rent.leaseId, expected: true },
        { apartmentId: other.apartmentId, expected: false },
      ]) {
        const { expected, ...filters } = query;
        const visible = await idsOf(owner, { ...filters, status: 'ALL' });

        expect(visible.includes(rent.installment.id)).toBe(expected);
      }
    });

    it('filtre par période, écrite en AAAA-MM', async () => {
      const rent = await addRent();

      await generateRents(harness.db, owner, { period: '2026-08' }, OPTIONS);

      const october = await idsOf(owner, {
        leaseId: rent.leaseId,
        period: '2026-10',
        status: 'ALL',
      });
      const august = await idsOf(owner, {
        leaseId: rent.leaseId,
        period: '2026-08',
        status: 'ALL',
      });

      expect(october).toHaveLength(1);
      expect(august).toHaveLength(1);
      expect(october[0]).not.toBe(august[0]);
    });

    /**
     * Un immeuble hors périmètre ne donne aucune ligne et ne se distingue pas d'un
     * immeuble vide : l'inconnu et l'interdit restent indiscernables (ADR-008).
     */
    it('ne laisse pas un filtre élargir le périmètre', async () => {
      const outside = await addRent({ propertyId: outOfScopeProperty });

      const visible = await idsOf(manager, { propertyId: outOfScopeProperty, status: 'ALL' });

      expect(visible).not.toContain(outside.installment.id);
      expect(visible).toHaveLength(0);
    });
  });

  /**
   * BR-039 : le total dû est la somme des soldes des créances OUVERTES. Calculé
   * côté serveur sur l'ENSEMBLE du filtre, et non sur la page affichée.
   */
  describe('Total dû du résultat', () => {
    it('additionne les soldes ouverts, et ignore les créances soldées', async () => {
      const property = await addProperty(harness, 'Résidence Totaux');

      const first = await addRent({ propertyId: property, rentAmount: 1_000_000 });
      const second = await addRent({ propertyId: property, rentAmount: 2_000_000 });
      const paid = await addRent({ propertyId: property, rentAmount: 5_000_000 });

      await setPaid(harness, paid.installment.id, 5_000_000, 'PAID');
      await setPaid(harness, second.installment.id, 500_000, 'PARTIALLY_PAID');

      const collection = await listRents(harness.db, owner, { propertyId: property }, OPTIONS);

      expect(collection.totalOutstanding).toBe(1_000_000 + 1_500_000);
      expect(collection.currency).toBe('GNF');
      expect(collection.rents.map((rent) => rent.id)).toContain(first.installment.id);
    });

    it('compte au-delà de la page affichée', async () => {
      const property = await addProperty(harness, 'Résidence Pagination');

      for (let index = 0; index < 3; index += 1) {
        await addRent({ propertyId: property, rentAmount: 1_000_000 });
      }

      const collection = await listRents(
        harness.db,
        owner,
        { propertyId: property, pageSize: 1 },
        OPTIONS,
      );

      expect(collection.rents).toHaveLength(1);
      expect(collection.meta.total).toBe(3);
      expect(collection.totalOutstanding).toBe(3_000_000);
    });
  });

  /**
   * L'écran sert à réclamer de l'argent : l'impayé le plus ancien doit venir en
   * tête, et les créances soldées descendre en bas comme simple historique.
   */
  describe('Ordre', () => {
    it('place les créances ouvertes avant les soldées, et le retard le plus vieux en tête', async () => {
      const property = await addProperty(harness, 'Résidence Ordre');

      const lease = await addLease({ propertyId: property, dueDay: 5 });

      await generateRents(harness.db, owner, { period: '2026-07', propertyId: property }, OPTIONS);
      await generateRents(harness.db, owner, { period: '2026-08', propertyId: property }, OPTIONS);
      await generateRents(harness.db, owner, { period: '2026-09', propertyId: property }, OPTIONS);

      const july = await installmentOf(harness, lease.leaseId, '2026-07-01');

      if (!july) throw new Error("L'échéance de juillet n'a pas été générée.");

      await setPaid(harness, july.id, july.amountDue, 'PAID');

      const items = (
        await listRents(harness.db, owner, { propertyId: property, status: 'ALL' }, OPTIONS)
      ).rents;

      expect(items.map((item) => item.periodStart)).toEqual([
        '2026-08-01',
        '2026-09-01',
        '2026-07-01',
      ]);
    });
  });

  describe('Fiche d une échéance', () => {
    it('ouvre la fiche au propriétaire, avec son logement et sa personne', async () => {
      const rent = await addRent();

      const view = await getRent(harness.db, owner, rent.installment.id, OPTIONS);

      expect(view.id).toBe(rent.installment.id);
      expect(view.leaseId).toBe(rent.leaseId);
      expect(view.apartment.propertyId).toBe(inScopeProperty);
      expect(view.apartment.propertyName).toBe('Résidence Kipé');
      expect(view.tenant.userId).toBe(rent.tenantUserId);
      expect(view.tenant.fullName).toBeTruthy();
    });

    /** Le locataire lit SA créance : c'est la personne redevable qui le lui ouvre. */
    it('ouvre sa propre fiche au locataire', async () => {
      const rent = await addRent();
      const tenant = await contextOf(harness, rent.tenantUserId);

      const view = await getRent(harness.db, tenant, rent.installment.id, OPTIONS);

      expect(view.id).toBe(rent.installment.id);
    });

    it("refuse la fiche d'un autre locataire", async () => {
      const mine = await addRent();
      const other = await addRent();
      const tenant = await contextOf(harness, mine.tenantUserId);

      await expect(getRent(harness.db, tenant, other.installment.id, OPTIONS)).rejects.toThrow(
        ResourceOutOfScopeError,
      );
    });

    it('refuse un identifiant inconnu, ou mal formé, de la même façon', async () => {
      for (const id of ['00000000-0000-4000-8000-000000000000', 'pas-un-identifiant']) {
        await expect(getRent(harness.db, owner, id, OPTIONS)).rejects.toThrow(
          ResourceOutOfScopeError,
        );
      }
    });
  });

  describe('Espace locataire', () => {
    it('montre au locataire ses propres échéances, et rien d autre', async () => {
      const mine = await addRent();
      const other = await addRent();
      const tenant = await contextOf(harness, mine.tenantUserId);

      const items = await listMyRents(harness.db, tenant, OPTIONS);

      expect(items.map((item) => item.id)).toContain(mine.installment.id);
      expect(items.map((item) => item.id)).not.toContain(other.installment.id);
    });

    it('ne montre rien à une personne sans aucune échéance', async () => {
      const owner = await contextOf(harness, SEED_IDS.ownerA);

      expect(await listMyRents(harness.db, owner, OPTIONS)).toHaveLength(0);
    });
  });
});
