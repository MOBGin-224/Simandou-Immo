import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock('@/db/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/db/client')>()),
  getDb: mocks.getDb,
}));

import { SEED_IDS, seed } from '../../../src/db/seed';
import { GET } from '../../../src/app/api/v1/public/verify/[publicReference]/route';
import { generatePublicReference } from '../../../src/modules/payments';
import { createTestDatabase, type TestDatabase } from '../../helpers/database';

describe('GET /api/v1/public/verify/[publicReference]', () => {
  let harness: TestDatabase;
  let confirmedReference: string;
  let cancelledReference: string;
  let requestNumber = 0;

  async function insertPayment(status: 'CONFIRMED' | 'CANCELLED') {
    const publicReference = generatePublicReference();
    const [payment] = await harness.db
      .insert(harness.schema.payments)
      .values({
        organizationId: SEED_IDS.organizationA,
        propertyId: SEED_IDS.propertyA,
        apartmentId: SEED_IDS.apartmentA01,
        tenantId: SEED_IDS.ownerA,
        amount: 245_000,
        currency: 'GNF',
        method: 'CASH',
        status,
        paidAt: '2026-10-01',
        declaredAt: new Date('2026-10-01T10:00:00.000Z'),
        createdBy: SEED_IDS.ownerA,
        validatedAt: status === 'CONFIRMED' ? new Date('2026-10-02T11:00:00.000Z') : null,
        referenceNumber: `PUBLIC-VERIFY-${status}`,
        publicReference,
      })
      .returning();

    if (!payment) throw new Error('PUBLIC_VERIFY_FIXTURE_INSERT_RETURNED_NO_ROW');

    await harness.db.insert(harness.schema.paymentReceiptVersions).values({
      paymentId: payment.id,
      version: 1,
      isActive: true,
      generatedByUserId: SEED_IDS.ownerA,
    });

    return publicReference;
  }

  async function get(publicReference: string, ip = `192.0.2.${++requestNumber}`) {
    return GET(
      new Request(`https://immo.test/api/v1/public/verify/${publicReference}`, {
        headers: { 'x-forwarded-for': ip },
      }),
      { params: Promise.resolve({ publicReference }) },
    );
  }

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);
    confirmedReference = await insertPayment('CONFIRMED');
    cancelledReference = await insertPayment('CANCELLED');
  });

  beforeEach(() => {
    mocks.getDb.mockReset().mockReturnValue(harness.db);
  });

  afterAll(async () => {
    await harness.close();
  });

  it('reconnaît un paiement confirmé et expose uniquement les champs autorisés', async () => {
    const response = await get(confirmedReference);
    const body = (await response.json()) as {
      recognized: boolean;
      data?: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(body.recognized).toBe(true);
    expect(body.data).toMatchObject({
      isRecognized: true,
      paymentStatus: 'CONFIRMED',
      documentStatus: 'actif',
      amount: 245_000,
      currency: 'GNF',
      paidAt: '2026-10-01',
      validatedAt: '2026-10-02T11:00:00.000Z',
      version: 1,
    });
    expect(Object.keys(body.data ?? {}).sort()).toEqual(
      [
        'isRecognized',
        'paymentStatus',
        'documentStatus',
        'amount',
        'currency',
        'paidAt',
        'validatedAt',
        'version',
        'verifiedAt',
      ].sort(),
    );
    expect(body.data?.verifiedAt).toEqual(expect.any(String));
  });

  it('ne renvoie aucune donnée personnelle ni détail interne', async () => {
    const body = await (await get(confirmedReference)).text();

    expect(body).not.toMatch(
      /tenant|apartment|property|allocation|dispute|reason|validatedBy|Patrimoine Camayenne/i,
    );
  });

  it('indique un document actif pour la version active du reçu', async () => {
    const body = (await (await get(confirmedReference)).json()) as {
      data: { documentStatus: string };
    };

    expect(body.data.documentStatus).toBe('actif');
  });

  it('renvoie le montant et la devise du paiement', async () => {
    const body = (await (await get(confirmedReference)).json()) as {
      data: { amount: number; currency: string };
    };

    expect(body.data).toMatchObject({ amount: 245_000, currency: 'GNF' });
  });

  it('répond neutralement pour une référence inconnue au bon format', async () => {
    const response = await get('R-Unknown123');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ recognized: false });
  });

  it('répond neutralement pour un format invalide', async () => {
    const response = await get('abc');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ recognized: false });
  });

  it('répond neutralement pour une référence vide', async () => {
    const response = await get('');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ recognized: false });
  });

  it('ne divulgue aucune information pour les références non reconnues', async () => {
    const body = await (await get('R-Unknown123')).text();

    expect(body).toBe('{"recognized":false}');
    expect(body).not.toMatch(/tenant|apartment|property|allocation|reason/i);
  });

  it('marque comme invalidé le reçu d’un paiement annulé', async () => {
    const response = await get(cancelledReference);
    const body = (await response.json()) as {
      recognized: boolean;
      data: { documentStatus: string; paymentStatus: string };
    };

    expect(response.status).toBe(200);
    expect(body.recognized).toBe(true);
    expect(body.data).toMatchObject({
      documentStatus: 'invalidé',
      paymentStatus: 'CANCELLED',
    });
  });

  it('limite à 30 les requêtes par minute depuis la même adresse IP', async () => {
    const ip = `198.51.100.${++requestNumber}`;

    for (let request = 0; request < 30; request += 1) {
      expect((await get('R-Unknown123', ip)).status).toBe(200);
    }

    expect((await get('R-Unknown123', ip)).status).toBe(429);
  });
});
