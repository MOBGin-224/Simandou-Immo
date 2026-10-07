import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import {
  createApartment,
  getApartment,
  listApartments,
  updateApartment,
} from '../../src/modules/apartments/service';
import { createLease, terminateLease } from '../../src/modules/leases/service';
import { getProperty } from '../../src/modules/properties/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  OPTIONS as LEASE_OPTIONS,
  TODAY,
  addProperty,
  addTenant,
  contextOf,
  freshPhone,
  passwordHasher,
} from '../helpers/leases';

/**
 * DEC-050 : l'occupation d'un logement est DÉRIVÉE de son bail.
 *
 * Le défaut que cette décision supprime était visible à l'écran : un
 * gestionnaire choisissait « vacant » à la main, et le logement s'annonçait
 * vacant alors qu'un bail y courait. BR-029 veut l'inverse.
 *
 * Ce fichier éprouve donc la chaîne entière, contre une vraie base et avec le
 * vrai module Contrats :
 *
 *   1. créer un bail rend le logement occupé, sans que personne ne le saisisse ;
 *   2. clôturer le bail le rend vacant, immédiatement ;
 *   3. la colonne `status`, gelée, n'a plus voix au chapitre ;
 *   4. les travaux sont INDÉPENDANTS : un logement loué peut être en chantier ;
 *   5. les compteurs de l'immeuble suivent les baux, et non une saisie.
 */
describe("L'occupation suit le bail (DEC-050)", () => {
  let harness: TestDatabase;
  let owner: Awaited<ReturnType<typeof contextOf>>;
  let property: string;
  let hashPassword: (password: string) => Promise<string>;

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    property = await addProperty(harness, 'Résidence Kaloum');
    owner = await contextOf(harness, SEED_IDS.ownerA);
    hashPassword = passwordHasher(harness);
  });

  afterAll(async () => {
    await harness.close();
  });

  let counter = 0;

  /** Un logement neuf de l'immeuble dédié à ce fichier. */
  const freshApartment = async (extra: Record<string, unknown> = {}) => {
    counter += 1;

    return createApartment(harness.db, owner, property, {
      number: `O${String(counter).padStart(3, '0')}`,
      ...extra,
    });
  };

  /** Un locataire prêt à recevoir un bail, par le vrai chemin du produit. */
  const freshTenant = async (apartmentId: string) =>
    addTenant(harness, {
      apartmentId,
      phone: freshPhone(),
      ownerContext: owner,
      hashPassword,
    });

  const leaseOn = async (apartmentId: string, tenantId: string) =>
    createLease(
      harness.db,
      owner,
      {
        apartmentId,
        tenantId,
        startDate: TODAY,
        rentAmount: 2_000_000,
        currency: 'GNF',
        dueDay: 5,
      },
      LEASE_OPTIONS,
    );

  const occupancyOf = async (apartmentId: string) =>
    (await getApartment(harness.db, owner, apartmentId)).occupancy;

  it('annonce occupé dès la création du bail, sans aucune saisie', async () => {
    const apartment = await freshApartment();
    const tenant = await freshTenant((await freshApartment()).id);

    expect(apartment.occupancy).toBe('VACANT');

    await leaseOn(apartment.id, tenant.userId);

    expect(await occupancyOf(apartment.id)).toBe('OCCUPIED');
  });

  it('redevient vacant à la clôture du bail, sans aucune saisie', async () => {
    const apartment = await freshApartment();
    const tenant = await freshTenant((await freshApartment()).id);
    const lease = await leaseOn(apartment.id, tenant.userId);

    await terminateLease(harness.db, owner, lease.id, { terminationDate: TODAY }, LEASE_OPTIONS);

    expect(await occupancyOf(apartment.id)).toBe('VACANT');
  });

  /**
   * Le cœur de la décision : la saisie ne peut plus contredire le bail, parce
   * qu'elle n'existe plus. Une requête qui ne porte que l'ancien champ est
   * refusée comme vide, et le logement reste ce que son bail dit qu'il est.
   */
  it("n'accepte plus qu'on déclare vacant un logement loué", async () => {
    const apartment = await freshApartment();
    const tenant = await freshTenant((await freshApartment()).id);

    await leaseOn(apartment.id, tenant.userId);

    await expect(
      updateApartment(harness.db, owner, apartment.id, { status: 'VACANT' }),
    ).rejects.toThrow();

    expect(await occupancyOf(apartment.id)).toBe('OCCUPIED');
  });

  /** Les travaux se déclarent, et ne disent rien de l'occupation (DEC-050). */
  it('laisse un logement LOUÉ être déclaré en travaux, sans perdre son occupation', async () => {
    const apartment = await freshApartment();
    const tenant = await freshTenant((await freshApartment()).id);

    await leaseOn(apartment.id, tenant.userId);

    const updated = await updateApartment(harness.db, owner, apartment.id, {
      underMaintenance: true,
    });

    expect(updated.underMaintenance).toBe(true);
    expect(updated.occupancy).toBe('OCCUPIED');
  });

  it('garde les travaux déclarés après la clôture du bail', async () => {
    const apartment = await freshApartment({ underMaintenance: 'on' });
    const tenant = await freshTenant((await freshApartment()).id);
    const lease = await leaseOn(apartment.id, tenant.userId);

    await terminateLease(harness.db, owner, lease.id, { terminationDate: TODAY }, LEASE_OPTIONS);

    const read = await getApartment(harness.db, owner, apartment.id);

    expect(read.occupancy).toBe('VACANT');
    expect(read.underMaintenance).toBe(true);
  });

  describe('Filtres de la liste', () => {
    it('range le logement loué parmi les occupés, et non parmi les vacants', async () => {
      const apartment = await freshApartment();
      const tenant = await freshTenant((await freshApartment()).id);

      await leaseOn(apartment.id, tenant.userId);

      const occupied = await listApartments(harness.db, owner, property, {
        status: 'OCCUPIED',
        pageSize: 100,
      });
      const vacant = await listApartments(harness.db, owner, property, {
        status: 'VACANT',
        pageSize: 100,
      });

      expect(occupied.apartments.map((item) => item.id)).toContain(apartment.id);
      expect(vacant.apartments.map((item) => item.id)).not.toContain(apartment.id);
    });

    /**
     * Les deux filtres se RÉPARTISSENT le parc : un logement porte un bail en
     * cours, ou il n'en porte pas. Si les deux totaux ne se rejoignaient pas, un
     * logement serait compté deux fois ou pas du tout.
     */
    it('répartit exactement le parc entre occupés et vacants', async () => {
      const all = await listApartments(harness.db, owner, property, { pageSize: 100 });
      const occupied = await listApartments(harness.db, owner, property, {
        status: 'OCCUPIED',
        pageSize: 100,
      });
      const vacant = await listApartments(harness.db, owner, property, {
        status: 'VACANT',
        pageSize: 100,
      });

      expect(occupied.meta.total + vacant.meta.total).toBe(all.meta.total);
    });
  });

  describe("Compteurs de l'immeuble", () => {
    it('suit les baux, et non une saisie', async () => {
      const before = (await getProperty(harness.db, owner, property)).occupancy;

      const apartment = await freshApartment();
      const tenant = await freshTenant((await freshApartment()).id);

      await leaseOn(apartment.id, tenant.userId);

      const after = (await getProperty(harness.db, owner, property)).occupancy;

      // Deux logements créés, dont un loué : le parc grandit de deux, les
      // occupés de un, et les vacants des trois quarts restants.
      expect(after.apartmentCount).toBe(before.apartmentCount + 2);
      expect(after.occupiedCount).toBe(before.occupiedCount + 1);
      expect(after.vacantCount).toBe(after.apartmentCount - after.occupiedCount);
    });

    it('compte le logement loué en travaux dans les DEUX, sans le dédoubler', async () => {
      const apartment = await freshApartment({ underMaintenance: 'on' });
      const tenant = await freshTenant((await freshApartment()).id);

      await leaseOn(apartment.id, tenant.userId);

      const occupancy = (await getProperty(harness.db, owner, property)).occupancy;

      // Le chevauchement est VOULU : additionner les trois compteurs
      // annoncerait plus de logements qu'il n'en existe.
      expect(occupancy.occupiedCount + occupancy.vacantCount).toBe(occupancy.apartmentCount);
      expect(occupancy.maintenanceCount).toBeGreaterThan(0);
    });
  });
});
