import { eq } from 'drizzle-orm';

import { createCharge, publishCharge } from '../../src/modules/charges/service';
import type { ChargeServiceOptions } from '../../src/modules/charges/service';
import { NOW, type Harness } from './rents';

/**
 * Aides propres aux tests du Lot 10.
 *
 * Elles s'appuient sur celles des lots précédents, et pour une raison de fond :
 * une créance de charge naît d'une PUBLICATION, qui lit les logements d'un
 * immeuble et le bail actif de chacun (BR-052). Fabriquer des créances à la main
 * prouverait seulement que l'insertion fonctionne, pas que la répartition lit le
 * bon parc et la bonne occupation. Tous les tests partent donc d'un vrai
 * immeuble, de vrais logements et de vrais baux, créés par les vrais cas
 * d'usage.
 */

export {
  DAY_MS,
  NOW,
  ORGANIZATION,
  PERIOD,
  RENT_AMOUNT,
  TODAY,
  addAccess,
  addApartment,
  addBillableLease,
  addProperty,
  addScope,
  addTenant,
  addUser,
  at,
  contextOf,
  dayOffset,
  freshPhone,
  installmentOf,
  installmentsOfLease,
  passwordHasher,
  setPaid,
  type Harness,
} from './rents';

/** Réglages d'un appel : instant fixe, indispensable dès qu'une date décide. */
export const OPTIONS: ChargeServiceOptions = { now: NOW };

/** Facture de référence des situations de test : 3 600 000 GNF, comme BR-049. */
export const CHARGE_TOTAL = 3_600_000;

/**
 * Enregistre une charge en brouillon, par le vrai cas d'usage.
 *
 * Les valeurs par défaut reprennent l'exemple des documents : une facture d'eau
 * de 3 600 000 GNF pour la période en cours des tests, payable le 10.
 */
export async function addCharge(
  harness: Harness,
  values: {
    propertyId: string;
    context: Parameters<typeof createCharge>[1];
    type?: 'WATER' | 'ELECTRICITY' | 'SECURITY' | 'CLEANING' | 'OTHER';
    periodStart?: string;
    dueDate?: string;
    totalAmount?: number;
    supplierName?: string | null;
  },
) {
  return createCharge(
    harness.db,
    values.context,
    {
      propertyId: values.propertyId,
      type: values.type ?? 'WATER',
      periodStart: values.periodStart ?? '2026-10',
      dueDate: values.dueDate ?? '2026-10-10',
      totalAmount: values.totalAmount ?? CHARGE_TOTAL,
      supplierName: values.supplierName ?? 'SEG',
    },
    OPTIONS,
  );
}

/** Enregistre une charge PUIS la publie : le chemin complet du parcours 18. */
export async function addPublishedCharge(
  harness: Harness,
  values: Parameters<typeof addCharge>[1],
) {
  const charge = await addCharge(harness, values);
  const published = await publishCharge(harness.db, values.context, charge.id, OPTIONS);

  return published.charge;
}

/** Ligne de charge, relue en base. */
export async function readCharge(harness: Harness, chargeId: string) {
  const [row] = await harness.db
    .select()
    .from(harness.schema.charges)
    .where(eq(harness.schema.charges.id, chargeId));

  if (!row) throw new Error(`Charge ${chargeId} introuvable.`);

  return row;
}

/** Créances d'une charge, relues en base dans leur ordre de création. */
export async function allocationsOfCharge(harness: Harness, chargeId: string) {
  return harness.db
    .select()
    .from(harness.schema.chargeAllocations)
    .where(eq(harness.schema.chargeAllocations.chargeId, chargeId))
    .orderBy(harness.schema.chargeAllocations.createdAt);
}

/**
 * Force l'état financier d'une créance de charge, sans passer par un paiement.
 *
 * Même aide que pour les loyers, et pour la même raison : les paiements
 * n'existent qu'au Lot 11, et les tests de ce lot doivent pourtant éprouver
 * `PARTIALLY_PAID` et `PAID`. L'écriture est directe ET cohérente avec les
 * contraintes de la base, qui refuse un solde qui ne serait pas la différence
 * des deux montants.
 */
export async function setAllocationPaid(
  harness: Harness,
  allocationId: string,
  amountPaid: number,
  status: 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED',
) {
  const [row] = await harness.db
    .select()
    .from(harness.schema.chargeAllocations)
    .where(eq(harness.schema.chargeAllocations.id, allocationId));

  if (!row) throw new Error(`Créance de charge ${allocationId} introuvable.`);

  await harness.db
    .update(harness.schema.chargeAllocations)
    .set({ amountPaid, balance: row.amountDue - amountPaid, status })
    .where(eq(harness.schema.chargeAllocations.id, allocationId));
}
