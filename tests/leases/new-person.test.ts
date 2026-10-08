import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { LeaseConflictError, LeaseValidationError } from '../../src/modules/leases/errors';
import { createLease } from '../../src/modules/leases/service';
import { listTenants } from '../../src/modules/tenants/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  OPTIONS,
  TODAY,
  addApartment,
  addProperty,
  addTenant,
  contextOf,
  freshPhone,
  passwordHasher,
} from '../helpers/leases';
import { OPTIONS as TENANT_OPTIONS, readFullName } from '../helpers/tenants';

/**
 * Créer le bail crée la personne (DEC-051 point 8, Lot 8b).
 *
 * C'est ce qui débloque le locataire que le fondateur décrit : celui qui occupe
 * un logement et n'utilisera jamais l'application. Jusqu'ici il fallait l'inviter
 * pour qu'il existe, c'est-à-dire lui ouvrir un espace dont il ne voulait pas.
 *
 * Deux exigences se rencontrent ici, et ce fichier éprouve les deux :
 *
 *   1. la personne doit pouvoir naître du bail, sans invitation ni accès ;
 *   2. la règle d'identité doit rester UNE : un numéro déjà connu réutilise son
 *      compte au lieu d'en créer un second (DEC-041).
 */
describe('Créer un bail crée la personne', () => {
  let harness: TestDatabase;
  let owner: Awaited<ReturnType<typeof contextOf>>;
  let otherOwner: Awaited<ReturnType<typeof contextOf>>;
  let property: string;
  let hashPassword: (password: string) => Promise<string>;

  let counter = 0;
  const freshApartment = async () => {
    counter += 1;

    return addApartment(harness, property, `N${String(counter).padStart(3, '0')}`);
  };

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    property = await addProperty(harness, 'Résidence Matoto');
    owner = await contextOf(harness, SEED_IDS.ownerA);
    otherOwner = await contextOf(harness, SEED_IDS.ownerB);
    hashPassword = passwordHasher(harness);
  });

  afterAll(async () => {
    await harness.close();
  });

  const create = async (overrides: Record<string, unknown>) =>
    createLease(
      harness.db,
      owner,
      {
        apartmentId: await freshApartment(),
        startDate: TODAY,
        rentAmount: 1_900_000,
        currency: 'GNF',
        dueDay: 5,
        ...overrides,
      },
      OPTIONS,
    );

  const failureOf = (promise: Promise<unknown>) => promise.catch((error: unknown) => error);

  const listed = async (userId: string) =>
    (await listTenants(harness.db, owner, { pageSize: 100 }, TENANT_OPTIONS)).tenants.find(
      (item) => item.id === userId,
    );

  describe('Une personne nouvelle', () => {
    it('naît avec le bail, sans invitation et sans accès', async () => {
      const phone = freshPhone();

      const lease = await create({
        tenant: { name: 'Mariama Sans Compte', phone, email: '' },
      });

      expect(lease.status).toBe('ACTIVE');
      expect(lease.tenant.fullName).toBe('Mariama Sans Compte');
      expect(lease.tenant.phone).toBe(phone);
      // Aucun accès au produit : c'est tout l'intérêt de ce chemin (DEC-051).
      expect(lease.tenant.accessId).toBeNull();
    });

    /**
     * Le test qui relie les deux décisions : la personne créée par le bail est
     * une LOCATAIRE de l'organisation, et elle figure dans la liste métier au
     * statut « sans accès ».
     */
    it('devient locataire de l organisation, au statut sans accès', async () => {
      const lease = await create({
        tenant: { name: 'Hadja Diallo', phone: freshPhone(), email: '' },
      });

      const item = await listed(lease.tenant.userId);

      expect(item).toBeDefined();
      expect(item?.status).toBe('NO_ACCESS');
      expect(item?.accessId).toBeNull();
      expect(item?.apartmentSource).toBe('LEASE');
      expect(item?.apartment?.id).toBe(lease.apartment.id);
    });

    it('accepte un email, et le garde', async () => {
      const lease = await create({
        tenant: { name: 'Avec Email', phone: freshPhone(), email: 'avec.email@exemple.gn' },
      });

      expect(lease.tenant.email).toBe('avec.email@exemple.gn');
    });

    it('refuse un numéro mal formé, comme l invitation le refuse', async () => {
      const error = await failureOf(
        create({ tenant: { name: 'Numéro Faux', phone: '620000000', email: '' } }),
      );

      expect(error).toBeInstanceOf(LeaseValidationError);
    });

    it('refuse un nom vide', async () => {
      const error = await failureOf(
        create({ tenant: { name: '   ', phone: freshPhone(), email: '' } }),
      );

      expect(error).toBeInstanceOf(LeaseValidationError);
    });
  });

  describe('Une personne déjà connue du produit', () => {
    /** DEC-041 : le numéro est UNIQUE, donc il désigne une seule personne. */
    it('réutilise son compte au lieu d en créer un second', async () => {
      const first = await create({
        tenant: { name: 'Fatoumata Bah', phone: freshPhone(), email: '' },
      });

      const phone = first.tenant.phone as string;

      // Elle quitte son logement, puis en reprend un autre : la seconde création
      // la désigne par le même numéro et ne doit pas la dédoubler.
      const second = await createLease(
        harness.db,
        otherOwner,
        {
          apartmentId: await addApartment(harness, SEED_IDS.propertyB, `NB${counter}`, {
            organizationId: SEED_IDS.organizationB,
          }),
          tenant: { name: 'Fatoumata Bah', phone, email: '' },
          startDate: TODAY,
          rentAmount: 1_000_000,
          currency: 'GNF',
          dueDay: 1,
        },
        OPTIONS,
      );

      expect(second.tenant.userId).toBe(first.tenant.userId);
    });

    /**
     * Un compte ACTIF garde son nom (DEC-041) : il appartient à la personne, pas
     * à celui qui l'inscrit. Un bailleur ne renomme donc pas la locataire d'un
     * autre en lui créant un bail.
     */
    it('ne renomme pas une personne dont le compte est actif', async () => {
      const tenant = await addTenant(harness, {
        apartmentId: await freshApartment(),
        name: 'Nom Choisi Par Elle',
        phone: freshPhone(),
        ownerContext: owner,
        hashPassword,
      });

      const lease = await createLease(
        harness.db,
        otherOwner,
        {
          apartmentId: await addApartment(harness, SEED_IDS.propertyB, `NC${counter}`, {
            organizationId: SEED_IDS.organizationB,
          }),
          tenant: { name: 'Nom Impose Par Un Tiers', phone: tenant.phone, email: '' },
          startDate: TODAY,
          rentAmount: 1_000_000,
          currency: 'GNF',
          dueDay: 1,
        },
        OPTIONS,
      );

      expect(lease.tenant.userId).toBe(tenant.userId);
      expect(lease.tenant.fullName).toBe('Nom Choisi Par Elle');
    });

    /**
     * La règle de simultanéité s'applique au chemin « nouvelle personne » comme à
     * l'autre (DEC-049) : décrire une personne ne permet pas de contourner le fait
     * qu'elle a déjà un bail en cours dans cette organisation.
     */
    it('refuse un second bail dans la même organisation, même décrite', async () => {
      const first = await create({
        tenant: { name: 'Deja Logee', phone: freshPhone(), email: '' },
      });

      const error = await failureOf(
        create({ tenant: { name: 'Deja Logee', phone: first.tenant.phone as string, email: '' } }),
      );

      expect(error).toBeInstanceOf(LeaseConflictError);
      expect((error as LeaseConflictError).reason).toBe('tenant-engaged');
    });

    /**
     * Et la transaction tient : le refus ci-dessus survient APRÈS la résolution de
     * la personne, qui met à jour le nom d'un compte en attente d'activation
     * (DEC-041). Sans transaction, le bail refusé laisserait quand même ce
     * renommage derrière lui.
     */
    it('annule le renommage quand le bail est refusé', async () => {
      const first = await create({
        tenant: { name: 'Nom Avant Refus', phone: freshPhone(), email: '' },
      });

      const error = await failureOf(
        create({
          tenant: { name: 'Nom Apres Refus', phone: first.tenant.phone as string, email: '' },
        }),
      );

      expect(error).toBeInstanceOf(LeaseConflictError);
      expect(await readFullName(harness, first.tenant.userId)).toBe('Nom Avant Refus');
    });
  });

  describe('Les deux façons de désigner le locataire', () => {
    it('refuse les deux ensemble, plutôt que d en départager une', async () => {
      const known = await create({
        tenant: { name: 'Connue', phone: freshPhone(), email: '' },
      });

      const error = await failureOf(
        create({
          tenantId: known.tenant.userId,
          tenant: { name: 'Autre', phone: freshPhone(), email: '' },
        }),
      );

      expect(error).toBeInstanceOf(LeaseValidationError);
      expect((error as LeaseValidationError).fieldErrors.tenantId?.[0]).toMatch(/pas les deux/i);
    });

    it('refuse une création sans aucun locataire', async () => {
      const error = await failureOf(create({}));

      expect(error).toBeInstanceOf(LeaseValidationError);
      expect((error as LeaseValidationError).fieldErrors.tenantId?.[0]).toMatch(
        /Locataire requis/i,
      );
    });
  });
});
