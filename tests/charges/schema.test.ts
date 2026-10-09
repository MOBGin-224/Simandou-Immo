import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { NewCharge, NewChargeAllocation } from '../../src/db/schema';
import { SEED_IDS, seed } from '../../src/db/seed';
import { CHARGE_TYPES } from '../../src/modules/charges/constants';
import type { ReceivableStatus } from '../../src/modules/receivables/constants';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  addApartment,
  addBillableLease,
  addProperty,
  contextOf,
  freshPhone,
  passwordHasher,
} from '../helpers/charges';

/**
 * MVP-BACKLOG-051 et 052 : ce que la BASE refuse, quoi qu'écrive le code.
 *
 * Les invariants financiers de la section 21, l'unicité de la section 30 et la
 * liste des natures de charge de la section 29 sont portés par des contraintes,
 * et non par le seul cas d'usage. Ce fichier les attaque directement, en
 * écrivant SANS passer par le service : c'est le seul moyen de prouver qu'une
 * erreur future dans un module, ou une migration de données écrite à la main,
 * serait arrêtée.
 */
describe('Contraintes des tables de charges', () => {
  let harness: TestDatabase;
  let owner: Awaited<ReturnType<typeof contextOf>>;
  let property: string;
  let lease: { leaseId: string; tenantUserId: string; apartmentId: string };

  let counter = 0;
  const freshApartment = async () => {
    counter += 1;

    return addApartment(harness, property, `S${String(counter).padStart(3, '0')}`);
  };

  /** Charge valide, dont chaque test ne casse qu'UN champ. */
  const validCharge = (): NewCharge => ({
    organizationId: SEED_IDS.organizationA,
    propertyId: property,
    type: 'WATER',
    periodStart: '2026-05-01',
    dueDate: '2026-05-10',
    totalAmount: 3_600_000,
    currency: 'GNF',
    allocationMethod: 'EQUAL' as const,
    status: 'DRAFT' as const,
    createdBy: SEED_IDS.ownerA,
  });

  const insertCharge = (values: Partial<NewCharge>) =>
    harness.db.insert(harness.schema.charges).values({ ...validCharge(), ...values });

  /** Créance valide, dont chaque test ne casse qu'UN champ. */
  const validAllocation = (chargeId: string): NewChargeAllocation => ({
    organizationId: SEED_IDS.organizationA,
    chargeId,
    propertyId: property,
    apartmentId: lease.apartmentId,
    leaseId: lease.leaseId,
    tenantUserId: lease.tenantUserId,
    periodStart: '2026-05-01',
    dueDate: '2026-05-10',
    amountDue: 300_000,
    amountPaid: 0,
    balance: 300_000,
    currency: 'GNF',
    status: 'UNPAID' as ReceivableStatus,
    calculationBasis: {
      method: 'EQUAL',
      totalAmount: 3_600_000,
      unitCount: 12,
      baseShare: 300_000,
      roundingAdjustment: 0,
    },
  });

  /** Charge fraîche, pour que l'unicité par logement ne gêne pas les autres tests. */
  const freshCharge = async () => {
    const [row] = await insertCharge({}).returning();

    return row?.id as string;
  };

  const insertAllocation = async (values: Partial<NewChargeAllocation> = {}) => {
    const chargeId = values.chargeId ?? (await freshCharge());

    return harness.db
      .insert(harness.schema.chargeAllocations)
      .values({ ...validAllocation(chargeId), ...values });
  };

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    property = await addProperty(harness, 'Résidence Contraintes charges');
    owner = await contextOf(harness, SEED_IDS.ownerA);

    lease = await addBillableLease(harness, {
      apartmentId: await freshApartment(),
      tenantApartmentId: await freshApartment(),
      ownerContext: owner,
      hashPassword: passwordHasher(harness),
      phone: freshPhone(),
      startDate: '2026-01-01',
    });
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('La charge', () => {
    it('accepte les cinq natures du document, et refuse toute autre', async () => {
      for (const type of CHARGE_TYPES) {
        await expect(insertCharge({ type })).resolves.toBeDefined();
      }

      await expect(insertCharge({ type: 'INTERNET' })).rejects.toThrow();
      await expect(insertCharge({ type: 'water' })).rejects.toThrow();
    });

    /** Une facture de zéro n'est pas une charge : la section 28 l'écrit ainsi. */
    it('refuse un montant total nul ou négatif', async () => {
      await expect(insertCharge({ totalAmount: 0 })).rejects.toThrow();
      await expect(insertCharge({ totalAmount: -1 })).rejects.toThrow();
    });

    it('refuse une période qui ne commence pas un premier du mois', async () => {
      await expect(insertCharge({ periodStart: '2026-05-15' })).rejects.toThrow();
    });

    it('refuse une échéance antérieure à la période', async () => {
      await expect(insertCharge({ dueDate: '2026-04-30' })).rejects.toThrow();
    });

    it('refuse une devise qui n est pas trois majuscules', async () => {
      await expect(insertCharge({ currency: 'gnf' })).rejects.toThrow();
      await expect(insertCharge({ currency: 'GN' })).rejects.toThrow();
    });

    it('refuse un nom de fournisseur vide ou fait d espaces', async () => {
      await expect(insertCharge({ supplierName: '   ' })).rejects.toThrow();
    });

    /**
     * Un état et sa date ne doivent pas pouvoir se contredire : c'est le pendant
     * exact de `leases_terminated_at_matches_status`.
     */
    it('refuse une charge publiée sans date de publication', async () => {
      await expect(insertCharge({ status: 'PUBLISHED', publishedAt: null })).rejects.toThrow();
    });

    it('refuse un brouillon qui porterait une date de publication', async () => {
      await expect(insertCharge({ status: 'DRAFT', publishedAt: new Date() })).rejects.toThrow();
    });

    it('refuse une annulation sans date, et une date sans annulation', async () => {
      await expect(insertCharge({ status: 'CANCELLED', cancelledAt: null })).rejects.toThrow();
      await expect(insertCharge({ status: 'DRAFT', cancelledAt: new Date() })).rejects.toThrow();
    });

    /** Une charge publiée PUIS annulée garde ses deux dates : l'historique reste lisible. */
    it('accepte une charge annulée après avoir été publiée', async () => {
      await expect(
        insertCharge({
          status: 'CANCELLED',
          publishedAt: new Date(),
          cancelledAt: new Date(),
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('La créance de charge', () => {
    /**
     * La contrainte CENTRALE du lot : c'est elle qui rend la publication non
     * rejouable en base, et pas seulement dans le cas d'usage.
     */
    it('refuse deux parts pour la même charge et le même logement', async () => {
      const chargeId = await freshCharge();

      await expect(insertAllocation({ chargeId })).resolves.toBeDefined();
      await expect(insertAllocation({ chargeId })).rejects.toThrow();
    });

    it('accepte une part nulle, à la différence du total d une charge', async () => {
      await expect(insertAllocation({ amountDue: 0, balance: 0 })).resolves.toBeDefined();
    });

    it('refuse une part négative', async () => {
      await expect(insertAllocation({ amountDue: -1, balance: -1 })).rejects.toThrow();
    });

    it('refuse un solde qui ne vaut pas la différence des deux montants', async () => {
      await expect(
        insertAllocation({ amountDue: 300_000, amountPaid: 100_000, balance: 300_000 }),
      ).rejects.toThrow();
    });

    it('refuse un paiement supérieur à la part due', async () => {
      await expect(
        insertAllocation({ amountDue: 300_000, amountPaid: 400_000, balance: 0 }),
      ).rejects.toThrow();
    });

    it('refuse une créance payée dont le solde n est pas nul', async () => {
      await expect(
        insertAllocation({ status: 'PAID', amountPaid: 100_000, balance: 200_000 }),
      ).rejects.toThrow();
    });

    it('refuse une créance impayée sur laquelle de l argent a été reçu', async () => {
      await expect(
        insertAllocation({ status: 'UNPAID', amountPaid: 100_000, balance: 200_000 }),
      ).rejects.toThrow();
    });

    it('refuse une période qui ne commence pas un premier du mois', async () => {
      await expect(insertAllocation({ periodStart: '2026-05-15' })).rejects.toThrow();
    });

    /**
     * Les deux colonnes sont lues du MÊME bail actif au même instant (section
     * 30) : l'une sans l'autre viendrait forcément d'une écriture partielle.
     */
    it('refuse un bail sans personne redevable, et l inverse', async () => {
      await expect(insertAllocation({ tenantUserId: null })).rejects.toThrow();
      await expect(insertAllocation({ leaseId: null })).rejects.toThrow();
    });

    /** Le logement vacant, et c'est le seul cas de nullité prévu (BR-052). */
    it('accepte une créance sans bail ni personne, pour un logement vacant', async () => {
      await expect(insertAllocation({ leaseId: null, tenantUserId: null })).resolves.toBeDefined();
    });

    it('refuse une devise qui n est pas trois majuscules', async () => {
      await expect(insertAllocation({ currency: 'gnf' })).rejects.toThrow();
    });
  });
});
