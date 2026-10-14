import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { NewLeaseReceipt, NewLeaseReceiptVersion } from '../../src/db/schema';
import { SEED_IDS, seed } from '../../src/db/seed';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import {
  addApartment,
  addBillableLease,
  addProperty,
  contextOf,
  freshPhone,
  NOW,
  passwordHasher,
} from '../helpers/rents';

/**
 * DEC-058 : ce que la BASE refuse, quoi qu'écrive un futur service.
 *
 * Même méthode que `tests/charges/schema.test.ts` : écrire SANS passer par
 * un cas d'usage, pour prouver que les contraintes arrêtent une écriture
 * fautive même si le code applicatif se trompe.
 */
describe('Contraintes des tables de quittances (DEC-058)', () => {
  let harness: TestDatabase;
  let owner: Awaited<ReturnType<typeof contextOf>>;
  let property: string;
  let lease: { leaseId: string; tenantUserId: string; apartmentId: string };

  let periodCounter = 0;
  /**
   * Période fraîche, pour que l'unicité (leaseId, periodStart) ne gêne pas les
   * autres tests. Déroule sur plusieurs années pour ne jamais produire un mois
   * invalide (13, 14, ...) même si beaucoup de tests consomment une période.
   */
  const freshPeriod = () => {
    const year = 2026 + Math.floor(periodCounter / 12);
    const month = (periodCounter % 12) + 1;
    periodCounter += 1;
    return `${year}-${String(month).padStart(2, '0')}-01`;
  };

  let referenceCounter = 0;
  const freshReferenceNumber = () => {
    referenceCounter += 1;
    return `PA-2026-${String(referenceCounter).padStart(2, '0')}-0001`;
  };

  let publicReferenceCounter = 0;
  const freshPublicReference = () => {
    publicReferenceCounter += 1;
    return `Q-TEST${String(publicReferenceCounter).padStart(4, '0')}`;
  };

  /** Quittance valide, dont chaque test ne casse qu'UN champ. */
  const validReceipt = (): NewLeaseReceipt => ({
    organizationId: SEED_IDS.organizationA,
    leaseId: lease.leaseId,
    propertyId: property,
    apartmentId: lease.apartmentId,
    tenantUserId: lease.tenantUserId,
    periodStart: freshPeriod(),
    referenceNumber: freshReferenceNumber(),
    publicReference: freshPublicReference(),
    totalAttested: 2_500_000,
    currency: 'GNF',
  });

  const insertReceipt = (values: Partial<NewLeaseReceipt> = {}) =>
    harness.db.insert(harness.schema.leaseReceipts).values({ ...validReceipt(), ...values });

  const freshReceiptId = async () => {
    const [row] = await insertReceipt({}).returning();
    if (!row) throw new Error('La quittance de test n a pas ete creee.');
    return row.id;
  };

  /** Version valide, dont chaque test ne casse qu'UN champ. */
  const validVersion = (leaseReceiptId: string): NewLeaseReceiptVersion => ({
    leaseReceiptId,
    version: 1,
    status: 'EMISE',
    emittedAt: NOW,
    frozenContent: { receivables: [] },
  });

  const insertVersion = async (values: Partial<NewLeaseReceiptVersion> = {}) => {
    const leaseReceiptId = values.leaseReceiptId ?? (await freshReceiptId());

    return harness.db
      .insert(harness.schema.leaseReceiptVersions)
      .values({ ...validVersion(leaseReceiptId), ...values });
  };

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    property = await addProperty(harness, 'Résidence Contraintes quittances');
    owner = await contextOf(harness, SEED_IDS.ownerA);

    const apartmentId = await addApartment(harness, property, 'Q01');
    lease = await addBillableLease(harness, {
      apartmentId,
      tenantApartmentId: apartmentId,
      ownerContext: owner,
      hashPassword: passwordHasher(harness),
      phone: freshPhone(),
      startDate: '2026-01-01',
    });
  });

  afterAll(async () => {
    await harness.close();
  });

  describe('La quittance (lease_receipts)', () => {
    it('accepte une quittance valide', async () => {
      await expect(insertReceipt()).resolves.toBeDefined();
    });

    it('refuse deux quittances pour le même bail et la même période', async () => {
      const periodStart = freshPeriod();

      await expect(insertReceipt({ periodStart })).resolves.toBeDefined();
      await expect(
        insertReceipt({ periodStart, referenceNumber: freshReferenceNumber() }),
      ).rejects.toThrow();
    });

    it('refuse une référence publique qui ne commence pas par Q-', async () => {
      await expect(insertReceipt({ publicReference: 'R-TESTXXXX' })).rejects.toThrow();
    });

    it('refuse une période qui ne commence pas un premier du mois', async () => {
      await expect(insertReceipt({ periodStart: '2026-05-15' })).rejects.toThrow();
    });

    it('refuse un total attesté négatif', async () => {
      await expect(insertReceipt({ totalAttested: -1 })).rejects.toThrow();
    });

    it('refuse une devise qui n est pas trois majuscules', async () => {
      await expect(insertReceipt({ currency: 'gnf' })).rejects.toThrow();
    });
  });

  describe('La version (lease_receipt_versions)', () => {
    it('accepte une version ÉMISE valide', async () => {
      await expect(insertVersion()).resolves.toBeDefined();
    });

    it('refuse deux versions avec le même (leaseReceiptId, version)', async () => {
      const leaseReceiptId = await freshReceiptId();

      await expect(insertVersion({ leaseReceiptId, version: 1 })).resolves.toBeDefined();
      await expect(insertVersion({ leaseReceiptId, version: 1 })).rejects.toThrow();
    });

    it('refuse une version INVALIDÉE sans motif', async () => {
      await expect(
        insertVersion({
          status: 'INVALIDEE',
          invalidationReason: null,
          invalidatedAt: NOW,
        }),
      ).rejects.toThrow();
    });

    it('refuse une version INVALIDÉE sans date d invalidation', async () => {
      await expect(
        insertVersion({
          status: 'INVALIDEE',
          invalidationReason: 'paiement annulé',
          invalidatedAt: null,
        }),
      ).rejects.toThrow();
    });

    it('refuse une version ÉMISE qui porterait une date d invalidation', async () => {
      await expect(insertVersion({ status: 'EMISE', invalidatedAt: NOW })).rejects.toThrow();
    });

    it('accepte une version INVALIDÉE avec motif et date', async () => {
      await expect(
        insertVersion({
          status: 'INVALIDEE',
          invalidationReason: 'paiement annulé',
          invalidatedAt: NOW,
        }),
      ).resolves.toBeDefined();
    });
  });
});
