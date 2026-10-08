import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { generateRents, listRents, runOverdueJob } from '../../src/modules/rents/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  NOW,
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
 * MVP-BACKLOG-038 : moteur de statut, et BR-037 qui le commande.
 *
 * La règle est explicite : « le passage de `UNPAID` ou `PARTIALLY_PAID` vers
 * `OVERDUE` est effectué par un job idempotent, pas au moment de la lecture ».
 * Deux conséquences se vérifient ici, et elles comptent autant l'une que l'autre :
 * la LECTURE n'écrit jamais, et le job ne touche jamais une créance soldée ou
 * annulée.
 */
describe('Passage en retard des créances', () => {
  let harness: TestDatabase;
  let owner: Awaited<ReturnType<typeof contextOf>>;
  let property: string;
  let hashPassword: (password: string) => Promise<string>;

  let counter = 0;
  const freshApartment = async () => {
    counter += 1;

    return addApartment(harness, property, `V${String(counter).padStart(3, '0')}`);
  };

  const addRent = async (options: { dueDay?: number; rentAmount?: number } = {}) => {
    const lease = await addBillableLease(harness, {
      apartmentId: await freshApartment(),
      tenantApartmentId: await freshApartment(),
      ownerContext: owner,
      hashPassword,
      phone: freshPhone(),
      startDate: '2026-01-01',
      dueDay: options.dueDay,
      rentAmount: options.rentAmount,
    });

    await generateRents(harness.db, owner, {}, OPTIONS);

    const installment = await installmentOf(harness, lease.leaseId, PERIOD);

    if (!installment) throw new Error("L'échéance de test n'a pas été générée.");

    return { ...lease, installment };
  };

  const statusOf = async (leaseId: string) =>
    (await installmentOf(harness, leaseId, PERIOD))?.status;

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    property = await addProperty(harness, 'Résidence Retards');
    await addScope(harness, SEED_IDS.accessManagerA, property);

    owner = await contextOf(harness, SEED_IDS.ownerA);
    hashPassword = passwordHasher(harness);
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('Ce que le job bascule', () => {
    /** L'instant de référence des tests est le 2 octobre 2026 : le 1er est passé. */
    it('bascule une créance impayée dont l échéance est dépassée', async () => {
      const rent = await addRent({ dueDay: 1 });

      const result = await runOverdueJob(harness.db, OPTIONS);

      expect(result.today).toBe(NOW.toISOString().slice(0, 10));
      expect(result.marked).toBeGreaterThanOrEqual(1);
      expect(await statusOf(rent.leaseId)).toBe('OVERDUE');
    });

    it('bascule aussi une créance partiellement payée', async () => {
      const rent = await addRent({ dueDay: 1, rentAmount: 2_000_000 });

      await setPaid(harness, rent.installment.id, 500_000, 'PARTIALLY_PAID');
      await runOverdueJob(harness.db, OPTIONS);

      expect(await statusOf(rent.leaseId)).toBe('OVERDUE');
    });

    it('ne touche pas une créance dont l échéance n est pas encore atteinte', async () => {
      const rent = await addRent({ dueDay: 28 });

      await runOverdueJob(harness.db, OPTIONS);

      expect(await statusOf(rent.leaseId)).toBe('UNPAID');
    });

    /** Due le jour même, elle n'est pas encore en retard : le retard commence le lendemain. */
    it('ne touche pas une créance due le jour même', async () => {
      const rent = await addRent({ dueDay: 2 });

      await runOverdueJob(harness.db, OPTIONS);

      expect(await statusOf(rent.leaseId)).toBe('UNPAID');
    });

    it('ne touche JAMAIS une créance soldée', async () => {
      const rent = await addRent({ dueDay: 1, rentAmount: 1_000_000 });

      await setPaid(harness, rent.installment.id, 1_000_000, 'PAID');
      await runOverdueJob(harness.db, OPTIONS);

      expect(await statusOf(rent.leaseId)).toBe('PAID');
    });

    it('ne touche JAMAIS une créance annulée', async () => {
      const rent = await addRent({ dueDay: 1 });

      await setPaid(harness, rent.installment.id, 0, 'CANCELLED');
      await runOverdueJob(harness.db, OPTIONS);

      expect(await statusOf(rent.leaseId)).toBe('CANCELLED');
    });
  });

  describe('Idempotence (DEC-028)', () => {
    it('ne trouve plus rien à faire au second passage', async () => {
      await addRent({ dueDay: 1 });

      const first = await runOverdueJob(harness.db, OPTIONS);
      const second = await runOverdueJob(harness.db, OPTIONS);

      expect(first.marked).toBeGreaterThanOrEqual(1);
      expect(second.marked).toBe(0);
    });

    it('laisse le statut inchangé après plusieurs passages', async () => {
      const rent = await addRent({ dueDay: 1 });

      await runOverdueJob(harness.db, OPTIONS);
      await runOverdueJob(harness.db, OPTIONS);
      await runOverdueJob(harness.db, OPTIONS);

      expect(await statusOf(rent.leaseId)).toBe('OVERDUE');
    });
  });

  /**
   * Le point le plus important du fichier : la LECTURE n'écrit pas. Sans cela,
   * deux écrans ouverts à une minute d'intervalle écriraient deux fois, et un
   * rapport nocturne ne verrait jamais le retard.
   */
  describe('La lecture n écrit jamais le statut', () => {
    it('laisse la colonne à UNPAID alors que l échéance est dépassée', async () => {
      const rent = await addRent({ dueDay: 1 });

      await listRents(harness.db, owner, { leaseId: rent.leaseId }, OPTIONS);

      expect(await statusOf(rent.leaseId)).toBe('UNPAID');
    });

    it('n écrit pas davantage en lisant une échéance à venir', async () => {
      const rent = await addRent({ dueDay: 28 });

      await listRents(harness.db, owner, { leaseId: rent.leaseId }, OPTIONS);

      expect(await statusOf(rent.leaseId)).toBe('UNPAID');
    });
  });
});
