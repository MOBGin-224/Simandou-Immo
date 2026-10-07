import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { ResourceOutOfScopeError } from '../../src/lib/authorization/service';
import { createLease, terminateLease } from '../../src/modules/leases/service';
import {
  TenantNoAccessError,
  TenantOrganizationRequiredError,
} from '../../src/modules/tenants/errors';
import {
  acceptTenantInvitation,
  getTenant,
  inviteTenant,
  listTenants,
  revokeTenantInvitation,
  suspendTenant,
} from '../../src/modules/tenants/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  OPTIONS as LEASE_OPTIONS,
  TODAY,
  addAccess,
  addApartment,
  addProperty,
  addUser,
  contextOf,
  freshPhone,
  passwordHasher,
} from '../helpers/leases';
import { OPTIONS } from '../helpers/tenants';

/**
 * DEC-051 : le locataire est une PERSONNE, pas un accès.
 *
 * Ce fichier éprouve ce que la décision a rendu possible, et que l'ancien modèle
 * interdisait :
 *
 *   1. une personne est locataire **sans aucun accès** au produit, et figure dans
 *      la liste des locataires ;
 *   2. son identifiant est celui de la personne, et il ne change pas quand un
 *      droit d'accès apparaît ou disparaît ;
 *   3. les opérations d'accès, qui agissent sur le droit et non sur l'identité,
 *      la refusent proprement quand il n'y a pas de droit ;
 *   4. la ressource est le couple personne et organisation, et le produit ne
 *      devine jamais laquelle quand plusieurs conviennent.
 */
describe('Le locataire est une personne, pas un accès (DEC-051)', () => {
  let harness: TestDatabase;
  let owner: Awaited<ReturnType<typeof contextOf>>;
  let property: string;
  let hashPassword: (password: string) => Promise<string>;

  let counter = 0;
  const freshApartment = async (propertyId = property, organizationId?: string) => {
    counter += 1;

    return addApartment(harness, propertyId, `I${String(counter).padStart(3, '0')}`, {
      organizationId,
    });
  };

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    property = await addProperty(harness, 'Résidence Kipé');
    owner = await contextOf(harness, SEED_IDS.ownerA);
    hashPassword = passwordHasher(harness);
  });

  afterAll(async () => {
    await harness.close();
  });

  /**
   * Une personne locataire qui n'a AUCUN accès à l'application.
   *
   * Elle est invitée, puis son invitation est révoquée avant toute acceptation :
   * la personne demeure, connue de l'organisation, sans compte utilisable. C'est
   * la situation que DEC-051 veut représenter, et elle est atteignable dès
   * aujourd'hui, sans attendre la création d'une personne depuis le bail.
   */
  const personWithoutAccess = async (
    fullName = 'Sans Compte Camara',
    context = owner,
    organizationId?: string,
    propertyId?: string,
  ): Promise<{ id: string; phone: string }> => {
    const phone = freshPhone();
    const issued = await inviteTenant(
      harness.db,
      context,
      {
        apartmentId: await freshApartment(propertyId, organizationId),
        name: fullName,
        phone,
        email: '',
      },
      OPTIONS,
    );

    await revokeTenantInvitation(harness.db, context, issued.invitation.id, OPTIONS);

    return { id: issued.invitation.userId as string, phone };
  };

  /** Un bail sur un logement neuf, pour la personne indiquée. */
  const leaseFor = async (userId: string, apartmentId?: string) =>
    createLease(
      harness.db,
      owner,
      {
        apartmentId: apartmentId ?? (await freshApartment()),
        tenantId: userId,
        startDate: TODAY,
        rentAmount: 1_500_000,
        currency: 'GNF',
        dueDay: 5,
      },
      LEASE_OPTIONS,
    );

  const list = (context = owner, query: Record<string, unknown> = {}) =>
    listTenants(harness.db, context, query, OPTIONS);

  const itemOf = async (userId: string, context = owner) =>
    (await list(context, { pageSize: 100 })).tenants.find((entry) => entry.id === userId);

  const failureOf = (promise: Promise<unknown>) => promise.catch((error: unknown) => error);

  describe("Un locataire sans accès à l'application", () => {
    it('figure dans la liste des locataires, au statut sans accès', async () => {
      const person = await personWithoutAccess('Fatoumata Sans Compte');

      await leaseFor(person.id);

      const item = await itemOf(person.id);

      expect(item).toBeDefined();
      expect(item?.status).toBe('NO_ACCESS');
      expect(item?.accessId).toBeNull();
      expect(item?.invitationId).toBeNull();
      expect(item?.fullName).toBe('Fatoumata Sans Compte');
    });

    it('porte le logement de son bail, et dit que le bail en est la source', async () => {
      const person = await personWithoutAccess();
      const apartment = await freshApartment();

      await leaseFor(person.id, apartment);

      const item = await itemOf(person.id);

      expect(item?.apartment?.id).toBe(apartment);
      expect(item?.apartmentSource).toBe('LEASE');
      expect(item?.leaseId).not.toBeNull();
    });

    it('a une fiche consultable, comme tout locataire', async () => {
      const person = await personWithoutAccess('Fiche Sans Compte');

      await leaseFor(person.id);

      const view = await getTenant(harness.db, owner, person.id);

      expect(view.id).toBe(person.id);
      expect(view.fullName).toBe('Fiche Sans Compte');
      expect(view.status).toBe('NO_ACCESS');
      expect(view.accessId).toBeNull();
    });

    /** Les opérations d'accès agissent sur le DROIT, jamais sur l'identité. */
    it("ne se suspend pas : il n'y a aucun accès à suspendre", async () => {
      const person = await personWithoutAccess();

      await leaseFor(person.id);

      const error = await failureOf(suspendTenant(harness.db, owner, person.id, OPTIONS));

      expect(error).toBeInstanceOf(TenantNoAccessError);
      expect((error as Error).message).toMatch(/aucun accès/i);
    });

    it('reste dans la liste après la clôture de son bail, sans logement', async () => {
      const person = await personWithoutAccess();
      const lease = await leaseFor(person.id);

      await terminateLease(harness.db, owner, lease.id, { terminationDate: TODAY }, LEASE_OPTIONS);

      const item = await itemOf(person.id);

      // Le bail terminé appartient à l'historique (DEC-013), qu'on ne supprime
      // pas : la personne demeure locataire de l'organisation, et seul le
      // logement disparaît, puisque c'est le bail EN COURS qui le porte.
      expect(item?.status).toBe('NO_ACCESS');
      expect(item?.apartment).toBeNull();
      expect(item?.apartmentSource).toBe('NONE');
      expect(item?.leaseId).toBeNull();
    });

    it("n'apparaît pas chez un autre bailleur", async () => {
      const person = await personWithoutAccess();

      await leaseFor(person.id);

      const otherOwner = await contextOf(harness, SEED_IDS.ownerB);

      expect(await itemOf(person.id, otherOwner)).toBeUndefined();
    });
  });

  describe("L'identité ne change pas quand l'accès apparaît", () => {
    it("garde le même identifiant de l'invitation au bail", async () => {
      const apartment = await freshApartment();
      const phone = freshPhone();

      const issued = await inviteTenant(
        harness.db,
        owner,
        { apartmentId: apartment, name: 'Invitée puis logée', phone, email: '' },
        OPTIONS,
      );

      const personId = issued.invitation.userId;

      expect(personId).not.toBeNull();

      const accepted = await acceptTenantInvitation(
        harness.db,
        { hashPassword },
        { token: issued.token, password: 'mot-de-passe-solide' },
        OPTIONS,
      );

      expect(accepted.userId).toBe(personId);

      const lease = await leaseFor(accepted.userId);

      expect(lease.tenant.userId).toBe(personId);

      const item = await itemOf(accepted.userId);

      expect(item?.status).toBe('ACTIVE');
      expect(item?.accessId).toBe(accepted.accessId);
      // Le bail prime sur l'invitation pour le logement (DEC-046, DEC-051).
      expect(item?.apartmentSource).toBe('LEASE');
      expect(item?.apartment?.id).not.toBe(apartment);
    });

    it('reçoit un accès plus tard sans devenir une seconde personne', async () => {
      const person = await personWithoutAccess('Logée puis invitée');

      await leaseFor(person.id);

      // On l'invite ENSUITE, sur son numéro : le compte existant est réutilisé
      // (DEC-041) plutôt que dédoublé.
      const issued = await inviteTenant(
        harness.db,
        owner,
        {
          apartmentId: await freshApartment(),
          name: 'Logée puis invitée',
          phone: person.phone,
          email: '',
        },
        OPTIONS,
      );

      expect(issued.invitation.userId).toBe(person.id);

      const item = await itemOf(person.id);

      expect(item?.status).toBe('INVITED');
      expect(item?.invitationId).toBe(issued.invitation.id);
      // Son bail reste le sien, et continue de porter le logement.
      expect(item?.apartmentSource).toBe('LEASE');
    });
  });

  describe('La ressource est le couple personne et organisation', () => {
    it("exige l'organisation quand plusieurs la connaissent, plutôt que de deviner", async () => {
      // Le propriétaire A devient aussi propriétaire de l'organisation B : il lit
      // alors deux organisations, ce que `users.id` seul ne distingue pas.
      await addAccess(harness, {
        userId: SEED_IDS.ownerA,
        role: 'OWNER',
        organizationId: SEED_IDS.organizationB,
      });

      const both = await contextOf(harness, SEED_IDS.ownerA);
      const propertyB = await addProperty(harness, 'Résidence Dixinn B', {
        organizationId: SEED_IDS.organizationB,
      });

      const person = await personWithoutAccess('Locataire des deux côtés', both);

      await createLease(
        harness.db,
        both,
        {
          apartmentId: await freshApartment(),
          tenantId: person.id,
          startDate: TODAY,
          rentAmount: 1_000_000,
          currency: 'GNF',
          dueDay: 1,
        },
        LEASE_OPTIONS,
      );

      // La même personne est invitée dans l'organisation B, puis y reçoit un bail.
      const inviteB = await inviteTenant(
        harness.db,
        both,
        {
          apartmentId: await freshApartment(propertyB, SEED_IDS.organizationB),
          name: 'Locataire des deux côtés',
          phone: person.phone,
          email: '',
        },
        OPTIONS,
      );

      await revokeTenantInvitation(harness.db, both, inviteB.invitation.id, OPTIONS);

      await createLease(
        harness.db,
        both,
        {
          apartmentId: await freshApartment(propertyB, SEED_IDS.organizationB),
          tenantId: person.id,
          startDate: TODAY,
          rentAmount: 2_000_000,
          currency: 'GNF',
          dueDay: 2,
        },
        LEASE_OPTIONS,
      );

      const error = await failureOf(getTenant(harness.db, both, person.id));

      expect(error).toBeInstanceOf(TenantOrganizationRequiredError);
      expect((error as TenantOrganizationRequiredError).organizationIds).toHaveLength(2);

      // Désignée, elle lève l'ambiguïté : chaque organisation a sa relation.
      const inA = await getTenant(harness.db, both, person.id, {
        organizationId: SEED_IDS.organizationA,
      });
      const inB = await getTenant(harness.db, both, person.id, {
        organizationId: SEED_IDS.organizationB,
      });

      expect(inA.organizationId).toBe(SEED_IDS.organizationA);
      expect(inB.organizationId).toBe(SEED_IDS.organizationB);
      expect(inA.id).toBe(inB.id);
      expect(inA.apartment?.id).not.toBe(inB.apartment?.id);
    });

    it("refuse une personne qu'aucune organisation lisible ne connaît", async () => {
      const stranger = await addUser(harness);

      await expect(getTenant(harness.db, owner, stranger.id)).rejects.toBeInstanceOf(
        ResourceOutOfScopeError,
      );
    });
  });
});
