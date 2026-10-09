import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { ResourceOutOfScopeError } from '../../src/lib/authorization/service';
import { ChargeNoUnitError, ChargeStateError } from '../../src/modules/charges/errors';
import {
  cancelCharge,
  getCharge,
  previewCharge,
  publishCharge,
} from '../../src/modules/charges/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  CHARGE_TOTAL,
  OPTIONS,
  addApartment,
  addBillableLease,
  addCharge,
  addProperty,
  addScope,
  allocationsOfCharge,
  contextOf,
  freshPhone,
  passwordHasher,
  readCharge,
  setAllocationPaid,
} from '../helpers/charges';

/**
 * MVP-BACKLOG-052 et 053 : la publication d'une charge, et l'aperçu qui la
 * précède.
 *
 * Le cœur du lot, et trois exigences y dominent.
 *
 * **DEC-005** : la publication crée des créances PAYABLES, une par logement
 * concerné, distinctes des échéances de loyer.
 *
 * **BR-052** : la publication est ATOMIQUE, soit toutes les créances sont
 * créées, soit aucune, et une charge déjà publiée ne peut pas l'être deux fois.
 *
 * **BR-051** : la somme des parts vaut le total, sans exception.
 */
describe('Publication d une charge', () => {
  let harness: TestDatabase;
  let owner: Awaited<ReturnType<typeof contextOf>>;
  let manager: Awaited<ReturnType<typeof contextOf>>;

  let hashPassword: (password: string) => Promise<string>;

  let counter = 0;

  /** Immeuble neuf, avec le nombre de logements demandé, tous vacants. */
  const addBuilding = async (units: number, options: { inScope?: boolean } = {}) => {
    counter += 1;

    const propertyId = await addProperty(harness, `Résidence P${counter}`);

    const apartmentIds: string[] = [];

    for (let index = 1; index <= units; index += 1) {
      apartmentIds.push(
        await addApartment(harness, propertyId, `A${String(index).padStart(2, '0')}`),
      );
    }

    if (options.inScope) await addScope(harness, SEED_IDS.accessManagerA, propertyId);

    return { propertyId, apartmentIds };
  };

  /** Loue un logement, par le vrai chemin : invitation, acceptation, bail. */
  const rent = async (apartmentId: string) =>
    addBillableLease(harness, {
      apartmentId,
      tenantApartmentId: apartmentId,
      ownerContext: owner,
      hashPassword,
      phone: freshPhone(),
      startDate: '2026-01-01',
    });

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    owner = await contextOf(harness, SEED_IDS.ownerA);
    hashPassword = passwordHasher(harness);
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('Ce que la publication crée', () => {
    it('crée une créance par logement, toutes impayées et à zéro versé', async () => {
      const { propertyId } = await addBuilding(4);
      const charge = await addCharge(harness, { propertyId, context: owner });

      const result = await publishCharge(harness.db, owner, charge.id, OPTIONS);

      expect(result.created).toBe(4);

      const allocations = await allocationsOfCharge(harness, charge.id);

      expect(allocations).toHaveLength(4);

      for (const allocation of allocations) {
        expect(allocation.status).toBe('UNPAID');
        expect(allocation.amountPaid).toBe(0);
        expect(allocation.amountDue).toBe(900_000);
        expect(allocation.balance).toBe(900_000);
      }
    });

    /** L'invariant de BR-051, relu en base et non seulement dans le moteur. */
    it('répartit exactement le total, reste d arrondi compris', async () => {
      const { propertyId } = await addBuilding(3);
      const charge = await addCharge(harness, {
        propertyId,
        context: owner,
        totalAmount: 1_000_000,
      });

      await publishCharge(harness.db, owner, charge.id, OPTIONS);

      const allocations = await allocationsOfCharge(harness, charge.id);
      const sum = allocations.reduce((total, row) => total + row.amountDue, 0);

      expect(sum).toBe(1_000_000);
      expect(allocations.map((row) => row.amountDue).sort()).toEqual([333_333, 333_333, 333_334]);
    });

    it('recopie la période, l échéance et la devise de la charge', async () => {
      const { propertyId } = await addBuilding(2);
      const charge = await addCharge(harness, {
        propertyId,
        context: owner,
        periodStart: '2026-09',
        dueDate: '2026-09-10',
      });

      await publishCharge(harness.db, owner, charge.id, OPTIONS);

      const [allocation] = await allocationsOfCharge(harness, charge.id);

      expect(allocation?.periodStart).toBe('2026-09-01');
      expect(allocation?.dueDate).toBe('2026-09-10');
      expect(allocation?.currency).toBe('GNF');
    });

    /** Section 31 : la justification est figée, pour être relue sans recalcul. */
    it('fige la justification du calcul sur chaque créance', async () => {
      const { propertyId } = await addBuilding(3);
      const charge = await addCharge(harness, {
        propertyId,
        context: owner,
        totalAmount: 100,
      });

      await publishCharge(harness.db, owner, charge.id, OPTIONS);

      const view = await getCharge(harness.db, owner, charge.id, OPTIONS);

      expect(view.allocations[0]?.explanation).toEqual({
        method: 'EQUAL',
        totalAmount: 100,
        unitCount: 3,
        baseShare: 33,
        roundingAdjustment: 1,
      });
      expect(view.allocations.map((allocation) => allocation.amountDue)).toEqual([34, 33, 33]);
    });

    it('passe la charge en PUBLISHED, avec sa date de publication', async () => {
      const { propertyId } = await addBuilding(2);
      const charge = await addCharge(harness, { propertyId, context: owner });

      const result = await publishCharge(harness.db, owner, charge.id, OPTIONS);

      expect(result.charge.status).toBe('PUBLISHED');
      expect(result.charge.publishedAt).not.toBeNull();
      expect((await readCharge(harness, charge.id)).status).toBe('PUBLISHED');
    });

    it('annonce le reste à encaisser de la charge', async () => {
      const { propertyId } = await addBuilding(2);
      const charge = await addCharge(harness, { propertyId, context: owner });

      const result = await publishCharge(harness.db, owner, charge.id, OPTIONS);

      expect(result.charge.unitCount).toBe(2);
      expect(result.charge.totalOutstanding).toBe(CHARGE_TOTAL);
    });
  });

  describe('Qui doit la part, et qui ne la doit pas', () => {
    /** BR-052 : la personne et son bail sont lus du bail ACTIF, et figés. */
    it('fige le bail actif et la personne redevable de chaque logement loué', async () => {
      const { propertyId, apartmentIds } = await addBuilding(2);
      const lease = await rent(apartmentIds[0] as string);
      const charge = await addCharge(harness, { propertyId, context: owner });

      await publishCharge(harness.db, owner, charge.id, OPTIONS);

      const allocations = await allocationsOfCharge(harness, charge.id);
      const occupied = allocations.find((row) => row.apartmentId === apartmentIds[0]);

      expect(occupied?.leaseId).toBe(lease.leaseId);
      expect(occupied?.tenantUserId).toBe(lease.tenantUserId);
    });

    /**
     * Le cas que BR-052 traite explicitement : un logement vacant porte sa part,
     * SANS locataire redevable. Elle reste visible du bailleur et n'apparaît dans
     * aucun espace locataire.
     */
    it('crée la part d un logement vacant sans personne redevable', async () => {
      const { propertyId, apartmentIds } = await addBuilding(2);

      await rent(apartmentIds[0] as string);

      const charge = await addCharge(harness, { propertyId, context: owner });

      await publishCharge(harness.db, owner, charge.id, OPTIONS);

      const allocations = await allocationsOfCharge(harness, charge.id);
      const vacant = allocations.find((row) => row.apartmentId === apartmentIds[1]);

      expect(vacant).toBeDefined();
      expect(vacant?.leaseId).toBeNull();
      expect(vacant?.tenantUserId).toBeNull();
      expect(vacant?.amountDue).toBe(1_800_000);
    });

    /**
     * Un logement archivé est sorti de l'exploitation (DEC-020) : lui donner une
     * part créerait une créance que personne ne réclamera, et réduirait d'autant
     * celle des logements réellement desservis.
     */
    it('écarte les logements archivés de la répartition', async () => {
      const { propertyId, apartmentIds } = await addBuilding(3);

      await harness.db
        .update(harness.schema.apartments)
        .set({ archivedAt: new Date() })
        .where(eq(harness.schema.apartments.id, apartmentIds[2] as string));

      const charge = await addCharge(harness, { propertyId, context: owner });
      const result = await publishCharge(harness.db, owner, charge.id, OPTIONS);

      expect(result.created).toBe(2);

      const allocations = await allocationsOfCharge(harness, charge.id);

      expect(allocations.map((row) => row.apartmentId)).not.toContain(apartmentIds[2]);
      expect(allocations.every((row) => row.amountDue === 1_800_000)).toBe(true);
    });

    /**
     * La situation locative n'est PAS recalculée après publication (section 30) :
     * la part de la facture de septembre reste due par qui occupait le logement à
     * la répartition, et un nouveau locataire n'hérite pas d'une dette.
     */
    it('ne recalcule jamais le redevable après la publication', async () => {
      const { propertyId, apartmentIds } = await addBuilding(1);
      const charge = await addCharge(harness, { propertyId, context: owner });

      await publishCharge(harness.db, owner, charge.id, OPTIONS);

      const before = await allocationsOfCharge(harness, charge.id);

      expect(before[0]?.tenantUserId).toBeNull();

      // Le logement est loué APRÈS la publication.
      await rent(apartmentIds[0] as string);

      const after = await allocationsOfCharge(harness, charge.id);

      expect(after[0]?.tenantUserId).toBeNull();
    });
  });

  describe('Ce que la publication refuse', () => {
    /** La règle de BR-052 : une charge publiée ne peut pas l'être deux fois. */
    it('refuse une seconde publication, sans créer de créance en double', async () => {
      const { propertyId } = await addBuilding(3);
      const charge = await addCharge(harness, { propertyId, context: owner });

      await publishCharge(harness.db, owner, charge.id, OPTIONS);

      await expect(publishCharge(harness.db, owner, charge.id, OPTIONS)).rejects.toBeInstanceOf(
        ChargeStateError,
      );

      expect(await allocationsOfCharge(harness, charge.id)).toHaveLength(3);
    });

    /**
     * Le double-clic, et c'est le cas que la section 29 cite : deux publications
     * concurrentes de la même charge. Le verrou de ligne les sérialise, la
     * seconde ne trouve plus de brouillon, et le parc ne reçoit qu'un seul jeu de
     * créances.
     */
    it('refuse deux publications CONCURRENTES, et n en laisse passer qu une', async () => {
      const { propertyId } = await addBuilding(4);
      const charge = await addCharge(harness, { propertyId, context: owner });

      const results = await Promise.allSettled([
        publishCharge(harness.db, owner, charge.id, OPTIONS),
        publishCharge(harness.db, owner, charge.id, OPTIONS),
      ]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(await allocationsOfCharge(harness, charge.id)).toHaveLength(4);
    });

    it('refuse de publier une charge annulée', async () => {
      const { propertyId } = await addBuilding(2);
      const charge = await addCharge(harness, { propertyId, context: owner });

      await cancelCharge(harness.db, owner, charge.id, OPTIONS);

      await expect(publishCharge(harness.db, owner, charge.id, OPTIONS)).rejects.toBeInstanceOf(
        ChargeStateError,
      );
      expect(await allocationsOfCharge(harness, charge.id)).toHaveLength(0);
    });

    /**
     * ATOMICITÉ, éprouvée sur un échec réel : un immeuble sans logement fait
     * échouer la répartition APRÈS que le statut a été écrit dans la
     * transaction. La charge doit donc rester en brouillon, et non rester
     * « publiée » sans avoir rien réparti, ce qui casserait l'invariant de
     * BR-051.
     */
    it('laisse la charge en BROUILLON quand la répartition échoue', async () => {
      const { propertyId } = await addBuilding(0);
      const charge = await addCharge(harness, { propertyId, context: owner });

      await expect(publishCharge(harness.db, owner, charge.id, OPTIONS)).rejects.toBeInstanceOf(
        ChargeNoUnitError,
      );

      const row = await readCharge(harness, charge.id);

      expect(row.status).toBe('DRAFT');
      expect(row.publishedAt).toBeNull();
      expect(await allocationsOfCharge(harness, charge.id)).toHaveLength(0);
    });

    it("refuse la publication au gestionnaire d'un autre immeuble", async () => {
      const { propertyId } = await addBuilding(2);
      const charge = await addCharge(harness, { propertyId, context: owner });

      manager = await contextOf(harness, SEED_IDS.managerA);

      await expect(publishCharge(harness.db, manager, charge.id, OPTIONS)).rejects.toBeInstanceOf(
        ResourceOutOfScopeError,
      );
    });

    it('ouvre la publication au gestionnaire de l immeuble', async () => {
      const { propertyId } = await addBuilding(2, { inScope: true });
      const charge = await addCharge(harness, { propertyId, context: owner });

      manager = await contextOf(harness, SEED_IDS.managerA);

      const result = await publishCharge(harness.db, manager, charge.id, OPTIONS);

      expect(result.created).toBe(2);
    });
  });

  describe("L'aperçu, avant de publier", () => {
    it('annonce exactement ce que la publication écrira', async () => {
      const { propertyId } = await addBuilding(3);
      const charge = await addCharge(harness, {
        propertyId,
        context: owner,
        totalAmount: 1_000_000,
      });

      const preview = await previewCharge(harness.db, owner, charge.id);

      expect(preview.summary).toEqual({
        method: 'EQUAL',
        totalAmount: 1_000_000,
        unitCount: 3,
        baseShare: 333_333,
        adjustedUnitCount: 1,
        allocatedAmount: 1_000_000,
      });

      await publishCharge(harness.db, owner, charge.id, OPTIONS);

      const allocations = await allocationsOfCharge(harness, charge.id);
      const announced = preview.shares.map((share) => share.amountDue).sort();

      expect(allocations.map((row) => row.amountDue).sort()).toEqual(announced);
    });

    /** « Cette opération ne publie rien » : rien, pas même un statut. */
    it('n écrit rien, et laisse la charge en brouillon', async () => {
      const { propertyId } = await addBuilding(2);
      const charge = await addCharge(harness, { propertyId, context: owner });

      await previewCharge(harness.db, owner, charge.id);

      expect((await readCharge(harness, charge.id)).status).toBe('DRAFT');
      expect(await allocationsOfCharge(harness, charge.id)).toHaveLength(0);
    });

    it('montre quels logements sont occupés et par qui', async () => {
      const { propertyId, apartmentIds } = await addBuilding(2);

      await rent(apartmentIds[0] as string);

      const charge = await addCharge(harness, { propertyId, context: owner });
      const preview = await previewCharge(harness.db, owner, charge.id);

      expect(preview.shares.map((share) => share.occupied)).toEqual([true, false]);
      expect(preview.shares[0]?.tenantName).toBe('Locataire de test');
      expect(preview.shares[1]?.tenantName).toBeNull();
    });

    it('refuse un aperçu sur un immeuble sans logement', async () => {
      const { propertyId } = await addBuilding(0);
      const charge = await addCharge(harness, { propertyId, context: owner });

      await expect(previewCharge(harness.db, owner, charge.id)).rejects.toBeInstanceOf(
        ChargeNoUnitError,
      );
    });
  });

  describe("L'annulation", () => {
    it('annule la charge et toutes ses créances, sans rien supprimer', async () => {
      const { propertyId } = await addBuilding(3);
      const charge = await addCharge(harness, { propertyId, context: owner });

      await publishCharge(harness.db, owner, charge.id, OPTIONS);

      const cancelled = await cancelCharge(harness.db, owner, charge.id, OPTIONS);

      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancelledAt).not.toBeNull();

      const allocations = await allocationsOfCharge(harness, charge.id);

      expect(allocations).toHaveLength(3);
      expect(allocations.every((row) => row.status === 'CANCELLED')).toBe(true);
    });

    /** Section 32 : l'argent déjà reçu est CONSERVÉ pour analyse. */
    it('conserve le montant déjà payé sur une créance annulée', async () => {
      const { propertyId } = await addBuilding(2);
      const charge = await addCharge(harness, { propertyId, context: owner });

      await publishCharge(harness.db, owner, charge.id, OPTIONS);

      const [allocation] = await allocationsOfCharge(harness, charge.id);

      await setAllocationPaid(harness, allocation?.id as string, 500_000, 'PARTIALLY_PAID');
      await cancelCharge(harness.db, owner, charge.id, OPTIONS);

      const after = await allocationsOfCharge(harness, charge.id);
      const paid = after.find((row) => row.id === allocation?.id);

      expect(paid?.status).toBe('CANCELLED');
      expect(paid?.amountPaid).toBe(500_000);
    });

    /** Une créance annulée n'a jamais rien dû : elle sort du reste à encaisser. */
    it('retire les créances annulées du reste à encaisser', async () => {
      const { propertyId } = await addBuilding(2);
      const charge = await addCharge(harness, { propertyId, context: owner });

      await publishCharge(harness.db, owner, charge.id, OPTIONS);

      const cancelled = await cancelCharge(harness.db, owner, charge.id, OPTIONS);

      expect(cancelled.totalOutstanding).toBe(0);
    });

    it('annule un brouillon, ce qui est la façon de corriger une erreur', async () => {
      const { propertyId } = await addBuilding(2);
      const charge = await addCharge(harness, { propertyId, context: owner });

      const cancelled = await cancelCharge(harness.db, owner, charge.id, OPTIONS);

      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.allocations).toHaveLength(0);
    });

    it('refuse une seconde annulation', async () => {
      const { propertyId } = await addBuilding(2);
      const charge = await addCharge(harness, { propertyId, context: owner });

      await cancelCharge(harness.db, owner, charge.id, OPTIONS);

      await expect(cancelCharge(harness.db, owner, charge.id, OPTIONS)).rejects.toBeInstanceOf(
        ChargeStateError,
      );
    });

    it("refuse l'annulation hors périmètre", async () => {
      const { propertyId } = await addBuilding(2);
      const charge = await addCharge(harness, { propertyId, context: owner });

      manager = await contextOf(harness, SEED_IDS.managerA);

      await expect(cancelCharge(harness.db, manager, charge.id, OPTIONS)).rejects.toBeInstanceOf(
        ResourceOutOfScopeError,
      );
    });
  });
});
