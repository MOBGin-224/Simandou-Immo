import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { runChargeOverdueJob } from '../../src/modules/charges/service';
import { runOverdueReceivablesJob } from '../../src/modules/receivables/service';
import { generateRents } from '../../src/modules/rents/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  addApartment,
  addBillableLease,
  addProperty,
  addPublishedCharge,
  allocationsOfCharge,
  contextOf,
  freshPhone,
  installmentsOfLease,
  passwordHasher,
  setAllocationPaid,
} from '../helpers/charges';

/**
 * BR-037 et job `markOverdueReceivables` : le retard d'une créance de charge.
 *
 * La règle est la même que pour un loyer, l'énumération de statut étant commune
 * aux deux créances (DEC-015), et c'est précisément ce que ces tests
 * vérifient : UN job, deux tables, une seule règle.
 *
 * Deux conséquences tenues : une créance `PAID` ou `CANCELLED` ne passe JAMAIS
 * en retard, et le passage est le fait du job et jamais d'une lecture.
 */
describe('Passage en retard des créances de charge', () => {
  let harness: TestDatabase;
  let owner: Awaited<ReturnType<typeof contextOf>>;
  let property: string;
  let leaseId: string;

  /** Le 20 octobre 2026 : après une échéance au 10, avant une échéance au 25. */
  const AFTER_DUE = { now: new Date('2026-10-20T08:00:00.000Z') };
  const BEFORE_DUE = { now: new Date('2026-10-05T08:00:00.000Z') };

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    owner = await contextOf(harness, SEED_IDS.ownerA);
    property = await addProperty(harness, 'Résidence Retard');

    const apartment = await addApartment(harness, property, 'A01');

    await addApartment(harness, property, 'A02');

    const lease = await addBillableLease(harness, {
      apartmentId: apartment,
      tenantApartmentId: apartment,
      ownerContext: owner,
      hashPassword: passwordHasher(harness),
      phone: freshPhone(),
      startDate: '2026-01-01',
      dueDay: 5,
    });

    leaseId = lease.leaseId;
  });

  afterAll(async () => {
    await harness.close();
  });

  it('bascule en retard une créance échue dont le solde reste dû', async () => {
    const charge = await addPublishedCharge(harness, {
      propertyId: property,
      context: owner,
      periodStart: '2026-10',
      dueDate: '2026-10-10',
      totalAmount: 600_000,
    });

    const result = await runChargeOverdueJob(harness.db, AFTER_DUE);

    expect(result.today).toBe('2026-10-20');
    expect(result.marked).toBe(2);

    const allocations = await allocationsOfCharge(harness, charge.id);

    expect(allocations.every((row) => row.status === 'OVERDUE')).toBe(true);
  });

  it('laisse intacte une créance dont l échéance n est pas atteinte', async () => {
    const charge = await addPublishedCharge(harness, {
      propertyId: property,
      context: owner,
      type: 'ELECTRICITY',
      periodStart: '2026-10',
      dueDate: '2026-10-25',
      totalAmount: 400_000,
    });

    await runChargeOverdueJob(harness.db, BEFORE_DUE);

    const allocations = await allocationsOfCharge(harness, charge.id);

    expect(allocations.every((row) => row.status === 'UNPAID')).toBe(true);
  });

  it('ne touche ni une créance soldée, ni une créance annulée', async () => {
    const charge = await addPublishedCharge(harness, {
      propertyId: property,
      context: owner,
      type: 'CLEANING',
      periodStart: '2026-09',
      dueDate: '2026-09-10',
      totalAmount: 500_000,
    });

    const allocations = await allocationsOfCharge(harness, charge.id);

    await setAllocationPaid(harness, allocations[0]?.id as string, 250_000, 'PAID');
    await setAllocationPaid(harness, allocations[1]?.id as string, 0, 'CANCELLED');

    await runChargeOverdueJob(harness.db, AFTER_DUE);

    const after = await allocationsOfCharge(harness, charge.id);

    expect(after.map((row) => row.status).sort()).toEqual(['CANCELLED', 'PAID']);
  });

  /** Idempotent : `OVERDUE` n'est pas un statut visé, donc rien à reprendre. */
  it('ne trouve plus rien à la seconde exécution', async () => {
    await runChargeOverdueJob(harness.db, AFTER_DUE);

    expect((await runChargeOverdueJob(harness.db, AFTER_DUE)).marked).toBe(0);
  });

  /**
   * Le job des créances traite les DEUX tables dans la même exécution (API
   * section 19) : une seule planification suffit, et les deux moitiés sont
   * comptées séparément pour qu'un défaut sur un seul type reste visible.
   */
  it('compte séparément les loyers et les charges dans le job commun', async () => {
    await generateRents(harness.db, owner, { period: '2026-09' }, BEFORE_DUE);

    const charge = await addPublishedCharge(harness, {
      propertyId: property,
      context: owner,
      type: 'SECURITY',
      periodStart: '2026-09',
      dueDate: '2026-09-15',
      totalAmount: 200_000,
    });

    const result = await runOverdueReceivablesJob(harness.db, AFTER_DUE);

    expect(result.rents).toBeGreaterThanOrEqual(1);
    expect(result.charges).toBe(2);
    expect(result.marked).toBe(result.rents + result.charges);

    const installments = await installmentsOfLease(harness, leaseId);
    const allocations = await allocationsOfCharge(harness, charge.id);

    expect(installments.some((row) => row.status === 'OVERDUE')).toBe(true);
    expect(allocations.every((row) => row.status === 'OVERDUE')).toBe(true);
  });
});
