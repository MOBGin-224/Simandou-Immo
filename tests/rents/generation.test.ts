import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import { ResourceOutOfScopeError } from '../../src/lib/authorization/service';
import { terminateLease } from '../../src/modules/leases/service';
import { RentValidationError } from '../../src/modules/rents/errors';
import { generateRents, runRentGenerationJob } from '../../src/modules/rents/service';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import { OPTIONS as LEASE_OPTIONS } from '../helpers/leases';
import {
  OPTIONS,
  PERIOD,
  RENT_AMOUNT,
  addApartment,
  addBillableLease,
  addProperty,
  addScope,
  contextOf,
  freshPhone,
  installmentOf,
  installmentsOfLease,
  passwordHasher,
} from '../helpers/rents';

/**
 * MVP-BACKLOG-037 : génération des échéances, et DEC-053 appliquée en base.
 *
 * Le cœur du lot. Deux exigences dominent : la génération est IDEMPOTENTE
 * (DEC-028), et elle ne remonte JAMAIS dans le temps d'elle-même (DEC-053
 * règle 1). La première protège d'une dette en double, la seconde d'une dette
 * inventée au premier lancement.
 */
describe('Génération des échéances de loyer', () => {
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

    return addApartment(harness, propertyId, `R${String(counter).padStart(3, '0')}`);
  };

  /** Bail actif du périmètre, avec son logement dédié. */
  const addLease = async (
    options: {
      propertyId?: string;
      startDate?: string;
      endDate?: string | null;
      dueDay?: number;
      rentAmount?: number;
    } = {},
  ) =>
    addBillableLease(harness, {
      apartmentId: await freshApartment(options.propertyId),
      tenantApartmentId: await freshApartment(),
      ownerContext: owner,
      hashPassword,
      phone: freshPhone(),
      startDate: options.startDate,
      endDate: options.endDate,
      dueDay: options.dueDay,
      rentAmount: options.rentAmount,
    });

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

  describe('Ce que la génération écrit', () => {
    it('crée une échéance de la période en cours pour un bail actif', async () => {
      const lease = await addLease({ dueDay: 5 });

      const result = await generateRents(harness.db, owner, {}, OPTIONS);

      expect(result.period).toBe(PERIOD);
      expect(result.created).toBeGreaterThanOrEqual(1);

      const installment = await installmentOf(harness, lease.leaseId, PERIOD);

      expect(installment).toBeDefined();
      expect(installment?.periodStart).toBe(PERIOD);
      expect(installment?.dueDate).toBe('2026-10-05');
      expect(installment?.status).toBe('UNPAID');
    });

    /**
     * Section 21 : une échéance naît à zéro payé, et son solde vaut le montant dû.
     * Les paiements n'arrivent qu'au Lot 11.
     */
    it('naît impayée, à zéro versé, le solde égal au montant dû', async () => {
      const lease = await addLease({ rentAmount: 1_750_000 });

      await generateRents(harness.db, owner, {}, OPTIONS);

      const installment = await installmentOf(harness, lease.leaseId, PERIOD);

      expect(installment?.amountDue).toBe(1_750_000);
      expect(installment?.amountPaid).toBe(0);
      expect(installment?.balance).toBe(1_750_000);
      expect(installment?.currency).toBe('GNF');
    });

    /**
     * Les quatre colonnes dénormalisées doivent rester cohérentes avec le bail :
     * c'est ce qui permet de vérifier le périmètre sans jointure (ADR-007), et une
     * incohérence y serait une fuite entre organisations.
     */
    it('recopie organisation, immeuble, logement et personne depuis le bail', async () => {
      const lease = await addLease();

      await generateRents(harness.db, owner, {}, OPTIONS);

      const installment = await installmentOf(harness, lease.leaseId, PERIOD);

      expect(installment?.organizationId).toBe(SEED_IDS.organizationA);
      expect(installment?.propertyId).toBe(inScopeProperty);
      expect(installment?.apartmentId).toBe(lease.apartmentId);
      expect(installment?.tenantUserId).toBe(lease.tenantUserId);
    });

    /** Règle 2 de DEC-053 : aucun prorata, même pour un bail commencé en cours de mois. */
    it('facture le mois ENTIER à un bail qui commence le 20', async () => {
      const lease = await addLease({ startDate: '2026-10-20', rentAmount: RENT_AMOUNT });

      await generateRents(harness.db, owner, {}, OPTIONS);

      const installment = await installmentOf(harness, lease.leaseId, PERIOD);

      expect(installment).toBeDefined();
      expect(installment?.amountDue).toBe(RENT_AMOUNT);
    });

    it('ne facture pas un bail qui ne commence qu au mois suivant', async () => {
      const lease = await addLease({ startDate: '2026-11-01' });

      await generateRents(harness.db, owner, {}, OPTIONS);

      expect(await installmentOf(harness, lease.leaseId, PERIOD)).toBeUndefined();
    });

    /** Règle 3 : la date d'échéance est rabattue, et la base refuse qu'elle sorte du mois. */
    it('rabat le jour d échéance sur le dernier jour d un mois court', async () => {
      const lease = await addLease({ startDate: '2026-01-01', dueDay: 31 });

      await generateRents(harness.db, owner, { period: '2026-02' }, OPTIONS);

      const installment = await installmentOf(harness, lease.leaseId, '2026-02-01');

      expect(installment?.dueDate).toBe('2026-02-28');
    });
  });

  /**
   * L'idempotence est portée par `UNIQUE (lease_id, period_start)` avec
   * `ON CONFLICT DO NOTHING`, et non par une lecture préalable. C'est la seule
   * garantie qui tient si deux appels se croisent.
   */
  describe('Idempotence (DEC-028)', () => {
    it('ne recrée rien au second appel, et le dit', async () => {
      const lease = await addLease();

      const first = await generateRents(harness.db, owner, {}, OPTIONS);
      const second = await generateRents(harness.db, owner, {}, OPTIONS);

      expect(first.created).toBeGreaterThanOrEqual(1);
      expect(second.created).toBe(0);
      expect(second.skipped).toBe(second.expected);
      expect(second.expected).toBe(first.expected);

      expect(await installmentsOfLease(harness, lease.leaseId)).toHaveLength(1);
    });

    it('ne lève aucune erreur sur un appel rejoué', async () => {
      await addLease();

      await expect(generateRents(harness.db, owner, {}, OPTIONS)).resolves.toBeDefined();
      await expect(generateRents(harness.db, owner, {}, OPTIONS)).resolves.toBeDefined();
    });

    it('résiste à deux générations SIMULTANÉES, sans doubler la dette', async () => {
      const lease = await addLease();

      const [a, b] = await Promise.all([
        generateRents(harness.db, owner, {}, OPTIONS),
        generateRents(harness.db, owner, {}, OPTIONS),
      ]);

      // L'une des deux a pu tout créer, l'autre tout ignorer, ou la course se
      // partager : ce qui compte est qu'une seule ligne existe à la fin.
      expect(a.created + b.created).toBeLessThanOrEqual(a.expected + b.expected);
      expect(await installmentsOfLease(harness, lease.leaseId)).toHaveLength(1);
    });
  });

  /**
   * Règle 1 de DEC-053 : le job ne crée que le mois en cours. Au premier
   * lancement sur un bail ancien, il ne doit pas faire apparaître des mois
   * d'impayés déjà encaissés hors de l'application.
   */
  describe('Horizon : aucun rattrapage automatique', () => {
    it('ne crée QUE la période en cours pour un bail actif depuis deux ans', async () => {
      const lease = await addLease({ startDate: '2024-03-01' });

      await generateRents(harness.db, owner, {}, OPTIONS);

      const installments = await installmentsOfLease(harness, lease.leaseId);

      expect(installments).toHaveLength(1);
      expect(installments[0]?.periodStart).toBe(PERIOD);
    });

    it('ne rattrape rien non plus par le job planifié', async () => {
      const lease = await addLease({ startDate: '2024-03-01' });

      await runRentGenerationJob(harness.db, OPTIONS);

      expect(await installmentsOfLease(harness, lease.leaseId)).toHaveLength(1);
    });

    /**
     * Une période passée s'obtient en la DEMANDANT, et c'est la seule porte :
     * réclamer un mois écoulé reste une décision humaine, prise mois par mois.
     */
    it('accepte une période passée demandée explicitement', async () => {
      const lease = await addLease({ startDate: '2026-01-01' });

      await generateRents(harness.db, owner, { period: '2026-08' }, OPTIONS);

      const installment = await installmentOf(harness, lease.leaseId, '2026-08-01');

      expect(installment).toBeDefined();
      expect(installment?.dueDate).toBe('2026-08-05');
    });

    it('refuse une période mal écrite', async () => {
      for (const bad of ['2026-13', 'octobre', '2026-10-01', '26-10']) {
        await expect(generateRents(harness.db, owner, { period: bad }, OPTIONS)).rejects.toThrow(
          RentValidationError,
        );
      }
    });
  });

  describe('Baux que la génération ignore', () => {
    it('ignore un bail CLÔTURÉ', async () => {
      const lease = await addLease({ startDate: '2026-01-01' });

      await terminateLease(
        harness.db,
        owner,
        lease.leaseId,
        { terminationDate: '2026-09-15', reason: '' },
        LEASE_OPTIONS,
      );

      await generateRents(harness.db, owner, {}, OPTIONS);

      expect(await installmentOf(harness, lease.leaseId, PERIOD)).toBeUndefined();
    });

    it('ignore un bail dont le terme est déjà passé', async () => {
      const lease = await addLease({ startDate: '2026-01-01', endDate: '2026-09-30' });

      await generateRents(harness.db, owner, {}, OPTIONS);

      expect(await installmentOf(harness, lease.leaseId, PERIOD)).toBeUndefined();
    });

    it('facture un bail dont le terme tombe DANS la période', async () => {
      const lease = await addLease({ startDate: '2026-01-01', endDate: '2026-10-10' });

      await generateRents(harness.db, owner, {}, OPTIONS);

      expect(await installmentOf(harness, lease.leaseId, PERIOD)).toBeDefined();
    });
  });

  describe('Périmètre', () => {
    it('ne facture pas hors du périmètre du gestionnaire', async () => {
      const inside = await addLease();
      const outside = await addLease({ propertyId: outOfScopeProperty });

      await generateRents(harness.db, manager, {}, OPTIONS);

      expect(await installmentOf(harness, inside.leaseId, PERIOD)).toBeDefined();
      expect(await installmentOf(harness, outside.leaseId, PERIOD)).toBeUndefined();
    });

    it('facture toute son organisation pour le propriétaire', async () => {
      const inside = await addLease();
      const outside = await addLease({ propertyId: outOfScopeProperty });

      await generateRents(harness.db, owner, {}, OPTIONS);

      expect(await installmentOf(harness, inside.leaseId, PERIOD)).toBeDefined();
      expect(await installmentOf(harness, outside.leaseId, PERIOD)).toBeDefined();
    });

    /**
     * Un immeuble demandé est INTERSECTÉ avec le périmètre, jamais substitué :
     * s'en servir tel quel permettrait de générer chez un autre bailleur.
     */
    it('restreint à l immeuble demandé, et à lui seul', async () => {
      const inside = await addLease();
      const other = await addLease({ propertyId: outOfScopeProperty });

      await generateRents(harness.db, owner, { propertyId: inScopeProperty }, OPTIONS);

      expect(await installmentOf(harness, inside.leaseId, PERIOD)).toBeDefined();
      expect(await installmentOf(harness, other.leaseId, PERIOD)).toBeUndefined();
    });

    it('ne génère rien pour un immeuble hors périmètre, sans le distinguer d un immeuble vide', async () => {
      const outside = await addLease({ propertyId: outOfScopeProperty });

      const result = await generateRents(
        harness.db,
        manager,
        { propertyId: outOfScopeProperty },
        OPTIONS,
      );

      expect(result.expected).toBe(0);
      expect(result.created).toBe(0);
      expect(await installmentOf(harness, outside.leaseId, PERIOD)).toBeUndefined();
    });

    it("refuse un appelant d'une autre organisation", async () => {
      const lease = await addLease();

      await generateRents(harness.db, otherOwner, {}, OPTIONS).catch(() => undefined);

      expect(await installmentOf(harness, lease.leaseId, PERIOD)).toBeUndefined();
    });

    /** Un locataire ne porte pas `rent.generate` : il ne fait pas naître sa dette. */
    it('refuse un locataire', async () => {
      const lease = await addLease();
      const tenant = await contextOf(harness, lease.tenantUserId);

      await expect(generateRents(harness.db, tenant, {}, OPTIONS)).rejects.toThrow(
        ResourceOutOfScopeError,
      );
    });
  });

  /**
   * Le job planifié n'a pas d'appelant et traite TOUTES les organisations : c'est
   * la raison pour laquelle sa route ne doit pas être publique (DEC-028).
   */
  describe('Job planifié', () => {
    it('facture les deux organisations à la fois', async () => {
      const propertyB = await addProperty(harness, 'Immeuble B', {
        organizationId: SEED_IDS.organizationB,
      });

      const apartmentB = await addApartment(harness, propertyB, 'B001', {
        organizationId: SEED_IDS.organizationB,
      });
      const tenantApartmentB = await addApartment(harness, propertyB, 'B002', {
        organizationId: SEED_IDS.organizationB,
      });

      const leaseA = await addLease();
      const leaseB = await addBillableLease(harness, {
        apartmentId: apartmentB,
        tenantApartmentId: tenantApartmentB,
        ownerContext: otherOwner,
        hashPassword,
        phone: freshPhone(),
      });

      await runRentGenerationJob(harness.db, OPTIONS);

      expect(await installmentOf(harness, leaseA.leaseId, PERIOD)).toBeDefined();
      expect(await installmentOf(harness, leaseB.leaseId, PERIOD)).toBeDefined();
    });

    it('rend compte de ce qu il a fait, et de ce qu il a ignoré', async () => {
      await addLease();

      const first = await runRentGenerationJob(harness.db, OPTIONS);
      const second = await runRentGenerationJob(harness.db, OPTIONS);

      expect(first.period).toBe(PERIOD);
      expect(first.expected).toBe(first.created + first.skipped);
      expect(second.created).toBe(0);
      expect(second.skipped).toBe(second.expected);
    });
  });
});
