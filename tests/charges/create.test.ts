import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { ResourceOutOfScopeError } from '../../src/lib/authorization/service';
import { ChargeStateError, ChargeValidationError } from '../../src/modules/charges/errors';
import { createCharge, getCharge } from '../../src/modules/charges/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  OPTIONS,
  addApartment,
  addCharge,
  addProperty,
  addScope,
  contextOf,
  readCharge,
} from '../helpers/charges';

/**
 * MVP-BACKLOG-051 : le modèle de la charge, et sa création en BROUILLON.
 *
 * L'exigence qui domine est celle de la section 27 de l'API : « la charge est
 * créée en statut `DRAFT`. Elle ne crée aucune créance et n'est visible d'aucun
 * locataire tant qu'elle n'est pas publiée ». C'est ce que ces tests
 * vérifient en premier, parce que c'est ce qui sépare une facture enregistrée
 * d'une dette réclamée.
 */
describe('Création d une charge', () => {
  let harness: TestDatabase;
  let owner: Awaited<ReturnType<typeof contextOf>>;
  let manager: Awaited<ReturnType<typeof contextOf>>;
  let otherOwner: Awaited<ReturnType<typeof contextOf>>;

  let inScopeProperty: string;
  let outOfScopeProperty: string;

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    inScopeProperty = await addProperty(harness, 'Résidence Kipé');
    outOfScopeProperty = await addProperty(harness, 'Résidence Dixinn Nord');

    await addApartment(harness, inScopeProperty, 'A01');
    await addApartment(harness, outOfScopeProperty, 'B01');
    await addScope(harness, SEED_IDS.accessManagerA, inScopeProperty);

    owner = await contextOf(harness, SEED_IDS.ownerA);
    manager = await contextOf(harness, SEED_IDS.managerA);
    otherOwner = await contextOf(harness, SEED_IDS.ownerB);
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('Ce que la création écrit', () => {
    it('enregistre la facture en brouillon, sans aucune créance', async () => {
      const charge = await addCharge(harness, { propertyId: inScopeProperty, context: owner });

      expect(charge.status).toBe('DRAFT');
      expect(charge.publishedAt).toBeNull();
      expect(charge.cancelledAt).toBeNull();
      expect(charge.allocations).toHaveLength(0);
      expect(charge.unitCount).toBe(0);
      expect(charge.totalOutstanding).toBe(0);
    });

    it('conserve le montant global, la période, l échéance et le fournisseur', async () => {
      const charge = await addCharge(harness, {
        propertyId: inScopeProperty,
        context: owner,
        type: 'ELECTRICITY',
        periodStart: '2026-09',
        dueDate: '2026-09-10',
        totalAmount: 1_800_000,
        supplierName: 'EDG',
      });

      expect(charge.type).toBe('ELECTRICITY');
      expect(charge.periodStart).toBe('2026-09-01');
      expect(charge.dueDate).toBe('2026-09-10');
      expect(charge.totalAmount).toBe(1_800_000);
      expect(charge.supplierName).toBe('EDG');
      expect(charge.property.id).toBe(inScopeProperty);
    });

    /** Seule méthode du MVP, et elle est TOUJOURS explicite (BR-050, DEC-029). */
    it('porte la méthode de répartition, égale par défaut', async () => {
      const charge = await addCharge(harness, { propertyId: inScopeProperty, context: owner });

      expect(charge.allocationMethod).toBe('EQUAL');
    });

    /**
     * L'organisation vient de l'IMMEUBLE et jamais de l'appelant : la recevoir
     * permettrait d'enregistrer une charge chez un autre bailleur.
     */
    it('rattache la charge à l organisation de l immeuble', async () => {
      const charge = await addCharge(harness, { propertyId: inScopeProperty, context: owner });

      expect(charge.organizationId).toBe(SEED_IDS.organizationA);
    });

    /** La trace exigée par la section 28 : qui a enregistré cette facture. */
    it('consigne la personne qui a enregistré la charge', async () => {
      const charge = await addCharge(harness, { propertyId: inScopeProperty, context: manager });
      const row = await readCharge(harness, charge.id);

      expect(row.createdBy).toBe(SEED_IDS.managerA);
    });

    /** Devise de l'organisation à défaut (DEC-014), comme le loyer de référence. */
    it('prend la devise de l organisation quand elle n est pas précisée', async () => {
      const charge = await createCharge(
        harness.db,
        owner,
        {
          propertyId: inScopeProperty,
          type: 'WATER',
          periodStart: '2026-10',
          dueDate: '2026-10-10',
          totalAmount: 500_000,
        },
        OPTIONS,
      );

      expect(charge.currency).toBe('GNF');
    });

    it('accepte une période donnée en premier jour du mois, comme l API la documente', async () => {
      const charge = await createCharge(
        harness.db,
        owner,
        {
          propertyId: inScopeProperty,
          type: 'WATER',
          periodStart: '2026-09-01',
          dueDate: '2026-09-10',
          totalAmount: 500_000,
          currency: 'GNF',
        },
        OPTIONS,
      );

      expect(charge.periodStart).toBe('2026-09-01');
    });
  });

  describe('Ce que la création refuse', () => {
    const invalid = async (input: Record<string, unknown>) =>
      createCharge(
        harness.db,
        owner,
        {
          propertyId: inScopeProperty,
          type: 'WATER',
          periodStart: '2026-10',
          dueDate: '2026-10-10',
          totalAmount: 500_000,
          ...input,
        },
        OPTIONS,
      ).catch((error: unknown) => error);

    it('refuse un montant nul ou négatif', async () => {
      expect(await invalid({ totalAmount: 0 })).toBeInstanceOf(ChargeValidationError);
      expect(await invalid({ totalAmount: -1 })).toBeInstanceOf(ChargeValidationError);
    });

    it('refuse un montant absent, vide ou décimal', async () => {
      expect(await invalid({ totalAmount: '' })).toBeInstanceOf(ChargeValidationError);
      expect(await invalid({ totalAmount: undefined })).toBeInstanceOf(ChargeValidationError);
      expect(await invalid({ totalAmount: 1000.5 })).toBeInstanceOf(ChargeValidationError);
    });

    /**
     * Une période ne commence pas le 15 : la date est REFUSÉE plutôt que
     * rabattue, parce que l'accepter laisserait croire qu'une charge peut couvrir
     * un mois décalé.
     */
    it('refuse une période qui ne commence pas un premier du mois', async () => {
      expect(await invalid({ periodStart: '2026-10-15' })).toBeInstanceOf(ChargeValidationError);
    });

    it('refuse un mois qui n existe pas', async () => {
      expect(await invalid({ periodStart: '2026-13' })).toBeInstanceOf(ChargeValidationError);
    });

    it('refuse une échéance antérieure à la période couverte', async () => {
      const error = await invalid({ periodStart: '2026-10', dueDate: '2026-09-30' });

      expect(error).toBeInstanceOf(ChargeValidationError);
      expect((error as ChargeValidationError).fieldErrors.dueDate).toBeDefined();
    });

    it('refuse une nature de charge inconnue', async () => {
      expect(await invalid({ type: 'INTERNET' })).toBeInstanceOf(ChargeValidationError);
    });

    /** `CUSTOM` et `CONSUMPTION` sont hors MVP : les accepter donnerait des parts fausses. */
    it('refuse une méthode de répartition hors périmètre', async () => {
      expect(await invalid({ allocationMethod: 'CUSTOM' })).toBeInstanceOf(ChargeValidationError);
      expect(await invalid({ allocationMethod: 'CONSUMPTION' })).toBeInstanceOf(
        ChargeValidationError,
      );
    });

    /** Un immeuble archivé est sorti de l'exploitation (DEC-020). */
    it('refuse une charge nouvelle sur un immeuble archivé', async () => {
      const archived = await addProperty(harness, 'Résidence archivée');

      await harness.db
        .update(harness.schema.properties)
        .set({ archivedAt: new Date() })
        .where(eq(harness.schema.properties.id, archived));

      await expect(
        addCharge(harness, { propertyId: archived, context: owner }),
      ).rejects.toBeInstanceOf(ChargeStateError);
    });
  });

  describe('Périmètre de celui qui enregistre', () => {
    it('ouvre la création au gestionnaire de l immeuble', async () => {
      const charge = await addCharge(harness, { propertyId: inScopeProperty, context: manager });

      expect(charge.status).toBe('DRAFT');
    });

    it("refuse la création au gestionnaire d'un autre immeuble", async () => {
      await expect(
        addCharge(harness, { propertyId: outOfScopeProperty, context: manager }),
      ).rejects.toBeInstanceOf(ResourceOutOfScopeError);
    });

    it('refuse la création dans une autre organisation', async () => {
      await expect(
        addCharge(harness, { propertyId: inScopeProperty, context: otherOwner }),
      ).rejects.toBeInstanceOf(ResourceOutOfScopeError);
    });

    it('refuse un immeuble inconnu comme un immeuble hors périmètre', async () => {
      await expect(
        addCharge(harness, {
          propertyId: '00000000-0000-4000-8000-000000000000',
          context: owner,
        }),
      ).rejects.toBeInstanceOf(ResourceOutOfScopeError);
    });

    it('refuse un identifiant mal formé sans erreur interne', async () => {
      await expect(
        addCharge(harness, { propertyId: 'pas-un-identifiant', context: owner }),
      ).rejects.toBeInstanceOf(ChargeValidationError);
    });
  });

  describe('Lecture d une charge', () => {
    it('ouvre la fiche au propriétaire et au gestionnaire du périmètre', async () => {
      const charge = await addCharge(harness, { propertyId: inScopeProperty, context: owner });

      expect((await getCharge(harness.db, owner, charge.id, OPTIONS)).id).toBe(charge.id);
      expect((await getCharge(harness.db, manager, charge.id, OPTIONS)).id).toBe(charge.id);
    });

    it("refuse la fiche hors périmètre, sans distinguer l'inconnu de l'interdit", async () => {
      const charge = await addCharge(harness, { propertyId: outOfScopeProperty, context: owner });

      await expect(getCharge(harness.db, manager, charge.id, OPTIONS)).rejects.toBeInstanceOf(
        ResourceOutOfScopeError,
      );
      await expect(
        getCharge(harness.db, owner, '00000000-0000-4000-8000-000000000000', OPTIONS),
      ).rejects.toBeInstanceOf(ResourceOutOfScopeError);
      await expect(getCharge(harness.db, owner, 'pas-un-uuid', OPTIONS)).rejects.toBeInstanceOf(
        ResourceOutOfScopeError,
      );
    });
  });
});
