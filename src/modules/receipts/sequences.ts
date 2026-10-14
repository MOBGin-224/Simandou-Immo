import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';

import { leaseReceiptSequences, properties } from '@/db/schema';
import { ResourceOutOfScopeError } from '@/lib/authorization';
import type { ReceivablesDatabase } from '@/modules/receivables/service';

/**
 * Génère le numéro de quittance d'un immeuble, pour un mois donné (DEC-058,
 * 4.1). Format : {CODE}-{AAAA}-{MM}-{NNNN}, par exemple CAM-2026-10-0001.
 *
 * Même pattern que `generatePaymentReference` du Lot 11 : un compteur par
 * immeuble et par période, incrémenté sous verrou (`FOR UPDATE`) pour que
 * deux émissions concurrentes ne produisent jamais le même numéro. La ligne
 * de séquence est créée à la première émission du mois ; une violation
 * d'unicité concurrente est relue puis incrémentée plutôt que de faire
 * échouer l'appelant.
 */
export async function generateReceiptReference(
  db: ReceivablesDatabase,
  propertyId: string,
  organizationId: string,
  year: number,
  month: number,
): Promise<string> {
  return db.transaction(async (tx) => {
    const [property] = await tx
      .select({ code: properties.code })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);

    if (!property) throw new ResourceOutOfScopeError();

    const sequenceCondition = and(
      eq(leaseReceiptSequences.propertyId, propertyId),
      eq(leaseReceiptSequences.year, year),
      eq(leaseReceiptSequences.month, month),
    );

    const formatReference = (value: number): string =>
      `${property.code}-${String(year)}-${String(month).padStart(2, '0')}-${String(value).padStart(4, '0')}`;

    const [existing] = await tx
      .select({ id: leaseReceiptSequences.id, lastValue: leaseReceiptSequences.lastValue })
      .from(leaseReceiptSequences)
      .where(sequenceCondition)
      .for('update')
      .limit(1);

    if (existing) {
      const nextValue = existing.lastValue + 1;
      await tx
        .update(leaseReceiptSequences)
        .set({ lastValue: nextValue, updatedAt: new Date() })
        .where(eq(leaseReceiptSequences.id, existing.id));

      return formatReference(nextValue);
    }

    try {
      const [inserted] = await tx
        .insert(leaseReceiptSequences)
        .values({ organizationId, propertyId, year, month, lastValue: 1 })
        .returning({ lastValue: leaseReceiptSequences.lastValue });

      return formatReference(inserted?.lastValue ?? 1);
    } catch (error) {
      const maybeUniqueViolation =
        typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';

      if (!maybeUniqueViolation) throw error;

      const [reloaded] = await tx
        .select({ id: leaseReceiptSequences.id, lastValue: leaseReceiptSequences.lastValue })
        .from(leaseReceiptSequences)
        .where(sequenceCondition)
        .for('update')
        .limit(1);

      if (!reloaded) throw new Error('LEASE_RECEIPT_SEQUENCE_NOT_FOUND');

      const nextValue = reloaded.lastValue + 1;
      await tx
        .update(leaseReceiptSequences)
        .set({ lastValue: nextValue, updatedAt: new Date() })
        .where(eq(leaseReceiptSequences.id, reloaded.id));

      return formatReference(nextValue);
    }
  });
}

const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Génère une référence publique de quittance (DEC-058, 7.4). Préfixe "Q-",
 * distinct du préfixe "R-" des reçus de paiement (DEC-057), suivi de 10
 * caractères alphanumériques base62 (longueur totale 12). Non séquentielle
 * et imprévisible.
 */
export function generateReceiptPublicReference(): string {
  const bytes = randomBytes(10);
  let result = 'Q-';

  for (let i = 0; i < 10; i++) {
    result += BASE62_CHARS[bytes[i]! % BASE62_CHARS.length];
  }

  return result;
}
