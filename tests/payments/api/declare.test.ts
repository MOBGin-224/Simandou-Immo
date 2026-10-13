import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  requireAccessContext: vi.fn(),
}));

vi.mock('@/db/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/db/client')>()),
  getDb: mocks.getDb,
}));

vi.mock('@/lib/authorization', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/authorization')>()),
  requireAccessContext: mocks.requireAccessContext,
}));

import { SEED_IDS, seed } from '../../../src/db/seed';
import { UnauthenticatedError } from '../../../src/lib/auth/session';
import { POST } from '../../../src/app/api/v1/payments/manual/route';
import { generateRents } from '../../../src/modules/rents/service';
import { createTestDatabase, type TestDatabase } from '../../helpers/database';
import {
  addApartment,
  addBillableLease,
  contextOf,
  freshPhone,
  NOW,
  passwordHasher,
  RENT_AMOUNT,
} from '../../helpers/rents';

describe('POST /api/v1/payments/manual', () => {
  let harness: TestDatabase;
  let ownerContext: Awaited<ReturnType<typeof contextOf>>;
  let managerContext: Awaited<ReturnType<typeof contextOf>>;
  let tenantContext: Awaited<ReturnType<typeof contextOf>>;
  let tenantId: string;
  let apartmentOutOfScopeId: string;

  const body = (apartmentId: string = SEED_IDS.apartmentA01, amount = 100_000) => ({
    apartmentId,
    tenantId,
    amount,
    method: 'CASH',
    paidAt: NOW.toISOString().slice(0, 10),
  });

  const request = (input: unknown) =>
    new Request('https://immo.test/api/v1/payments/manual', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    ownerContext = await contextOf(harness, SEED_IDS.ownerA);
    managerContext = await contextOf(harness, SEED_IDS.managerA);
    const lease = await addBillableLease(harness, {
      apartmentId: SEED_IDS.apartmentA01,
      tenantApartmentId: SEED_IDS.apartmentA01,
      ownerContext,
      hashPassword: passwordHasher(harness),
      phone: freshPhone(),
    });
    tenantId = lease.tenantUserId;
    tenantContext = await contextOf(harness, tenantId);

    await generateRents(
      harness.db,
      ownerContext,
      { propertyId: SEED_IDS.propertyA, period: '2026-10' },
      { now: NOW },
    );

    apartmentOutOfScopeId = await addApartment(harness, SEED_IDS.propertyB, 'OUT-01', {
      organizationId: SEED_IDS.organizationB,
    });
  });

  beforeEach(() => {
    mocks.getDb.mockReset().mockReturnValue(harness.db);
    mocks.requireAccessContext.mockReset();
  });

  afterAll(async () => {
    await harness.close();
  });

  it('déclare un paiement par un propriétaire avec 201 et PENDING', async () => {
    mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

    const response = await POST(request(body()));
    const result = (await response.json()) as { data: { status: string } };

    expect(response.status).toBe(201);
    expect(result.data.status).toBe('PENDING');
  });

  it('autorise un gestionnaire sur son périmètre', async () => {
    mocks.requireAccessContext.mockResolvedValueOnce(managerContext);

    const response = await POST(request(body()));

    expect(response.status).toBe(201);
  });

  it('autorise un locataire à déclarer son paiement', async () => {
    mocks.requireAccessContext.mockResolvedValueOnce(tenantContext);

    const response = await POST(request(body()));
    const result = (await response.json()) as { data: { status: string } };

    expect(response.status).toBe(201);
    expect(result.data.status).toBe('PENDING');
  });

  it('répond 401 sans authentification', async () => {
    mocks.requireAccessContext.mockRejectedValueOnce(new UnauthenticatedError());

    const response = await POST(request(body()));
    const result = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(401);
    expect(result.error.code).toBe('UNAUTHORIZED');
  });

  it('refuse un appartement hors périmètre sans en révéler l’existence', async () => {
    mocks.requireAccessContext.mockResolvedValueOnce(managerContext);

    const response = await POST(request(body(apartmentOutOfScopeId)));

    expect(response.status).toBe(404);
  });

  it('retourne AMOUNT_EXCEEDS_OUTSTANDING au-delà du solde', async () => {
    mocks.requireAccessContext.mockResolvedValueOnce(ownerContext);

    const response = await POST(request(body(SEED_IDS.apartmentA01, RENT_AMOUNT + 1)));
    const result = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(422);
    expect(result.error.code).toBe('AMOUNT_EXCEEDS_OUTSTANDING');
  });
});
