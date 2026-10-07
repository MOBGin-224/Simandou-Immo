import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import {
  PermissionDeniedError,
  ResourceOutOfScopeError,
} from '../../src/lib/authorization/service';
import {
  LeaseStateError,
  LeaseTerminationDateError,
  LeaseValidationError,
} from '../../src/modules/leases/errors';
import {
  createLease,
  findOccupiedApartment,
  getLease,
  isApartmentOccupied,
  terminateLease,
  updateLease,
} from '../../src/modules/leases/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  OPTIONS,
  TODAY,
  addApartment,
  addProperty,
  addScope,
  addTenant,
  contextOf,
  dayOffset,
  freshPhone,
  passwordHasher,
  readLease,
} from '../helpers/leases';

/**
 * MVP-BACKLOG-033 et 034 : consultation, modification et clôture d'un bail.
 *
 * Trois propriétés y sont éprouvées, et chacune est une frontière du produit :
 *
 *   1. le locataire consulte SON contrat, et seulement le sien (BR-021) ;
 *   2. un bail clôturé ne se modifie plus : son contenu décrit ce qui a eu lieu ;
 *   3. la clôture LIBÈRE le logement et la personne, sans toucher à l'accès au
 *      produit (BR-027, DEC-047, DEC-049).
 */
describe("Vie d'un bail", () => {
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

    return addApartment(harness, propertyId, `V${String(counter).padStart(3, '0')}`);
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

  /** Un bail ACTIF neuf, avec son logement, son locataire et le contexte de celui-ci. */
  const addLease = async (propertyId = inScopeProperty) => {
    const apartment = await freshApartment(propertyId);
    const tenant = await addTenant(harness, {
      apartmentId: await freshApartment(),
      phone: freshPhone(),
      ownerContext: owner,
      hashPassword,
    });

    const lease = await createLease(
      harness.db,
      owner,
      {
        apartmentId: apartment,
        tenantId: tenant.accessId,
        startDate: TODAY,
        rentAmount: 2_500_000,
        currency: 'GNF',
        dueDay: 5,
        depositAmount: 5_000_000,
      },
      OPTIONS,
    );

    return { lease, apartment, tenant, context: await contextOf(harness, tenant.userId) };
  };

  const failureOf = (promise: Promise<unknown>) => promise.catch((error: unknown) => error);

  describe('Consultation', () => {
    it('porte le locataire, le logement, la période et les montants', async () => {
      const { lease, apartment } = await addLease();
      const view = await getLease(harness.db, owner, lease.id);

      expect(view.id).toBe(lease.id);
      expect(view.apartment.id).toBe(apartment);
      expect(view.status).toBe('ACTIVE');
      expect(view.startDate).toBe(TODAY);
      expect(view.rent).toEqual({ amount: 2_500_000, currency: 'GNF' });
      expect(view.organizationName).toBe('Patrimoine Camayenne');
    });

    it('est accessible au gestionnaire dont le périmètre contient le logement', async () => {
      const { lease } = await addLease();

      await expect(getLease(harness.db, manager, lease.id)).resolves.toMatchObject({
        id: lease.id,
      });
    });

    it('est inaccessible au gestionnaire quand le logement est hors de son périmètre', async () => {
      const { lease } = await addLease(outOfScopeProperty);

      await expect(getLease(harness.db, manager, lease.id)).rejects.toBeInstanceOf(
        ResourceOutOfScopeError,
      );
    });

    it("est inaccessible au propriétaire d'une autre organisation", async () => {
      const { lease } = await addLease();

      await expect(getLease(harness.db, otherOwner, lease.id)).rejects.toBeInstanceOf(
        ResourceOutOfScopeError,
      );
    });

    /** BR-021 : le locataire ne voit que ses propres données. */
    it('est accessible au locataire du bail', async () => {
      const { lease, context } = await addLease();

      await expect(getLease(harness.db, context, lease.id)).resolves.toMatchObject({
        id: lease.id,
      });
    });

    it('est inaccessible à un AUTRE locataire, comme un identifiant inconnu', async () => {
      const first = await addLease();
      const second = await addLease();

      const foreign = await failureOf(getLease(harness.db, second.context, first.lease.id));
      const unknown = await failureOf(
        getLease(harness.db, second.context, '00000000-0000-4000-8000-000000000999'),
      );

      expect(foreign).toBeInstanceOf(ResourceOutOfScopeError);
      expect((foreign as Error).message).toBe((unknown as Error).message);
    });

    it('refuse un identifiant mal formé', async () => {
      await expect(getLease(harness.db, owner, 'pas-un-uuid')).rejects.toBeInstanceOf(
        ResourceOutOfScopeError,
      );
    });
  });

  describe('Modification', () => {
    it('change le loyer, le jour d échéance et la caution', async () => {
      const { lease } = await addLease();
      const view = await updateLease(
        harness.db,
        owner,
        lease.id,
        { rentAmount: 2_800_000, dueDay: 10, depositAmount: 0 },
        OPTIONS,
      );

      expect(view.rent.amount).toBe(2_800_000);
      expect(view.dueDay).toBe(10);
      expect(view.deposit.amount).toBe(0);
    });

    it('laisse intact un champ absent, et efface un champ vide', async () => {
      const { lease } = await addLease();

      await updateLease(harness.db, owner, lease.id, { endDate: dayOffset(90) }, OPTIONS);

      const withTerm = await getLease(harness.db, owner, lease.id);

      expect(withTerm.endDate).toBe(dayOffset(90));
      expect(withTerm.rent.amount).toBe(2_500_000);

      const cleared = await updateLease(harness.db, owner, lease.id, { endDate: '' }, OPTIONS);

      expect(cleared.endDate).toBeNull();
      expect(cleared.rent.amount).toBe(2_500_000);
    });

    it('refuse une fin antérieure au début, même en modification partielle', async () => {
      const { lease } = await addLease();
      const error = await failureOf(
        updateLease(harness.db, owner, lease.id, { endDate: dayOffset(-5) }, OPTIONS),
      );

      expect(error).toBeInstanceOf(LeaseValidationError);
      expect((error as LeaseValidationError).fieldErrors.endDate).toBeDefined();
    });

    it("n'accepte ni logement ni locataire : ils définissent la relation", async () => {
      const { lease } = await addLease();
      const other = await freshApartment();

      const view = await updateLease(
        harness.db,
        owner,
        lease.id,
        { apartmentId: other, tenantId: SEED_IDS.accessManagerA },
        OPTIONS,
      );

      expect(view.apartment.id).toBe(lease.apartment.id);
      expect(view.tenant.userId).toBe(lease.tenant.userId);
    });

    it('est permise au gestionnaire sur son périmètre', async () => {
      const { lease } = await addLease();

      await expect(
        updateLease(harness.db, manager, lease.id, { dueDay: 15 }, OPTIONS),
      ).resolves.toMatchObject({ dueDay: 15 });
    });

    /** BR-022 : le locataire ne modifie aucune donnée financière de référence. */
    it('est refusée au locataire, qui ne touche pas son loyer contractuel', async () => {
      const { lease, context } = await addLease();
      const error = await failureOf(
        updateLease(harness.db, context, lease.id, { rentAmount: 1 }, OPTIONS),
      );

      expect(error).toBeInstanceOf(PermissionDeniedError);
      expect((error as PermissionDeniedError).permission).toBe('lease.update');
    });

    it('est refusée sur un bail clôturé', async () => {
      const { lease } = await addLease();

      await terminateLease(harness.db, owner, lease.id, { terminationDate: TODAY }, OPTIONS);

      const error = await failureOf(
        updateLease(harness.db, owner, lease.id, { dueDay: 20 }, OPTIONS),
      );

      expect(error).toBeInstanceOf(LeaseStateError);
      expect((error as LeaseStateError).status).toBe('ENDED');
      expect((error as LeaseStateError).message).toMatch(/ce qui a eu lieu/);
    });
  });

  describe('Clôture', () => {
    it('passe le bail à ENDED et fixe sa fin à la date de clôture', async () => {
      const { lease } = await addLease();
      const view = await terminateLease(
        harness.db,
        owner,
        lease.id,
        { terminationDate: dayOffset(30), reason: 'move_out' },
        OPTIONS,
      );

      expect(view.status).toBe('ENDED');
      expect(view.endDate).toBe(dayOffset(30));
      expect(view.terminationReason).toBe('move_out');
      expect(view.terminatedAt).not.toBeNull();
    });

    it('accepte une clôture sans raison', async () => {
      const { lease } = await addLease();
      const view = await terminateLease(
        harness.db,
        owner,
        lease.id,
        { terminationDate: TODAY },
        OPTIONS,
      );

      expect(view.terminationReason).toBeNull();
      expect(view.status).toBe('ENDED');
    });

    it('refuse une date de clôture antérieure au début du bail', async () => {
      const { lease } = await addLease();
      const error = await failureOf(
        terminateLease(harness.db, owner, lease.id, { terminationDate: dayOffset(-1) }, OPTIONS),
      );

      expect(error).toBeInstanceOf(LeaseTerminationDateError);
      expect((error as LeaseTerminationDateError).startDate).toBe(TODAY);
    });

    it('refuse une clôture déjà faite', async () => {
      const { lease } = await addLease();

      await terminateLease(harness.db, owner, lease.id, { terminationDate: TODAY }, OPTIONS);

      const error = await failureOf(
        terminateLease(harness.db, owner, lease.id, { terminationDate: TODAY }, OPTIONS),
      );

      expect(error).toBeInstanceOf(LeaseStateError);
      expect((error as LeaseStateError).message).toMatch(/déjà clôturé/);
    });

    it('est permise au gestionnaire sur son périmètre', async () => {
      const { lease } = await addLease();

      await expect(
        terminateLease(harness.db, manager, lease.id, { terminationDate: TODAY }, OPTIONS),
      ).resolves.toMatchObject({ status: 'ENDED' });
    });

    it('est refusée au locataire', async () => {
      const { lease, context } = await addLease();
      const error = await failureOf(
        terminateLease(harness.db, context, lease.id, { terminationDate: TODAY }, OPTIONS),
      );

      expect(error).toBeInstanceOf(PermissionDeniedError);
      expect((error as PermissionDeniedError).permission).toBe('lease.terminate');
    });

    /** BR-027 : plusieurs contrats successifs peuvent se rattacher au même logement. */
    it('LIBÈRE le logement : un nouveau bail peut être créé aussitôt', async () => {
      const { lease, apartment } = await addLease();
      const next = await addTenant(harness, {
        apartmentId: await freshApartment(),
        phone: freshPhone(),
        ownerContext: owner,
        hashPassword,
      });

      await terminateLease(harness.db, owner, lease.id, { terminationDate: TODAY }, OPTIONS);

      await expect(
        createLease(
          harness.db,
          owner,
          {
            apartmentId: apartment,
            tenantId: next.accessId,
            startDate: dayOffset(1),
            rentAmount: 2_600_000,
            currency: 'GNF',
            dueDay: 5,
          },
          OPTIONS,
        ),
      ).resolves.toMatchObject({ status: 'ACTIVE' });
    });

    /** DEC-049 : la personne redevient libre de prendre un autre logement. */
    it('LIBÈRE la personne : elle peut reprendre un logement du même bailleur', async () => {
      const { lease, tenant } = await addLease();
      const other = await freshApartment();

      await terminateLease(harness.db, owner, lease.id, { terminationDate: TODAY }, OPTIONS);

      await expect(
        createLease(
          harness.db,
          owner,
          {
            apartmentId: other,
            tenantId: tenant.accessId,
            startDate: dayOffset(1),
            rentAmount: 2_000_000,
            currency: 'GNF',
            dueDay: 1,
          },
          OPTIONS,
        ),
      ).resolves.toMatchObject({ status: 'ACTIVE' });
    });

    /** DEC-047, vu de l'autre côté : les deux opérations restent distinctes. */
    it("ne touche PAS l'accès au produit du locataire", async () => {
      const { lease, tenant } = await addLease();

      await terminateLease(harness.db, owner, lease.id, { terminationDate: TODAY }, OPTIONS);

      const context = await contextOf(harness, tenant.userId);

      expect(context.memberships.some((membership) => membership.role === 'TENANT')).toBe(true);
    });

    it('conserve le bail : rien n est supprimé', async () => {
      const { lease } = await addLease();

      await terminateLease(harness.db, owner, lease.id, { terminationDate: TODAY }, OPTIONS);

      const row = await readLease(harness, lease.id);

      expect(row.id).toBe(lease.id);
      expect(row.status).toBe('ENDED');
      expect(row.terminatedAt).not.toBeNull();
    });
  });

  describe('Ce que le bail apprend aux autres modules (DEC-050)', () => {
    it("dit qu'un logement avec bail actif est occupé", async () => {
      const { apartment } = await addLease();

      expect(await isApartmentOccupied(harness.db, apartment)).toBe(true);
    });

    it("dit qu'un logement sans bail actif ne l'est pas", async () => {
      const apartment = await freshApartment();

      expect(await isApartmentOccupied(harness.db, apartment)).toBe(false);
    });

    it('le libère à la clôture', async () => {
      const { lease, apartment } = await addLease();

      await terminateLease(harness.db, owner, lease.id, { terminationDate: TODAY }, OPTIONS);

      expect(await isApartmentOccupied(harness.db, apartment)).toBe(false);
    });

    it("donne le logement qu'une personne occupe, et non celui de son invitation", async () => {
      const { apartment, tenant } = await addLease();
      const occupied = await findOccupiedApartment(
        harness.db,
        SEED_IDS.organizationA,
        tenant.userId,
      );

      // Le locataire a été INVITÉ sur un autre logement que celui de son bail :
      // c'est bien le bail qui porte l'occupation, pas l'invitation (DEC-046).
      expect(occupied?.id).toBe(apartment);
    });

    it('ne donne aucun logement à une personne sans bail actif', async () => {
      const tenant = await addTenant(harness, {
        apartmentId: await freshApartment(),
        phone: freshPhone(),
        ownerContext: owner,
        hashPassword,
      });

      expect(
        await findOccupiedApartment(harness.db, SEED_IDS.organizationA, tenant.userId),
      ).toBeNull();
    });
  });
});
