import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS, seed } from '../../src/db/seed';
import {
  generateReceiptPublicReference,
  generateReceiptReference,
} from '../../src/modules/receipts';
import { createTestDatabase, type TestDatabase } from '../helpers/database';
import { addProperty } from '../helpers/rents';

describe('generateReceiptPublicReference', () => {
  it('commence par "Q-"', () => {
    expect(generateReceiptPublicReference().startsWith('Q-')).toBe(true);
  });

  it('fait 12 caractères', () => {
    expect(generateReceiptPublicReference()).toHaveLength(12);
  });

  it('produit 100 chaînes distinctes sur 100 appels', () => {
    const references = new Set(Array.from({ length: 100 }, () => generateReceiptPublicReference()));

    expect(references.size).toBe(100);
  });
});

describe('generateReceiptReference', () => {
  let harness: TestDatabase;
  let propertyId: string;
  let propertyCode: string;
  let otherPropertyId: string;
  let otherPropertyCode: string;

  beforeAll(async () => {
    harness = await createTestDatabase();
    await seed(harness.db);

    propertyId = await addProperty(harness, 'Résidence Séquences A');
    otherPropertyId = await addProperty(harness, 'Résidence Séquences B');

    const [property] = await harness.db
      .select({ code: harness.schema.properties.code })
      .from(harness.schema.properties)
      .where(eq(harness.schema.properties.id, propertyId));
    const [otherProperty] = await harness.db
      .select({ code: harness.schema.properties.code })
      .from(harness.schema.properties)
      .where(eq(harness.schema.properties.id, otherPropertyId));

    if (!property || !otherProperty) throw new Error('Immeuble de test introuvable.');
    propertyCode = property.code;
    otherPropertyCode = otherProperty.code;
  });

  afterAll(async () => {
    await harness.close();
  });

  it('numérote le premier appel à 0001', async () => {
    const reference = await generateReceiptReference(
      harness.db,
      propertyId,
      SEED_IDS.organizationA,
      2026,
      10,
    );

    expect(reference).toBe(`${propertyCode}-2026-10-0001`);
  });

  it('incrémente le deuxième appel pour le même immeuble et le même mois', async () => {
    const reference = await generateReceiptReference(
      harness.db,
      propertyId,
      SEED_IDS.organizationA,
      2026,
      10,
    );

    expect(reference).toBe(`${propertyCode}-2026-10-0002`);
  });

  it('repart à 0001 pour un autre mois de la même année', async () => {
    const reference = await generateReceiptReference(
      harness.db,
      propertyId,
      SEED_IDS.organizationA,
      2026,
      11,
    );

    expect(reference).toBe(`${propertyCode}-2026-11-0001`);
  });

  it('repart à 0001 pour la même période une autre année', async () => {
    const reference = await generateReceiptReference(
      harness.db,
      propertyId,
      SEED_IDS.organizationA,
      2027,
      10,
    );

    expect(reference).toBe(`${propertyCode}-2027-10-0001`);
  });

  it('tient une numérotation propre à chaque immeuble', async () => {
    const reference = await generateReceiptReference(
      harness.db,
      otherPropertyId,
      SEED_IDS.organizationA,
      2026,
      10,
    );

    expect(reference).toBe(`${otherPropertyCode}-2026-10-0001`);
  });
});
