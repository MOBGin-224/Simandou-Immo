import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { ResourceOutOfScopeError } from '../../src/lib/authorization/service';
import {
  acceptTenantInvitation,
  inviteTenant,
  listTenants,
  revokeTenant,
  revokeTenantInvitation,
  suspendTenant,
} from '../../src/modules/tenants/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  DAY_MS,
  OPTIONS,
  addAccess,
  addApartment,
  addProperty,
  addScope,
  addUser,
  at,
  contextOf,
  freshPhone,
  passwordHasher,
} from '../helpers/tenants';

/**
 * Liste des locataires (API section 15, DEC-046).
 *
 * Deux natures dans une seule liste, et un statut DÉRIVÉ. Le point le plus
 * délicat est le périmètre : le logement d'un locataire est porté par son
 * invitation, donc le filtre par immeuble d'un gestionnaire ne se résout
 * qu'après avoir rapproché l'accès de son invitation acceptée.
 */
describe('Liste des locataires', () => {
  let harness: TestDatabase;
  let owner: Awaited<ReturnType<typeof contextOf>>;
  let manager: Awaited<ReturnType<typeof contextOf>>;
  let otherOwner: Awaited<ReturnType<typeof contextOf>>;
  let tenantContext: Awaited<ReturnType<typeof contextOf>>;

  let inScopeProperty: string;
  let outOfScopeProperty: string;
  let inScopeApartment: string;
  let secondInScopeApartment: string;
  let outOfScopeApartment: string;
  let hashPassword: (password: string) => Promise<string>;

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    inScopeProperty = await addProperty(harness, 'Résidence Kipé');
    outOfScopeProperty = await addProperty(harness, 'Résidence Dixinn Nord');

    await addScope(harness, SEED_IDS.accessManagerA, inScopeProperty);

    inScopeApartment = await addApartment(harness, inScopeProperty, 'K01');
    secondInScopeApartment = await addApartment(harness, inScopeProperty, 'K02');
    outOfScopeApartment = await addApartment(harness, outOfScopeProperty, 'D01');

    owner = await contextOf(harness, SEED_IDS.ownerA);
    manager = await contextOf(harness, SEED_IDS.managerA);
    otherOwner = await contextOf(harness, SEED_IDS.ownerB);
    hashPassword = passwordHasher(harness);

    const someTenant = await addUser(harness);

    await addAccess(harness, { userId: someTenant.id, role: 'TENANT' });
    tenantContext = await contextOf(harness, someTenant.id);
  });

  afterAll(async () => {
    await harness.close();
  });

  const inviteOn = (apartmentId: string, name: string) =>
    inviteTenant(harness.db, owner, { apartmentId, name, phone: freshPhone(), email: '' }, OPTIONS);

  /**
   * Identifiant de la ressource locataire : celui de la PERSONNE (DEC-051).
   *
   * L'invitation le porte des son emission, le profil preliminaire etant cree en
   * meme temps qu'elle (BR-008). Avant DEC-051 la liste portait un identifiant
   * d'invitation, puis un identifiant d'acces, qui changeait a l'acceptation.
   */
  const personOf = (issued: Awaited<ReturnType<typeof inviteOn>>) =>
    issued.invitation.userId as string;

  const acceptOf = (token: string) =>
    acceptTenantInvitation(
      harness.db,
      { hashPassword },
      { token, password: 'mot-de-passe-solide' },
      OPTIONS,
    );

  const list = (context = owner, query: Record<string, unknown> = {}) =>
    listTenants(harness.db, context, query, OPTIONS);

  const idsOf = async (context = owner, query: Record<string, unknown> = {}) =>
    (await list(context, query)).tenants.map((item) => item.id);

  describe('Périmètre', () => {
    it('refuse un locataire : il ne voit aucun autre locataire', async () => {
      await expect(list(tenantContext)).rejects.toBeInstanceOf(ResourceOutOfScopeError);
    });

    it("ne montre rien au propriétaire d'une autre organisation", async () => {
      await inviteOn(inScopeApartment, 'Invisible ailleurs');

      expect(await idsOf(otherOwner)).toHaveLength(0);
    });

    it('montre au gestionnaire les locataires de son périmètre seulement', async () => {
      const inside = await inviteOn(inScopeApartment, 'Dans le périmètre');
      const outside = await inviteOn(outOfScopeApartment, 'Hors du périmètre');

      const visible = await idsOf(manager);

      expect(visible).toContain(personOf(inside));
      expect(visible).not.toContain(personOf(outside));
    });

    it('montre au propriétaire les deux, son autorité portant sur toute l organisation', async () => {
      const inside = await inviteOn(inScopeApartment, 'Partout visible A');
      const outside = await inviteOn(outOfScopeApartment, 'Partout visible B');

      const visible = await idsOf(owner);

      expect(visible).toContain(personOf(inside));
      expect(visible).toContain(personOf(outside));
    });

    /** Le périmètre d'un ACCÈS passe par son invitation acceptée (DEC-046). */
    it('applique le périmètre aux accès, par le logement de leur invitation acceptée', async () => {
      const issued = await inviteOn(outOfScopeApartment, 'Accepté hors périmètre');
      const accepted = await acceptOf(issued.token);

      expect(await idsOf(manager)).not.toContain(accepted.userId);
      expect(await idsOf(owner)).toContain(accepted.userId);
    });
  });

  describe('Composition', () => {
    it('réunit invitations et accès, distingués par leur nature', async () => {
      const pending = await inviteOn(inScopeApartment, 'En attente');
      const issued = await inviteOn(secondInScopeApartment, 'Déjà actif');
      const accepted = await acceptOf(issued.token);

      const collection = await list();
      const byId = new Map(collection.tenants.map((item) => [item.id, item]));

      expect(byId.get(personOf(pending))?.status).toBe('INVITED');
      expect(byId.get(personOf(pending))?.invitationId).toBe(pending.invitation.id);
      expect(byId.get(personOf(pending))?.accessId).toBeNull();
      expect(byId.get(accepted.userId)?.status).toBe('ACTIVE');
      expect(byId.get(accepted.userId)?.accessId).toBe(accepted.accessId);
      expect(byId.get(accepted.userId)?.invitationId).toBeNull();
    });

    it("garde le MÊME identifiant avant et après l'acceptation", async () => {
      const issued = await inviteOn(inScopeApartment, 'Même personne');

      expect(await idsOf()).toContain(personOf(issued));

      const accepted = await acceptOf(issued.token);
      const after = await idsOf();

      /*
       * C'est tout l'intérêt de DEC-051 : l'identité ne change pas quand le droit
       * d'accès apparaît. Avant, l'identifiant de la ressource passait de
       * l'invitation à l'accès, et la personne semblait changer d'identité en
       * ouvrant son espace.
       */
      expect(accepted.userId).toBe(personOf(issued));
      expect(after.filter((id) => id === accepted.userId)).toHaveLength(1);
    });

    it('ne montre pas une invitation révoquée', async () => {
      const issued = await inviteOn(inScopeApartment, 'Révoquée');

      await revokeTenantInvitation(harness.db, owner, issued.invitation.id, OPTIONS);

      // Plus d'invitation ouverte, pas d'acces, pas de bail : plus aucune trace de
      // relation locative, donc la personne n'est plus locataire de l'organisation.
      expect(await idsOf()).not.toContain(personOf(issued));
    });

    it('porte le logement de chaque élément', async () => {
      const issued = await inviteOn(inScopeApartment, 'Avec logement');
      const collection = await list();
      const item = collection.tenants.find((entry) => entry.id === personOf(issued));

      // Sans bail, c'est l'invitation qui porte le logement (DEC-046).
      expect(item?.apartmentSource).toBe('INVITATION');
      expect(item?.apartment?.number).toBe('K01');
      expect(item?.apartment?.propertyName).toBe('Résidence Kipé');
    });

    /** DEC-046 : aucun montant dans la liste du Lot 7. */
    it('ne porte aucun montant', async () => {
      await inviteOn(inScopeApartment, 'Sans montant');

      expect(JSON.stringify((await list()).tenants)).not.toMatch(/amount|currency|rent/i);
    });
  });

  describe('Statut dérivé', () => {
    it("dérive INVITATION_EXPIRED de la date, sans l'écrire en base", async () => {
      const issued = await inviteOn(inScopeApartment, 'Expirée');

      const later = await listTenants(harness.db, owner, {}, { ...OPTIONS, now: at(8 * DAY_MS) });
      const item = later.tenants.find((entry) => entry.id === personOf(issued));

      expect(item?.status).toBe('INVITATION_EXPIRED');
    });

    it('reflète la suspension et la révocation d un accès', async () => {
      const suspendedIssued = await inviteOn(inScopeApartment, 'Suspendu');
      const suspended = await acceptOf(suspendedIssued.token);
      const revokedIssued = await inviteOn(secondInScopeApartment, 'Révoqué');
      const revoked = await acceptOf(revokedIssued.token);

      await suspendTenant(harness.db, owner, suspended.userId, OPTIONS);
      await revokeTenant(harness.db, owner, revoked.userId, OPTIONS);

      const byId = new Map((await list()).tenants.map((item) => [item.id, item]));

      expect(byId.get(suspended.userId)?.status).toBe('SUSPENDED');
      expect(byId.get(revoked.userId)?.status).toBe('REVOKED');
    });
  });

  describe('Filtres et pagination', () => {
    it('filtre par immeuble', async () => {
      const inside = await inviteOn(inScopeApartment, 'Filtré dedans');
      const outside = await inviteOn(outOfScopeApartment, 'Filtré dehors');

      const visible = await idsOf(owner, { propertyId: inScopeProperty });

      expect(visible).toContain(personOf(inside));
      expect(visible).not.toContain(personOf(outside));
    });

    it('filtre par logement', async () => {
      const first = await inviteOn(inScopeApartment, 'Logement un');
      const second = await inviteOn(secondInScopeApartment, 'Logement deux');

      const visible = await idsOf(owner, { apartmentId: inScopeApartment });

      expect(visible).toContain(personOf(first));
      expect(visible).not.toContain(personOf(second));
    });

    it('filtre par statut', async () => {
      const issued = await inviteOn(inScopeApartment, 'Statut filtré');
      const accepted = await acceptOf(issued.token);

      const invited = await idsOf(owner, { status: 'INVITED' });
      const active = await idsOf(owner, { status: 'ACTIVE' });

      expect(active).toContain(accepted.userId);
      expect(invited).not.toContain(accepted.userId);
    });

    it('cherche par nom, sans tenir compte de la casse', async () => {
      const issued = await inviteOn(inScopeApartment, 'Ousmane Sylla');

      expect(await idsOf(owner, { search: 'ousmane' })).toContain(personOf(issued));
      expect(await idsOf(owner, { search: 'personne-inconnue' })).toHaveLength(0);
    });

    it('cherche par téléphone', async () => {
      const phone = freshPhone();
      const issued = await inviteTenant(
        harness.db,
        owner,
        { apartmentId: inScopeApartment, name: 'Trouvable par numéro', phone, email: '' },
        OPTIONS,
      );

      expect(await idsOf(owner, { search: phone })).toContain(personOf(issued));
    });

    it('pagine, et annonce le total avant pagination', async () => {
      const collection = await list(owner, { pageSize: 2, page: 1 });

      expect(collection.tenants.length).toBeLessThanOrEqual(2);
      expect(collection.meta.pageSize).toBe(2);
      expect(collection.meta.page).toBe(1);
      expect(collection.meta.total).toBeGreaterThan(2);
    });

    it("refuse une taille de page que le serveur n'accorde pas", async () => {
      await expect(list(owner, { pageSize: 5000 })).rejects.toThrow();
    });
  });

  describe('Ordre', () => {
    it('place ce qui appelle une action avant les locataires actifs', async () => {
      const collection = await list();
      const positions = collection.tenants.map((item) => item.status);
      const firstActive = positions.indexOf('ACTIVE');
      const lastInvited = positions.lastIndexOf('INVITED');

      if (firstActive !== -1 && lastInvited !== -1) {
        expect(lastInvited).toBeLessThan(firstActive);
      }
    });
  });
});
