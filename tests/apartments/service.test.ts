import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { apartments as apartmentsTable, properties as propertiesTable } from '../../src/db/schema';
import { SEED_IDS, seed } from '../../src/db/seed';
import { loadAccessContext } from '../../src/lib/authorization/access-context';
import {
  PermissionDeniedError,
  ResourceOutOfScopeError,
} from '../../src/lib/authorization/service';
import {
  AlreadyArchivedApartmentError,
  ApartmentBulkConflictError,
  ApartmentNumberAlreadyUsedError,
  ApartmentValidationError,
  ArchivedApartmentError,
} from '../../src/modules/apartments/errors';
import {
  createApartment,
  archiveApartment,
  createApartmentsBulk,
  generateApartments,
  getApartment,
  listApartments,
  updateApartment,
} from '../../src/modules/apartments/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';

/**
 * MVP-BACKLOG-021 : création, modification, permissions, isolation.
 *
 * Contre une VRAIE base, avec la vraie migration : l'unicité
 * `(property_id, number)`, les contraintes CHECK sur la surface et sur le couple
 * montant et devise participent aux règles testées ici, et des doublures les
 * auraient simplement ignorées.
 *
 * Le jeu de données est celui du seed : deux organisations, donc l'isolation est
 * vérifiable, et un gestionnaire dont le périmètre ne couvre qu'un immeuble,
 * donc le refus hors périmètre l'est aussi.
 *
 * Une seule base pour tout le fichier : migrer PostgreSQL à chaque test
 * coûterait plusieurs minutes. Chaque test crée donc ses propres logements, avec
 * des références distinctes. Aucun test ne dépend de l'ordre.
 */
describe('Cas d usage du module Appartements', () => {
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

  /** Crée un logement dans l'immeuble A, en tant que propriétaire. */
  const createForOwner = (number: string, extra: Record<string, unknown> = {}) =>
    createApartment(harness.db, owner, SEED_IDS.propertyA, { number, ...extra });

  describe('Création', () => {
    it('crée un appartement et le rend consultable', async () => {
      const created = await createForOwner('  T 01  ', { floor: '2', type: 'T2', area: '45,5' });

      expect(created.number).toBe('T 01');
      expect(created.area).toBe(45.5);
      // Vacant par construction : un logement neuf ne peut porter aucun bail.
      expect(created.occupancy).toBe('VACANT');
      expect(created.underMaintenance).toBe(false);
      expect(created.propertyId).toBe(SEED_IDS.propertyA);

      const read = await getApartment(harness.db, owner, created.id);

      expect(read.id).toBe(created.id);
    });

    it('refuse une référence vide, en désignant le champ fautif', async () => {
      const failure = await createForOwner('   ').catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(ApartmentValidationError);
      expect((failure as ApartmentValidationError).fieldErrors.number).toBeDefined();
    });

    it('refuse une référence déjà utilisée dans le même immeuble', async () => {
      await createForOwner('T02');

      const failure = await createForOwner('T02').catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(ApartmentNumberAlreadyUsedError);
    });

    /**
     * L'organisation n'est pas saisie : elle est DÉRIVÉE de l'immeuble. Sans
     * cela, une valeur incohérente franchirait la frontière d'isolation.
     */
    it('reprend l organisation de l immeuble, sans la demander', async () => {
      const created = await createForOwner('T03');

      expect(created.organizationId).toBe(SEED_IDS.organizationA);
    });

    /** DEC-014 : la devise vient de l'organisation quand elle n'est pas saisie. */
    it('complète la devise depuis l organisation', async () => {
      const created = await createForOwner('T04', {
        referenceRent: { amount: '2000000', currency: null },
      });

      expect(created.referenceRent).toEqual({ amount: 2000000, currency: 'GNF' });
    });
  });

  describe('Permissions et isolation', () => {
    /**
     * `apartment.create` est portée par le gestionnaire SUR SON PÉRIMÈTRE, à la
     * différence de la création d'un immeuble, réservée au propriétaire
     * (DEC-025). La matrice l'accorde aux deux sans réserve.
     */
    it('laisse le gestionnaire créer un logement dans son périmètre', async () => {
      const created = await createApartment(harness.db, manager, SEED_IDS.propertyA, {
        number: 'M01',
      });

      expect(created.propertyId).toBe(SEED_IDS.propertyA);
    });

    it('laisse le gestionnaire modifier un logement de son périmètre', async () => {
      const created = await createApartment(harness.db, manager, SEED_IDS.propertyA, {
        number: 'M02',
      });

      const updated = await updateApartment(harness.db, manager, created.id, {
        underMaintenance: true,
      });

      expect(updated.underMaintenance).toBe(true);
    });

    /**
     * Un immeuble d'une autre organisation doit se comporter comme un immeuble
     * INEXISTANT : répondre « interdit » confirmerait son existence (ADR-007).
     */
    it('rend l immeuble d une autre organisation indiscernable d un inexistant', async () => {
      const failure = await createApartment(harness.db, otherOwner, SEED_IDS.propertyA, {
        number: 'X01',
      }).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(ResourceOutOfScopeError);
      expect(failure).not.toBeInstanceOf(PermissionDeniedError);
    });

    it('refuse la lecture d un appartement d une autre organisation', async () => {
      const failure = await getApartment(harness.db, otherOwner, SEED_IDS.apartmentA01).catch(
        (error: unknown) => error,
      );

      expect(failure).toBeInstanceOf(ResourceOutOfScopeError);
    });

    it('refuse la liste des appartements d un immeuble hors périmètre', async () => {
      const failure = await listApartments(harness.db, otherOwner, SEED_IDS.propertyA, {}).catch(
        (error: unknown) => error,
      );

      expect(failure).toBeInstanceOf(ResourceOutOfScopeError);
    });

    /**
     * Un identifiant qui n'est pas un UUID doit donner le même refus qu'un
     * identifiant inconnu. Sans ce contrôle, PostgreSQL refuserait la
     * conversion et produirait une erreur interne là où la réponse correcte est
     * « inexistant ».
     */
    it('traite un identifiant malformé comme un appartement inexistant', async () => {
      const failure = await getApartment(harness.db, owner, 'pas-un-uuid').catch(
        (error: unknown) => error,
      );

      expect(failure).toBeInstanceOf(ResourceOutOfScopeError);
    });
  });

  describe('Création groupée', () => {
    it('crée une série entière en un envoi', async () => {
      const created = await generateApartments(harness.db, owner, SEED_IDS.propertyA, {
        prefix: 'S',
        start: 1,
        count: 4,
      });

      expect(created.map((apartment) => apartment.number)).toEqual(['S01', 'S02', 'S03', 'S04']);
      expect(created.every((apartment) => apartment.occupancy === 'VACANT')).toBe(true);
    });

    /**
     * L'envoi est ATOMIQUE : créer les logements recevables et taire les autres
     * laisserait l'utilisateur devant une structure partielle sans savoir
     * laquelle, au moment précis où il construit son immeuble.
     */
    it('refuse l envoi entier quand une seule référence existe déjà', async () => {
      await createForOwner('B01');

      const failure = await createApartmentsBulk(harness.db, owner, SEED_IDS.propertyA, {
        apartments: [{ number: 'B01' }, { number: 'B02' }, { number: 'B03' }],
      }).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(ApartmentBulkConflictError);
      expect((failure as ApartmentBulkConflictError).numbers).toEqual(['B01']);

      const [orphan] = await harness.db
        .select()
        .from(apartmentsTable)
        .where(eq(apartmentsTable.number, 'B02'));

      expect(orphan).toBeUndefined();
    });

    it('refuse deux références identiques dans le même envoi', async () => {
      const failure = await createApartmentsBulk(harness.db, owner, SEED_IDS.propertyA, {
        apartments: [{ number: 'D01' }, { number: 'D01' }],
      }).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(ApartmentValidationError);
    });
  });

  describe('Modification', () => {
    it('modifie un logement et renvoie sa vue à jour', async () => {
      const created = await createForOwner('U01', { type: 'T2' });

      const updated = await updateApartment(harness.db, owner, created.id, {
        type: 'T3',
        underMaintenance: true,
      });

      expect(updated.type).toBe('T3');
      expect(updated.underMaintenance).toBe(true);
    });

    /**
     * DEC-050 : l'occupation ne se saisit plus.
     *
     * Un client qui l'enverrait quand même ne doit RIEN obtenir, et surtout pas
     * une erreur qui laisserait croire que le champ existe encore : le logement
     * reste vacant, faute de bail, et la requête est refusée parce qu'elle ne
     * contient aucune modification recevable.
     */
    it('refuse une requête qui ne porte que l occupation, devenue sans objet', async () => {
      const created = await createForOwner('U09');

      const failure = await updateApartment(harness.db, owner, created.id, {
        status: 'OCCUPIED',
      }).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(ApartmentValidationError);

      const read = await getApartment(harness.db, owner, created.id);

      expect(read.occupancy).toBe('VACANT');
    });

    /**
     * Une soumission sans différence ne doit produire AUCUNE écriture : sinon,
     * ouvrir un formulaire et le valider sans rien changer ferait apparaître une
     * modification fantôme dans le futur journal d'activité.
     */
    it('n écrit rien quand la modification ne change rien', async () => {
      const created = await createForOwner('U02', { type: 'T2' });

      const updated = await updateApartment(harness.db, owner, created.id, { type: 'T2' });

      expect(updated.updatedAt).toBe(created.updatedAt);
    });

    it('efface un champ explicitement vidé', async () => {
      const created = await createForOwner('U03', { type: 'T2', area: '50' });

      const updated = await updateApartment(harness.db, owner, created.id, { type: '' });

      expect(updated.type).toBeNull();
      expect(updated.area).toBe(50);
    });

    /** DEC-014 : la base refuse un montant sans devise, et inversement. */
    it('efface le loyer et sa devise ensemble', async () => {
      const created = await createForOwner('U04', {
        referenceRent: { amount: '1500000', currency: 'GNF' },
      });

      const updated = await updateApartment(harness.db, owner, created.id, {
        referenceRent: null,
      });

      expect(updated.referenceRent).toBeNull();
    });

    it('complète la devise quand un loyer est ajouté après coup', async () => {
      const created = await createForOwner('U05');

      const updated = await updateApartment(harness.db, owner, created.id, {
        referenceRent: { amount: '900000', currency: null },
      });

      expect(updated.referenceRent).toEqual({ amount: 900000, currency: 'GNF' });
    });

    it('refuse une référence déjà portée par un autre logement de l immeuble', async () => {
      await createForOwner('U06');
      const other = await createForOwner('U07');

      const failure = await updateApartment(harness.db, owner, other.id, {
        number: 'U06',
      }).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(ApartmentNumberAlreadyUsedError);
    });
  });

  describe('Liste', () => {
    it('ne renvoie que les logements de l immeuble demandé', async () => {
      const collection = await listApartments(harness.db, owner, SEED_IDS.propertyA, {
        pageSize: 100,
      });

      expect(collection.apartments.length).toBeGreaterThan(0);
      expect(
        collection.apartments.every((apartment) => apartment.propertyId === SEED_IDS.propertyA),
      ).toBe(true);
    });

    it('filtre sur les travaux déclarés', async () => {
      await updateApartment(harness.db, owner, (await createForOwner('F01')).id, {
        underMaintenance: true,
      });

      const collection = await listApartments(harness.db, owner, SEED_IDS.propertyA, {
        status: 'MAINTENANCE',
        pageSize: 100,
      });

      expect(collection.apartments.length).toBeGreaterThan(0);
      expect(collection.apartments.every((apartment) => apartment.underMaintenance)).toBe(true);
    });

    /**
     * Le filtre « vacant » s'applique en SQL, AVANT la pagination : l'appliquer
     * après donnerait des pages incomplètes et un total faux. Sans bail dans cet
     * immeuble, tout y est vacant, et le total doit donc suivre le nombre réel de
     * logements plutôt que la taille d'une page.
     */
    it('filtre sur l occupation sans fausser le total', async () => {
      const all = await listApartments(harness.db, owner, SEED_IDS.propertyA, { pageSize: 100 });
      const vacant = await listApartments(harness.db, owner, SEED_IDS.propertyA, {
        status: 'VACANT',
        pageSize: 100,
      });

      expect(vacant.meta.total).toBe(all.meta.total);
      expect(vacant.apartments.every((apartment) => apartment.occupancy === 'VACANT')).toBe(true);

      const occupied = await listApartments(harness.db, owner, SEED_IDS.propertyA, {
        status: 'OCCUPIED',
        pageSize: 100,
      });

      expect(occupied.meta.total).toBe(0);
      expect(occupied.apartments).toEqual([]);
    });

    it('cherche sur la référence', async () => {
      const collection = await listApartments(harness.db, owner, SEED_IDS.propertyA, {
        search: 'A01',
      });

      expect(collection.apartments.map((apartment) => apartment.number)).toContain('A01');
    });

    /**
     * Sans échappement, une recherche sur « % » ramènerait tout le parc. Ce
     * n'est pas une faille, mais un résultat incompréhensible.
     */
    it('traite les jokers SQL comme du texte ordinaire', async () => {
      const collection = await listApartments(harness.db, owner, SEED_IDS.propertyA, {
        search: '%',
      });

      expect(collection.apartments).toHaveLength(0);
    });

    it('exclut les logements archivés par défaut, et les montre sur demande', async () => {
      const created = await createForOwner('Z01');

      await harness.db
        .update(apartmentsTable)
        .set({ archivedAt: new Date() })
        .where(eq(apartmentsTable.id, created.id));

      const withoutArchived = await listApartments(harness.db, owner, SEED_IDS.propertyA, {
        search: 'Z01',
      });
      const withArchived = await listApartments(harness.db, owner, SEED_IDS.propertyA, {
        search: 'Z01',
        includeArchived: true,
      });

      expect(withoutArchived.apartments).toHaveLength(0);
      expect(withArchived.apartments).toHaveLength(1);
      expect(withArchived.apartments[0]?.archived).toBe(true);
    });

    it('rend compte de la pagination', async () => {
      const collection = await listApartments(harness.db, owner, SEED_IDS.propertyA, {
        pageSize: 2,
      });

      expect(collection.apartments).toHaveLength(2);
      expect(collection.meta.pageSize).toBe(2);
      expect(collection.meta.pageCount).toBeGreaterThan(1);
    });
  });

  describe('Immeuble archivé', () => {
    /**
     * L'archivage d'un immeuble ne touche pas ses appartements, qui restent
     * individuellement actifs (DEC-020). Le refus porte donc sur l'opération et
     * non sur l'état du logement, ce que la fiche de l'immeuble annonce.
     */
    it('refuse d ajouter un logement à un immeuble archivé', async () => {
      await harness.db
        .update(propertiesTable)
        .set({ archivedAt: new Date() })
        .where(eq(propertiesTable.id, SEED_IDS.propertyB));

      const failure = await createApartment(harness.db, otherOwner, SEED_IDS.propertyB, {
        number: 'P01',
      }).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(ArchivedApartmentError);
      expect((failure as ArchivedApartmentError).reason).toBe('property-archived');
    });

    it('laisse consulter les logements d un immeuble archivé', async () => {
      const collection = await listApartments(harness.db, otherOwner, SEED_IDS.propertyB, {});

      expect(collection.meta.total).toBeGreaterThanOrEqual(0);
    });
  });

  /**
   * Ce bloc existe à cause d'un défaut réel, trouvé par le lint au Lot 5.
   *
   * L'échappement des jokers `LIKE` avait perdu ses antislashs à l'écriture du
   * fichier : le remplacement produisait une chaîne littérale au lieu du
   * caractère échappé. Le test « une recherche sur % ne ramène rien » passait
   * malgré tout, par accident, puisqu'un motif cassé ne trouve rien non plus.
   *
   * Il faut donc vérifier les DEUX côtés : que le joker ne s'étend pas, et que
   * le caractère reste cherchable littéralement.
   */
  describe('Échappement des jokers de recherche', () => {
    it('trouve une référence contenant un souligné, sans le traiter en joker', async () => {
      await createForOwner('J_1');
      await createForOwner('JA1');

      const collection = await listApartments(harness.db, owner, SEED_IDS.propertyA, {
        search: 'J_1',
        pageSize: 100,
      });

      expect(collection.apartments.map((apartment) => apartment.number)).toEqual(['J_1']);
    });
  });

  /**
   * Ce bloc existe à cause d'un défaut vu à l'écran au Lot 5.
   *
   * La liste triait d'abord par étage. L'étage étant facultatif, une série
   * « B01 à B12 » créée sans étage se plaçait au niveau du rez-de-chaussée et
   * s'intercalait entre « A01 » et « A02 ». Le tri porte désormais sur la seule
   * référence, qui est ce que la numérotation du parcours 3 encode.
   */
  describe('Ordre de la liste', () => {
    it('range les références ensemble, quel que soit l étage', async () => {
      const property = await harness.db
        .insert(propertiesTable)
        .values({ organizationId: SEED_IDS.organizationA, name: 'Ordre de tri' })
        .returning();

      const propertyId = property[0]!.id;

      await createApartment(harness.db, owner, propertyId, { number: 'A01', floor: '0' });
      await createApartment(harness.db, owner, propertyId, { number: 'A02', floor: '5' });
      await createApartment(harness.db, owner, propertyId, { number: 'B01' });

      const collection = await listApartments(harness.db, owner, propertyId, { pageSize: 100 });

      expect(collection.apartments.map((apartment) => apartment.number)).toEqual([
        'A01',
        'A02',
        'B01',
      ]);
    });

    it('relègue les logements archivés après les actifs', async () => {
      const property = await harness.db
        .insert(propertiesTable)
        .values({ organizationId: SEED_IDS.organizationA, name: 'Ordre avec archive' })
        .returning();

      const propertyId = property[0]!.id;

      const first = await createApartment(harness.db, owner, propertyId, { number: 'A01' });
      await createApartment(harness.db, owner, propertyId, { number: 'A02' });

      await harness.db
        .update(apartmentsTable)
        .set({ archivedAt: new Date() })
        .where(eq(apartmentsTable.id, first.id));

      const collection = await listApartments(harness.db, owner, propertyId, {
        includeArchived: true,
        pageSize: 100,
      });

      expect(collection.apartments.map((apartment) => apartment.number)).toEqual(['A02', 'A01']);
    });
  });

  /**
   * DEC-039, confirmée par le fondateur le 28 septembre 2026 : l'archivage d'un
   * appartement est réservé au PROPRIÉTAIRE, retirer un logement de
   * l'exploitation étant un acte patrimonial.
   */
  describe('Archivage', () => {
    it('archive un logement sans toucher à sa déclaration de travaux', async () => {
      const created = await createForOwner('K01', { underMaintenance: 'on' });

      const archived = await archiveApartment(harness.db, owner, created.id);

      expect(archived.archived).toBe(true);
      expect(archived.archivedAt).not.toBeNull();
      // Les travaux restent la derniere information vraie sur le logement (DEC-019).
      expect(archived.underMaintenance).toBe(true);
      // Et l'occupation reste deduite : sans bail, le logement archive est vacant.
      expect(archived.occupancy).toBe('VACANT');
    });

    it('refuse un second archivage plutôt que d annoncer un succès sans effet', async () => {
      const created = await createForOwner('K02');

      await archiveApartment(harness.db, owner, created.id);

      const failure = await archiveApartment(harness.db, owner, created.id).catch(
        (error: unknown) => error,
      );

      expect(failure).toBeInstanceOf(AlreadyArchivedApartmentError);
    });

    /** Le refus porte sur la permission, la ressource étant bien dans son périmètre. */
    it('refuse l archivage au gestionnaire, même sur son périmètre', async () => {
      const created = await createForOwner('K03');

      const failure = await archiveApartment(harness.db, manager, created.id).catch(
        (error: unknown) => error,
      );

      expect(failure).toBeInstanceOf(PermissionDeniedError);
    });

    it('laisse le gestionnaire modifier ce qu il ne peut pas archiver', async () => {
      const created = await createForOwner('K04');

      const updated = await updateApartment(harness.db, manager, created.id, {
        underMaintenance: true,
      });

      expect(updated.underMaintenance).toBe(true);
    });

    it('refuse toute modification d un logement archivé', async () => {
      const created = await createForOwner('K05');

      await archiveApartment(harness.db, owner, created.id);

      const failure = await updateApartment(harness.db, owner, created.id, {
        type: 'T2',
      }).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(ArchivedApartmentError);
    });

    /**
     * La référence reste prise : libérer « A04 » rendrait deux lignes homonymes
     * indistinguables dans un historique de bail.
     */
    it('garde la référence d un logement archivé réservée', async () => {
      const created = await createForOwner('K06');

      await archiveApartment(harness.db, owner, created.id);

      const failure = await createForOwner('K06').catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(ApartmentNumberAlreadyUsedError);
    });

    it('exclut un logement archivé de la liste, et le montre sur demande', async () => {
      const created = await createForOwner('K07');

      await archiveApartment(harness.db, owner, created.id);

      const actifs = await listApartments(harness.db, owner, SEED_IDS.propertyA, {
        search: 'K07',
      });
      const avecArchives = await listApartments(harness.db, owner, SEED_IDS.propertyA, {
        search: 'K07',
        includeArchived: true,
      });

      expect(actifs.apartments).toHaveLength(0);
      expect(avecArchives.apartments).toHaveLength(1);
    });

    it('rend un logement d une autre organisation indiscernable d un inexistant', async () => {
      const created = await createForOwner('K08');

      const failure = await archiveApartment(harness.db, otherOwner, created.id).catch(
        (error: unknown) => error,
      );

      expect(failure).toBeInstanceOf(ResourceOutOfScopeError);
    });
  });
});
