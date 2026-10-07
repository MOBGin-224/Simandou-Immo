import { createHash } from 'node:crypto';

import { count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { ResourceOutOfScopeError } from '../../src/lib/authorization/service';
import { InvitationTargetUnavailableError } from '../../src/modules/invitations/errors';
import {
  TenantInvitationConflictError,
  TenantValidationError,
} from '../../src/modules/tenants/errors';
import { inviteTenant } from '../../src/modules/tenants/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  DAY_MS,
  NOW,
  OPTIONS,
  addAccess,
  addApartment,
  addProperty,
  addScope,
  addUser,
  at,
  contextOf,
  freshPhone,
  readInvitation,
} from '../helpers/tenants';

/**
 * MVP-BACKLOG-029 : invitation d'un locataire (DEC-046).
 *
 * Contre une VRAIE base, avec la vraie migration : l'index d'unicité partiel, les
 * clés étrangères et les contraintes CHECK de `invitations` participent aux règles
 * testées, et des doublures les auraient ignorées.
 *
 * Les refus viennent d'abord (ADR-007) : une fonctionnalité non sécurisée ne fait
 * pas partie du MVP. Chaque test crée ses propres numéros ; aucun ne dépend de
 * l'ordre.
 *
 * Deux points de la décision sont éprouvés ici et nulle part ailleurs : le
 * périmètre se résout par le LOGEMENT, et l'invitation ne porte NI date d'entrée
 * NI loyer.
 */
describe("Invitation d'un locataire", () => {
  let harness: TestDatabase;
  let owner: Awaited<ReturnType<typeof contextOf>>;
  let manager: Awaited<ReturnType<typeof contextOf>>;
  let tenant: Awaited<ReturnType<typeof contextOf>>;
  let otherOwner: Awaited<ReturnType<typeof contextOf>>;

  /** Immeuble du périmètre du gestionnaire, et un autre qui n'y est pas. */
  let inScopeProperty: string;
  let outOfScopeProperty: string;

  let inScopeApartment: string;
  let outOfScopeApartment: string;
  let archivedApartment: string;
  let apartmentOfArchivedProperty: string;
  let otherOrganizationApartment: string;

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    const tenantUser = await addUser(harness, { fullName: 'Locataire de test' });
    await addAccess(harness, { userId: tenantUser.id, role: 'TENANT' });

    inScopeProperty = await addProperty(harness, 'Résidence Kipé');
    outOfScopeProperty = await addProperty(harness, 'Résidence Dixinn Nord');
    const archivedProperty = await addProperty(harness, 'Résidence Hors Service', {
      archived: true,
    });

    // Le gestionnaire du seed ne voit que l'immeuble A : on lui ajoute le premier,
    // et surtout pas le second, pour que le périmètre se vérifie réellement.
    await addScope(harness, SEED_IDS.accessManagerA, inScopeProperty);

    inScopeApartment = await addApartment(harness, inScopeProperty, 'K01');
    outOfScopeApartment = await addApartment(harness, outOfScopeProperty, 'D01');
    archivedApartment = await addApartment(harness, inScopeProperty, 'K99', { archived: true });
    apartmentOfArchivedProperty = await addApartment(harness, archivedProperty, 'H01');
    otherOrganizationApartment = await addApartment(harness, SEED_IDS.propertyB, 'B01', {
      organizationId: SEED_IDS.organizationB,
    });

    owner = await contextOf(harness, SEED_IDS.ownerA);
    manager = await contextOf(harness, SEED_IDS.managerA);
    otherOwner = await contextOf(harness, SEED_IDS.ownerB);
    tenant = await contextOf(harness, tenantUser.id);
  });

  afterAll(async () => {
    await harness.close();
  });

  /** Entrée valide, que chaque test modifie sur un seul point. */
  const input = (overrides: Record<string, unknown> = {}) => ({
    apartmentId: inScopeApartment,
    name: 'Mamadou Diallo',
    phone: freshPhone(),
    email: '',
    ...overrides,
  });

  const invite = (overrides: Record<string, unknown> = {}, context = owner) =>
    inviteTenant(harness.db, context, input(overrides), OPTIONS);

  const failureOf = (promise: Promise<unknown>) => promise.catch((error: unknown) => error);

  const countUsersWithPhone = async (phone: string) => {
    const [row] = await harness.db
      .select({ total: count() })
      .from(harness.schema.users)
      .where(eq(harness.schema.users.phone, phone));

    return row?.total ?? 0;
  };

  describe('Refus', () => {
    it("refuse un locataire qui tente d'inviter", async () => {
      await expect(invite({}, tenant)).rejects.toBeInstanceOf(ResourceOutOfScopeError);
    });

    it("refuse le propriétaire d'une autre organisation", async () => {
      await expect(invite({}, otherOwner)).rejects.toBeInstanceOf(ResourceOutOfScopeError);
    });

    it("refuse un logement d'une autre organisation", async () => {
      await expect(invite({ apartmentId: otherOrganizationApartment })).rejects.toBeInstanceOf(
        ResourceOutOfScopeError,
      );
    });

    it('refuse un logement inexistant', async () => {
      await expect(
        invite({ apartmentId: '00000000-0000-4000-8000-000000000999' }),
      ).rejects.toBeInstanceOf(ResourceOutOfScopeError);
    });

    /**
     * Le cœur du périmètre (DEC-046) : un gestionnaire n'invite que dans SES
     * immeubles, et le logement est le seul chemin qui porte cette information.
     */
    it("refuse au gestionnaire un logement hors de son périmètre d'immeubles", async () => {
      await expect(invite({ apartmentId: outOfScopeApartment }, manager)).rejects.toBeInstanceOf(
        ResourceOutOfScopeError,
      );
    });

    it('rend indiscernables un logement inexistant et un logement hors périmètre', async () => {
      const unknown = await failureOf(
        invite({ apartmentId: '00000000-0000-4000-8000-000000000999' }, manager),
      );
      const forbidden = await failureOf(invite({ apartmentId: outOfScopeApartment }, manager));

      expect((unknown as Error).name).toBe((forbidden as Error).name);
      expect((unknown as Error).message).toBe((forbidden as Error).message);
    });

    it('refuse un identifiant de logement mal formé', async () => {
      const error = await failureOf(invite({ apartmentId: 'pas-un-uuid' }));

      expect(error).toBeInstanceOf(TenantValidationError);
    });

    it('refuse un logement archivé', async () => {
      const error = await failureOf(invite({ apartmentId: archivedApartment }));

      expect(error).toBeInstanceOf(TenantValidationError);
      expect((error as TenantValidationError).fieldErrors.apartmentId?.[0]).toMatch(/archivé/);
    });

    it("refuse un logement dont l'immeuble est archivé", async () => {
      const error = await failureOf(invite({ apartmentId: apartmentOfArchivedProperty }));

      expect(error).toBeInstanceOf(TenantValidationError);
    });

    it('refuse un nom vide', async () => {
      const error = await failureOf(invite({ name: '   ' }));

      expect(error).toBeInstanceOf(TenantValidationError);
      expect((error as TenantValidationError).fieldErrors.name).toBeDefined();
    });

    it('refuse un numéro qui ne porte pas son indicatif', async () => {
      const error = await failureOf(invite({ phone: '620000000' }));

      expect(error).toBeInstanceOf(TenantValidationError);
      expect((error as TenantValidationError).fieldErrors.phone?.[0]).toMatch(/international/);
    });

    it("refuse le propriétaire de l'organisation comme locataire", async () => {
      const error = await failureOf(invite({ phone: '+224620000001' }));

      expect(error).toBeInstanceOf(TenantInvitationConflictError);
      expect((error as TenantInvitationConflictError).reason).toBe('already-owner');
    });

    it('refuse une personne qui a déjà un espace locataire actif', async () => {
      const person = await addUser(harness);

      await addAccess(harness, { userId: person.id, role: 'TENANT' });

      const error = await failureOf(invite({ phone: person.phone }));

      expect(error).toBeInstanceOf(TenantInvitationConflictError);
      expect((error as TenantInvitationConflictError).reason).toBe('already-tenant');
    });

    it('refuse une seconde invitation tant que la première est valable', async () => {
      const phone = freshPhone();

      await invite({ phone });

      const error = await failureOf(invite({ phone }));

      expect(error).toBeInstanceOf(TenantInvitationConflictError);
      expect((error as TenantInvitationConflictError).reason).toBe('invitation-open');
    });

    it('refuse un compte suspendu, sans dire pourquoi', async () => {
      const person = await addUser(harness, { status: 'SUSPENDED' });
      const error = await failureOf(invite({ phone: person.phone }));

      expect(error).toBeInstanceOf(InvitationTargetUnavailableError);
      expect((error as Error).message).not.toMatch(/suspendu/i);
    });

    it("n'écrit aucun utilisateur quand l'invitation est refusée", async () => {
      const phone = freshPhone();

      await failureOf(invite({ phone, apartmentId: archivedApartment }));

      expect(await countUsersWithPhone(phone)).toBe(0);
    });
  });

  describe('Invitation émise', () => {
    it('crée le profil préliminaire et son invitation', async () => {
      const phone = freshPhone();
      const issued = await invite({ phone, name: 'Fatoumata Camara' });

      expect(issued.invitation.fullName).toBe('Fatoumata Camara');
      expect(issued.invitation.phone).toBe(phone);
      expect(issued.invitation.status).toBe('PENDING');
      expect(await countUsersWithPhone(phone)).toBe(1);
    });

    /** Le contexte locatif prévu (BR-014, DEC-041) : le logement ET son immeuble. */
    it("porte le logement et son immeuble dans la ligne d'invitation", async () => {
      const issued = await invite();
      const row = await readInvitation(harness, issued.invitation.id);

      expect(row.role).toBe('TENANT');
      expect(row.apartmentId).toBe(inScopeApartment);
      expect(row.propertyId).toBe(inScopeProperty);
    });

    it('expose le logement dans la vue, avec le nom de son immeuble', async () => {
      const issued = await invite();

      expect(issued.invitation.apartment?.id).toBe(inScopeApartment);
      expect(issued.invitation.apartment?.number).toBe('K01');
      expect(issued.invitation.apartment?.propertyName).toBe('Résidence Kipé');
      expect(issued.invitation.apartment?.archived).toBe(false);
    });

    /**
     * La frontière du Lot 7 et du Lot 8 (DEC-046), vérifiée sur la vue renvoyée :
     * aucune date d'entrée, aucun montant, aucun champ financier.
     */
    it("ne porte ni date d'entrée ni montant de loyer", async () => {
      const issued = await invite();
      const fields = Object.keys(issued.invitation);

      expect(fields).not.toContain('startDate');
      expect(fields).not.toContain('rentAmount');
      expect(JSON.stringify(issued.invitation)).not.toMatch(/amount|currency|rent/i);
    });

    /** DEC-050 : l'invitation ne décide d'aucune occupation. */
    it("ne change pas le statut d'occupation du logement", async () => {
      const apartment = await addApartment(harness, inScopeProperty, 'K20');

      await invite({ apartmentId: apartment });

      const [row] = await harness.db
        .select({ status: harness.schema.apartments.status })
        .from(harness.schema.apartments)
        .where(eq(harness.schema.apartments.id, apartment));

      expect(row?.status).toBe('VACANT');
    });

    it('accepte un logement déjà occupé : le parcours sert à inscrire les locataires en place', async () => {
      const apartment = await addApartment(harness, inScopeProperty, 'K21', {
        status: 'OCCUPIED',
      });

      await expect(invite({ apartmentId: apartment })).resolves.toMatchObject({
        invitation: { status: 'PENDING' },
      });
    });

    it("permet au gestionnaire d'inviter dans son périmètre", async () => {
      const issued = await invite({}, manager);

      expect(issued.invitation.apartment?.id).toBe(inScopeApartment);
    });

    it('ne stocke que le hachage du jeton, jamais le jeton', async () => {
      const issued = await invite();
      const row = await readInvitation(harness, issued.invitation.id);

      expect(row.tokenHash).toBe(createHash('sha256').update(issued.token).digest('hex'));
      expect(row.tokenHash).not.toBe(issued.token);
    });

    it('construit le lien sur APP_URL et le chemin public', async () => {
      const issued = await invite();

      expect(issued.link).toBe(`https://immo.test/invitation/${issued.token}`);
    });

    it('fixe l expiration à la durée fournie', async () => {
      const issued = await invite();

      expect(issued.invitation.expiresAt.getTime()).toBe(at(7 * DAY_MS).getTime());
      expect(issued.invitation.issuedAt.getTime()).toBe(NOW.getTime());
    });

    it('réutilise le compte existant plutôt que d en créer un second', async () => {
      const person = await addUser(harness, { status: 'PENDING_ACTIVATION' });

      await invite({ phone: person.phone, name: 'Nom corrigé' });

      expect(await countUsersWithPhone(person.phone)).toBe(1);
    });

    it('ignore le nom saisi pour un compte déjà actif : il appartient à la personne', async () => {
      const person = await addUser(harness, { fullName: 'Nom réel', status: 'ACTIVE' });
      const issued = await invite({ phone: person.phone, name: 'Nom imposé' });

      expect(issued.invitation.fullName).toBe('Nom réel');
    });

    it('réinvite un locataire dont l accès a été révoqué (DEC-043)', async () => {
      const person = await addUser(harness);

      await addAccess(harness, { userId: person.id, role: 'TENANT', status: 'REVOKED' });

      await expect(invite({ phone: person.phone })).resolves.toMatchObject({
        invitation: { status: 'PENDING' },
      });
    });

    it('accepte un email facultatif laissé vide', async () => {
      const issued = await invite({ email: '   ' });

      expect(issued.invitation.email).toBeNull();
    });
  });
});
