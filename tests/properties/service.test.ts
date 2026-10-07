import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { properties as propertiesTable } from '../../src/db/schema';
import { SEED_IDS, seed } from '../../src/db/seed';
import { loadAccessContext } from '../../src/lib/authorization/access-context';
import {
  PermissionDeniedError,
  ResourceOutOfScopeError,
} from '../../src/lib/authorization/service';
import {
  ArchivedPropertyError,
  PropertyNameAlreadyUsedError,
  PropertyValidationError,
} from '../../src/modules/properties/errors';
import {
  archiveProperty,
  createProperty,
  getProperty,
  listProperties,
  updateProperty,
} from '../../src/modules/properties/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';

/**
 * MVP-BACKLOG-019 : création, modification, archivage, permissions, isolation.
 *
 * Contre une VRAIE base, avec la vraie migration : les contraintes d'unicité, les
 * clés étrangères et les vérifications CHECK participent aux règles testées ici, et
 * des doublures les auraient simplement ignorées.
 *
 * Le jeu de données est celui du seed, qui contient déjà ce qu'il faut : deux
 * organisations, donc l'isolation est vérifiable, et un gestionnaire dont le
 * périmètre ne couvre qu'un immeuble, donc le refus hors périmètre l'est aussi.
 *
 * Une seule base pour tout le fichier : migrer PostgreSQL à chaque test coûterait
 * plusieurs minutes. Chaque test crée donc ses propres immeubles, avec des noms
 * distincts, et n'archive que ceux qu'il a créés. Aucun test ne dépend de l'ordre.
 */
describe('Cas d usage du module Immeubles', () => {
  let harness: TestDatabase;
  let owner: Awaited<ReturnType<typeof loadAccessContext>>;
  let manager: Awaited<ReturnType<typeof loadAccessContext>>;
  let otherOwner: Awaited<ReturnType<typeof loadAccessContext>>;

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    owner = await loadAccessContext(harness.db, SEED_IDS.ownerA);
    manager = await loadAccessContext(harness.db, SEED_IDS.managerA);
    otherOwner = await loadAccessContext(harness.db, SEED_IDS.ownerB);
  });

  afterAll(async () => {
    await harness.close();
  });

  /** Crée un immeuble au nom de l'organisation A, en tant que propriétaire. */
  const createForOwner = (name: string, extra: Record<string, unknown> = {}) =>
    createProperty(harness.db, owner, {
      organizationId: SEED_IDS.organizationA,
      name,
      ...extra,
    });

  describe('Création', () => {
    it('crée un immeuble et le rend consultable', async () => {
      const created = await createForOwner('  Résidence   Kaloum  ', {
        district: 'Kaloum',
        city: 'Conakry',
      });

      expect(created.name).toBe('Résidence Kaloum');
      expect(created.location).toBe('Kaloum, Conakry');
      expect(created.archived).toBe(false);
      expect(created.occupancy.apartmentCount).toBe(0);

      const read = await getProperty(harness.db, owner, created.id);

      expect(read.id).toBe(created.id);
    });

    it('refuse un nom vide, en désignant le champ fautif', async () => {
      const failure = await createForOwner('   ').catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(PropertyValidationError);
      expect((failure as PropertyValidationError).fieldErrors.name).toBeDefined();
    });

    it('refuse un nom déjà utilisé dans la même organisation', async () => {
      await expect(createForOwner('Immeuble Camayenne')).rejects.toBeInstanceOf(
        PropertyNameAlreadyUsedError,
      );
    });

    /** L'unicité est par organisation : deux propriétaires peuvent employer le même nom. */
    it('accepte le même nom dans une autre organisation', async () => {
      const created = await createProperty(harness.db, otherOwner, {
        organizationId: SEED_IDS.organizationB,
        name: 'Immeuble Camayenne',
      });

      expect(created.organizationId).toBe(SEED_IDS.organizationB);
    });
  });

  describe('Permissions de création', () => {
    /**
     * Refus attendu, et c'est bien `out-of-scope` et non `permission-denied` : la
     * création vise l'ORGANISATION, or ADR-007 borne l'autorité d'un gestionnaire à
     * un périmètre d'immeubles. Une ressource sans immeuble sort de son périmètre.
     */
    it('refuse la création à un gestionnaire (DEC-025)', async () => {
      await expect(
        createProperty(harness.db, manager, {
          organizationId: SEED_IDS.organizationA,
          name: 'Immeuble du gestionnaire',
        }),
      ).rejects.toBeInstanceOf(ResourceOutOfScopeError);
    });

    it("refuse à un propriétaire de créer dans une organisation qui n'est pas la sienne", async () => {
      await expect(
        createProperty(harness.db, owner, {
          organizationId: SEED_IDS.organizationB,
          name: 'Tentative inter-organisations',
        }),
      ).rejects.toBeInstanceOf(ResourceOutOfScopeError);
    });
  });

  describe('Liste et isolation', () => {
    it('ne montre au propriétaire que les immeubles de son organisation', async () => {
      const collection = await listProperties(harness.db, owner, {});
      const names = collection.properties.map((property) => property.name);

      expect(names).toContain('Immeuble Camayenne');
      expect(names).not.toContain('Immeuble Dixinn');

      for (const property of collection.properties) {
        expect(property.organizationId).toBe(SEED_IDS.organizationA);
      }
    });

    it('ne montre au gestionnaire que les immeubles de son périmètre', async () => {
      await createForOwner('Immeuble hors périmètre du gestionnaire');

      const collection = await listProperties(harness.db, manager, {});

      expect(collection.properties).toHaveLength(1);
      expect(collection.properties[0]?.id).toBe(SEED_IDS.propertyA);
    });

    it('cherche dans le nom, la ville et le quartier', async () => {
      await createForOwner('Villa Ratoma', { district: 'Ratoma', city: 'Conakry' });

      const byName = await listProperties(harness.db, owner, { search: 'villa' });
      const byDistrict = await listProperties(harness.db, owner, { search: 'ratoma' });

      expect(byName.properties.map((property) => property.name)).toContain('Villa Ratoma');
      expect(byDistrict.properties.map((property) => property.name)).toContain('Villa Ratoma');
    });

    /**
     * Un joker saisi par l'utilisateur doit être cherché littéralement. Sans
     * échappement, « % » ramènerait tout, ce qui est incompréhensible côté écran.
     */
    it('traite les caractères génériques comme du texte', async () => {
      const collection = await listProperties(harness.db, owner, { search: '%' });

      expect(collection.properties).toHaveLength(0);
    });

    it('borne la page et annonce le nombre de pages', async () => {
      const collection = await listProperties(harness.db, owner, { pageSize: '1' });

      expect(collection.properties).toHaveLength(1);
      expect(collection.meta.pageSize).toBe(1);
      expect(collection.meta.pageCount).toBe(collection.meta.total);
    });

    /** Ne rien confirmer : une organisation étrangère renvoie une liste vide, pas une erreur. */
    it("renvoie une collection vide pour une organisation qui n'est pas la sienne", async () => {
      const collection = await listProperties(harness.db, owner, {
        organizationId: SEED_IDS.organizationB,
      });

      expect(collection.properties).toHaveLength(0);
      expect(collection.meta.total).toBe(0);
    });

    /**
     * DEC-050 : l'occupation vient des BAUX, et les travaux sont a part.
     *
     * Les trois logements du seed n'ont aucun bail, donc ils sont tous vacants.
     * L'un porte des travaux declares, et ce chiffre CHEVAUCHE les vacants :
     * c'est voulu, un logement en travaux restant vide ou loue. Additionner les
     * trois compteurs annoncerait quatre logements la ou il y en a trois.
     */
    it("compte les logements de l'immeuble, les travaux chevauchant l'occupation", async () => {
      const property = await getProperty(harness.db, owner, SEED_IDS.propertyA);

      expect(property.occupancy.apartmentCount).toBe(3);
      expect(property.occupancy.occupiedCount).toBe(0);
      expect(property.occupancy.vacantCount).toBe(3);
      expect(property.occupancy.maintenanceCount).toBe(1);
    });
  });

  describe('Consultation', () => {
    it("refuse l'immeuble d'une autre organisation", async () => {
      await expect(getProperty(harness.db, otherOwner, SEED_IDS.propertyA)).rejects.toBeInstanceOf(
        ResourceOutOfScopeError,
      );
    });

    it('refuse un identifiant inexistant, de la même façon', async () => {
      await expect(
        getProperty(harness.db, owner, '0a000000-0000-4000-8000-00000000ffff'),
      ).rejects.toBeInstanceOf(ResourceOutOfScopeError);
    });

    /**
     * Sans ce contrôle, PostgreSQL refuserait la conversion et l'utilisateur
     * recevrait une erreur interne là où la réponse correcte est « inexistant ».
     */
    it("refuse un identifiant qui n'est pas un UUID, sans erreur interne", async () => {
      await expect(getProperty(harness.db, owner, 'pas-un-uuid')).rejects.toBeInstanceOf(
        ResourceOutOfScopeError,
      );
    });
  });

  describe('Modification', () => {
    it('autorise le gestionnaire sur son périmètre', async () => {
      const updated = await updateProperty(harness.db, manager, SEED_IDS.propertyA, {
        description: 'Immeuble de quatre niveaux, face à la corniche.',
      });

      expect(updated.description).toBe('Immeuble de quatre niveaux, face à la corniche.');
    });

    it('refuse au gestionnaire un immeuble hors de son périmètre', async () => {
      const outside = await createForOwner('Immeuble Matoto');

      await expect(
        updateProperty(harness.db, manager, outside.id, { city: 'Conakry' }),
      ).rejects.toBeInstanceOf(ResourceOutOfScopeError);
    });

    it("refuse l'immeuble d'une autre organisation", async () => {
      await expect(
        updateProperty(harness.db, otherOwner, SEED_IDS.propertyA, { city: 'Kindia' }),
      ).rejects.toBeInstanceOf(ResourceOutOfScopeError);
    });

    it('efface un champ facultatif soumis vide', async () => {
      const property = await createForOwner('Immeuble Coyah', { city: 'Coyah' });
      const updated = await updateProperty(harness.db, owner, property.id, { city: '' });

      expect(updated.city).toBeNull();
    });

    /**
     * Une soumission sans changement ne doit RIEN écrire : sinon, ouvrir un
     * formulaire et le refermer ferait apparaître une modification fantôme dans le
     * futur journal d'activité.
     */
    it("n'écrit rien quand la soumission est identique", async () => {
      const property = await createForOwner('Immeuble Dubréka', { city: 'Dubréka' });

      const [before] = await harness.db
        .select({ updatedAt: propertiesTable.updatedAt })
        .from(propertiesTable)
        .where(eq(propertiesTable.id, property.id));

      await updateProperty(harness.db, owner, property.id, {
        name: 'Immeuble Dubréka',
        city: 'Dubréka',
      });

      const [after] = await harness.db
        .select({ updatedAt: propertiesTable.updatedAt })
        .from(propertiesTable)
        .where(eq(propertiesTable.id, property.id));

      expect(after?.updatedAt.getTime()).toBe(before?.updatedAt.getTime());
    });

    it('refuse un renommage vers un nom déjà pris', async () => {
      const property = await createForOwner('Immeuble Sonfonia');

      await expect(
        updateProperty(harness.db, owner, property.id, { name: 'Immeuble Camayenne' }),
      ).rejects.toBeInstanceOf(PropertyNameAlreadyUsedError);
    });

    it('accepte un renommage vers son propre nom', async () => {
      const property = await createForOwner('Immeuble Kipé');
      const updated = await updateProperty(harness.db, owner, property.id, {
        name: 'Immeuble Kipé',
        city: 'Conakry',
      });

      expect(updated.city).toBe('Conakry');
    });
  });

  describe('Archivage', () => {
    /**
     * LE test qui distingue les deux refus. Le gestionnaire ATTEINT l'immeuble, il
     * est dans son périmètre : le refus porte donc sur la permission, et doit devenir
     * un 403 et non un 404. L'inverse divulguerait une information au premier cas, et
     * masquerait une erreur de droits au second.
     */
    it('refuse au gestionnaire, pour défaut de permission et non de périmètre', async () => {
      await expect(archiveProperty(harness.db, manager, SEED_IDS.propertyA)).rejects.toBeInstanceOf(
        PermissionDeniedError,
      );
    });

    it("refuse l'immeuble d'une autre organisation, pour défaut de périmètre", async () => {
      await expect(
        archiveProperty(harness.db, otherOwner, SEED_IDS.propertyA),
      ).rejects.toBeInstanceOf(ResourceOutOfScopeError);
    });

    it('archive sans rien supprimer', async () => {
      const property = await createForOwner('Immeuble Lambanyi');
      const archived = await archiveProperty(harness.db, owner, property.id);

      expect(archived.archived).toBe(true);
      expect(archived.archivedAt).not.toBeNull();

      // La ligne existe toujours : l'archivage n'est pas une suppression (BR-025).
      const rows = await harness.db
        .select()
        .from(propertiesTable)
        .where(eq(propertiesTable.id, property.id));

      expect(rows).toHaveLength(1);
    });

    it('refuse un second archivage', async () => {
      const property = await createForOwner('Immeuble Nongo');

      await archiveProperty(harness.db, owner, property.id);

      await expect(archiveProperty(harness.db, owner, property.id)).rejects.toBeInstanceOf(
        ArchivedPropertyError,
      );
    });

    it('refuse toute modification après archivage', async () => {
      const property = await createForOwner('Immeuble Taouyah');

      await archiveProperty(harness.db, owner, property.id);

      await expect(
        updateProperty(harness.db, owner, property.id, { city: 'Conakry' }),
      ).rejects.toBeInstanceOf(ArchivedPropertyError);
    });

    it('retire l immeuble de la liste active tout en le gardant consultable', async () => {
      const property = await createForOwner('Immeuble Enta');

      await archiveProperty(harness.db, owner, property.id);

      const active = await listProperties(harness.db, owner, { filter: 'ACTIVE' });
      const archived = await listProperties(harness.db, owner, { filter: 'ARCHIVED' });
      const all = await listProperties(harness.db, owner, { filter: 'ALL' });

      const contains = (collection: { properties: { id: string }[] }) =>
        collection.properties.some((item) => item.id === property.id);

      expect(contains(active)).toBe(false);
      expect(contains(archived)).toBe(true);
      expect(contains(all)).toBe(true);

      // Et la fiche reste lisible : l'historique n'est pas fermé.
      await expect(getProperty(harness.db, owner, property.id)).resolves.toMatchObject({
        archived: true,
      });
    });
  });
});
