import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { listMyCharges } from '../../src/modules/charges/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  OPTIONS,
  addApartment,
  addCharge,
  addBillableLease,
  addProperty,
  addPublishedCharge,
  contextOf,
  freshPhone,
  passwordHasher,
} from '../helpers/charges';

/**
 * API section 31 et BR-021 : la part du locataire, et rien que la sienne.
 *
 * « Le locataire ne demande jamais la totalité de la charge. » Ces tests
 * vérifient les trois conséquences : il voit SA part, il la comprend grâce à la
 * justification du calcul, et une charge non publiée ne lui est pas visible
 * (BR-052).
 */
describe('Les charges du locataire', () => {
  let harness: TestDatabase;
  let owner: Awaited<ReturnType<typeof contextOf>>;

  let property: string;
  let firstTenant: { userId: string; leaseId: string };
  let secondTenant: { userId: string; leaseId: string };

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    owner = await contextOf(harness, SEED_IDS.ownerA);

    property = await addProperty(harness, 'Résidence Camayenne');

    const hashPassword = passwordHasher(harness);
    const first = await addApartment(harness, property, 'A01');
    const second = await addApartment(harness, property, 'A02');

    // Troisième logement, VACANT : sa part existera sans personne redevable.
    await addApartment(harness, property, 'A03');

    const firstLease = await addBillableLease(harness, {
      apartmentId: first,
      tenantApartmentId: first,
      ownerContext: owner,
      hashPassword,
      phone: freshPhone(),
      startDate: '2026-01-01',
    });

    const secondLease = await addBillableLease(harness, {
      apartmentId: second,
      tenantApartmentId: second,
      ownerContext: owner,
      hashPassword,
      phone: freshPhone(),
      startDate: '2026-01-01',
    });

    firstTenant = { userId: firstLease.tenantUserId, leaseId: firstLease.leaseId };
    secondTenant = { userId: secondLease.tenantUserId, leaseId: secondLease.leaseId };

    await addPublishedCharge(harness, {
      propertyId: property,
      context: owner,
      type: 'WATER',
      periodStart: '2026-10',
      dueDate: '2026-10-10',
      totalAmount: 900_000,
    });
  });

  afterAll(async () => {
    await harness.close();
  });

  it('montre au locataire sa seule part, et non celle des autres', async () => {
    const tenant = await contextOf(harness, firstTenant.userId);
    const mine = await listMyCharges(harness.db, tenant, OPTIONS);

    expect(mine).toHaveLength(1);
    expect(mine[0]?.amountDue).toBe(300_000);
    expect(mine[0]?.tenant?.userId).toBe(firstTenant.userId);
  });

  it('donne à chaque locataire une part différente de la même facture', async () => {
    const first = await contextOf(harness, firstTenant.userId);
    const second = await contextOf(harness, secondTenant.userId);

    const [mine] = await listMyCharges(harness.db, first, OPTIONS);
    const [theirs] = await listMyCharges(harness.db, second, OPTIONS);

    expect(mine?.id).not.toBe(theirs?.id);
    expect(mine?.amountDue).toBe(theirs?.amountDue);
  });

  /**
   * L'exigence de transparence de la section 31 : le locataire doit comprendre
   * sa part sans avoir à la demander. La justification est celle figée à la
   * publication.
   */
  it('explique le calcul de la part : méthode, total et nombre de logements', async () => {
    const tenant = await contextOf(harness, firstTenant.userId);
    const [mine] = await listMyCharges(harness.db, tenant, OPTIONS);

    expect(mine?.explanation).toEqual({
      method: 'EQUAL',
      totalAmount: 900_000,
      unitCount: 3,
      baseShare: 300_000,
      roundingAdjustment: 0,
    });
  });

  it('porte le statut d affichage de la créance', async () => {
    const tenant = await contextOf(harness, firstTenant.userId);

    const [upcoming] = await listMyCharges(harness.db, tenant, {
      now: new Date('2026-10-01T08:00:00.000Z'),
    });
    const [due] = await listMyCharges(harness.db, tenant, {
      now: new Date('2026-10-20T08:00:00.000Z'),
    });

    expect(upcoming?.displayStatus).toBe('UPCOMING');
    expect(due?.displayStatus).toBe('UNPAID');
  });

  /** Une charge non publiée ne crée aucune créance, donc rien n'apparaît (BR-052). */
  it('ne montre rien d une charge restée en brouillon', async () => {
    const tenant = await contextOf(harness, secondTenant.userId);
    const before = await listMyCharges(harness.db, tenant, OPTIONS);

    await addCharge(harness, {
      propertyId: property,
      context: owner,
      type: 'CLEANING',
      periodStart: '2026-09',
      dueDate: '2026-09-10',
    });

    expect(await listMyCharges(harness.db, tenant, OPTIONS)).toHaveLength(before.length);
  });

  /**
   * La part du logement vacant n'apparaît dans AUCUN espace locataire (BR-052).
   * Elle reste visible du bailleur, ce que la liste des créances vérifie.
   */
  it("n attribue à personne la part d'un logement vacant", async () => {
    const first = await contextOf(harness, firstTenant.userId);
    const second = await contextOf(harness, secondTenant.userId);

    const mine = await listMyCharges(harness.db, first, OPTIONS);
    const theirs = await listMyCharges(harness.db, second, OPTIONS);

    expect(mine).toHaveLength(1);
    expect(theirs).toHaveLength(1);
  });

  /** Mieux vaut une liste vide qu'un refus sur une route qui parle de soi. */
  it('répond une liste vide à qui n est pas locataire', async () => {
    expect(await listMyCharges(harness.db, owner, OPTIONS)).toHaveLength(0);
  });
});
