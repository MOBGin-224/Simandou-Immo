import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import type { ReceivableStatus } from '../../src/modules/rents/constants';
import { generateRents } from '../../src/modules/rents/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  OPTIONS,
  PERIOD,
  addApartment,
  addBillableLease,
  addProperty,
  contextOf,
  freshPhone,
  installmentOf,
  passwordHasher,
} from '../helpers/rents';

/**
 * MVP-BACKLOG-036 : ce que la BASE refuse, quoi qu'écrive le code.
 *
 * Les invariants financiers de la section 21 et l'unicité de la section 20 sont
 * portés par des contraintes, et non par le seul cas d'usage. Ce fichier les
 * attaque directement, en écrivant SANS passer par le service : c'est le seul
 * moyen de prouver qu'une erreur future dans un module, ou une migration de
 * données écrite à la main, serait arrêtée.
 */
describe('Contraintes de la table des échéances', () => {
  let harness: TestDatabase;
  let owner: Awaited<ReturnType<typeof contextOf>>;
  let property: string;
  let hashPassword: (password: string) => Promise<string>;

  let lease: { leaseId: string; tenantUserId: string; apartmentId: string };

  let counter = 0;
  const freshApartment = async () => {
    counter += 1;

    return addApartment(harness, property, `C${String(counter).padStart(3, '0')}`);
  };

  /** Ligne valide, dont chaque test ne casse qu'UN champ. */
  const validRow = () => ({
    organizationId: SEED_IDS.organizationA,
    leaseId: lease.leaseId,
    propertyId: property,
    apartmentId: lease.apartmentId,
    tenantUserId: lease.tenantUserId,
    periodStart: '2026-05-01',
    dueDate: '2026-05-05',
    amountDue: 1_000_000,
    amountPaid: 0,
    balance: 1_000_000,
    currency: 'GNF',
    status: 'UNPAID' as ReceivableStatus,
  });

  const insert = (values: Partial<ReturnType<typeof validRow>>) =>
    harness.db.insert(harness.schema.rentInstallments).values({ ...validRow(), ...values });

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    property = await addProperty(harness, 'Résidence Contraintes');
    owner = await contextOf(harness, SEED_IDS.ownerA);
    hashPassword = passwordHasher(harness);

    lease = await addBillableLease(harness, {
      apartmentId: await freshApartment(),
      tenantApartmentId: await freshApartment(),
      ownerContext: owner,
      hashPassword,
      phone: freshPhone(),
      startDate: '2026-01-01',
    });
  });

  afterAll(async () => {
    await harness.close();
  });

  it('accepte une ligne valide', async () => {
    await expect(
      insert({ periodStart: '2026-03-01', dueDate: '2026-03-05' }),
    ).resolves.toBeDefined();
  });

  /**
   * Section 20 : la contrainte CENTRALE du lot, celle qui rend la génération
   * idempotente. Sans elle, deux exécutions du job factureraient deux fois.
   */
  it('refuse deux échéances pour le même bail et la même période', async () => {
    await generateRents(harness.db, owner, {}, OPTIONS);

    const existing = await installmentOf(harness, lease.leaseId, PERIOD);

    expect(existing).toBeDefined();

    await expect(insert({ periodStart: PERIOD, dueDate: '2026-10-05' })).rejects.toThrow();
  });

  /** Une période doit commencer un premier du mois : « septembre 2026 » n'est pas le 15. */
  it('refuse une période qui ne commence pas le premier du mois', async () => {
    await expect(insert({ periodStart: '2026-06-15', dueDate: '2026-06-20' })).rejects.toThrow();
  });

  describe('Invariants financiers (section 21)', () => {
    it('refuse un solde qui n est pas la différence des deux montants', async () => {
      await expect(
        insert({
          periodStart: '2026-07-01',
          amountDue: 1_000_000,
          amountPaid: 0,
          balance: 400_000,
        }),
      ).rejects.toThrow();
    });

    it('refuse un montant payé supérieur au montant dû', async () => {
      await expect(
        insert({
          periodStart: '2026-07-01',
          amountDue: 1_000_000,
          amountPaid: 1_500_000,
          balance: -500_000,
          status: 'PAID',
        }),
      ).rejects.toThrow();
    });

    it('refuse un montant négatif', async () => {
      await expect(
        insert({ periodStart: '2026-07-01', amountDue: -1, balance: -1 }),
      ).rejects.toThrow();
    });
  });

  describe('Cohérence du statut', () => {
    it('refuse une créance PAID qui doit encore de l argent', async () => {
      await expect(
        insert({
          periodStart: '2026-08-01',
          amountDue: 1_000_000,
          amountPaid: 300_000,
          balance: 700_000,
          status: 'PAID',
        }),
      ).rejects.toThrow();
    });

    it('refuse une créance UNPAID sur laquelle un paiement a déjà été versé', async () => {
      await expect(
        insert({
          periodStart: '2026-08-01',
          amountDue: 1_000_000,
          amountPaid: 300_000,
          balance: 700_000,
          status: 'UNPAID',
        }),
      ).rejects.toThrow();
    });

    /**
     * `PARTIALLY_PAID` et `OVERDUE` ne reçoivent volontairement aucune
     * contrainte : le second dépend de la date du jour, qu'un CHECK ne peut pas
     * lire sans devenir non déterministe.
     */
    it('accepte une créance partiellement payée et une créance en retard', async () => {
      await expect(
        insert({
          periodStart: '2026-09-01',
          dueDate: '2026-09-05',
          amountDue: 1_000_000,
          amountPaid: 300_000,
          balance: 700_000,
          status: 'PARTIALLY_PAID',
        }),
      ).resolves.toBeDefined();

      await expect(
        insert({
          periodStart: '2026-04-01',
          dueDate: '2026-04-05',
          amountDue: 1_000_000,
          amountPaid: 0,
          balance: 1_000_000,
          status: 'OVERDUE',
        }),
      ).resolves.toBeDefined();
    });
  });

  it('refuse une devise qui n est pas un code à trois lettres majuscules', async () => {
    await expect(insert({ periodStart: '2026-11-01', currency: 'gnf' })).rejects.toThrow();
  });
});
