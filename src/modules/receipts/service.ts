import { and, eq, isNotNull, isNull, ne } from 'drizzle-orm';

import {
  chargeAllocations,
  leases,
  leaseReceiptVersions,
  paymentAllocations,
  payments,
  rentInstallments,
} from '@/db/schema';
import { ResourceOutOfScopeError, type AccessContext } from '@/lib/authorization';
import type { ReceivablesDatabase } from '@/modules/receivables/service';

import { ReceiptNotEligibleError } from './errors';
import {
  findLeaseReceiptByLeaseAndPeriod,
  findLeaseReceiptById,
  findLeaseReceiptByPublicReference,
  findLeaseReceiptRelationsById,
  insertLeaseReceiptTx,
  invalidateReceiptVersionTx,
  listLeaseReceiptsForContext,
  type LeaseReceiptListFilters,
  type LeaseReceiptListResult,
  type LeaseReceiptWithRelations,
} from './repository';
import { generateReceiptPublicReference, generateReceiptReference } from './sequences';

export type ReceiptServiceOptions = {
  now?: Date;
};

export type PublicReceiptVerificationData = {
  isRecognized: true;
  status: 'EMISE' | 'INVALIDEE';
  period: string;
  totalAttested: number;
  currency: string;
  emittedAt: string | null;
  referenceNumber: string;
  version: number;
  verifiedAt: string;
};

/**
 * Vérification publique d'une quittance par sa référence (DEC-058, 7.1 et
 * 7.2). Données minimisées à l'identique de `getPublicVerification` du
 * Lot 11 : jamais de locataire, d'adresse, d'appartement ni d'immeuble
 * (7.3).
 */
export async function getPublicReceiptVerification(
  db: ReceivablesDatabase,
  publicReference: string,
): Promise<PublicReceiptVerificationData | null> {
  const result = await findLeaseReceiptByPublicReference(db, publicReference);
  if (!result?.currentVersion) return null;

  const { receipt, currentVersion } = result;

  return {
    isRecognized: true,
    status: currentVersion.status,
    period: receipt.periodStart,
    totalAttested: Number(receipt.totalAttested),
    currency: receipt.currency,
    emittedAt: currentVersion.emittedAt?.toISOString() ?? null,
    referenceNumber: receipt.referenceNumber,
    version: currentVersion.version,
    verifiedAt: new Date().toISOString(),
  };
}

export type EligibleAllocation = {
  paymentId: string;
  amount: number;
};

export type EligibleReceivable = {
  kind: 'RENT' | 'CHARGE';
  id: string;
  amountDue: number;
  allocationsValides: EligibleAllocation[];
  totalAlloue: number;
};

export type EligibilityResult = {
  eligible: boolean;
  reason?: string;
  receivables: EligibleReceivable[];
};

/**
 * Date à partir de laquelle une période est finalisée (DEC-058, 3.2) : le 6
 * du mois suivant. `periodStart` est le premier jour du mois couvert.
 */
function finalizationDateOf(periodStart: string): Date {
  const [year, month] = periodStart.split('-').map(Number) as [number, number];
  // `month` est 1-indexé (BR-035) ; passé tel quel à `Date.UTC`, il désigne
  // déjà le mois SUIVANT en index 0-indexé (janvier=0, ..., décembre=11).
  return new Date(Date.UTC(year, month, 6));
}

/**
 * Allocations valides d'une créance : celles d'un paiement CONFIRMED
 * (DEC-058, 3.1.d). Les colonnes `amount_paid` et `balance` de la créance ne
 * reflètent déjà que ces allocations (section 21), cette requête ne fait que
 * les détailler pour le contenu figé de la quittance.
 */
async function validAllocationsFor(
  db: ReceivablesDatabase,
  kind: 'RENT' | 'CHARGE',
  receivableId: string,
): Promise<EligibleAllocation[]> {
  const column =
    kind === 'RENT' ? paymentAllocations.rentInstallmentId : paymentAllocations.chargeAllocationId;

  const rows = await db
    .select({ paymentId: paymentAllocations.paymentId, amount: paymentAllocations.amount })
    .from(paymentAllocations)
    .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
    .where(and(eq(column, receivableId), eq(payments.status, 'CONFIRMED')));

  return rows.map((row) => ({ paymentId: row.paymentId, amount: Number(row.amount) }));
}

/**
 * Vérifie les quatre conditions d'émission de DEC-058, 3.1, pour un bail et
 * une période donnés.
 */
export async function checkEligibility(
  db: ReceivablesDatabase,
  leaseId: string,
  periodStart: string,
  options: ReceiptServiceOptions = {},
): Promise<EligibilityResult> {
  const now = options.now ?? new Date();

  const [rentRows, chargeRows] = await Promise.all([
    db
      .select()
      .from(rentInstallments)
      .where(
        and(eq(rentInstallments.leaseId, leaseId), eq(rentInstallments.periodStart, periodStart)),
      ),
    db
      .select()
      .from(chargeAllocations)
      .where(
        and(
          eq(chargeAllocations.leaseId, leaseId),
          eq(chargeAllocations.periodStart, periodStart),
          ne(chargeAllocations.status, 'CANCELLED'),
        ),
      ),
  ]);

  // Une échéance de loyer annulée n'est plus due (DEC-015) : même exclusion
  // que les charges annulées ci-dessus.
  const admissibleRent = rentRows.filter((row) => row.status !== 'CANCELLED');

  const admissible: Array<{
    kind: 'RENT' | 'CHARGE';
    id: string;
    amountDue: number;
    balance: number;
  }> = [
    ...admissibleRent.map((row) => ({
      kind: 'RENT' as const,
      id: row.id,
      amountDue: Number(row.amountDue),
      balance: Number(row.balance),
    })),
    ...chargeRows.map((row) => ({
      kind: 'CHARGE' as const,
      id: row.id,
      amountDue: Number(row.amountDue),
      balance: Number(row.balance),
    })),
  ];

  if (admissible.length === 0) {
    return {
      eligible: false,
      reason: 'Aucune créance admissible pour cette période.',
      receivables: [],
    };
  }

  if (now.getTime() < finalizationDateOf(periodStart).getTime()) {
    return { eligible: false, reason: "La période n'est pas encore finalisée.", receivables: [] };
  }

  const unsettled = admissible.filter((row) => row.balance !== 0);
  if (unsettled.length > 0) {
    return {
      eligible: false,
      reason: 'Le solde de certaines créances de la période n’est pas nul.',
      receivables: [],
    };
  }

  const receivables: EligibleReceivable[] = await Promise.all(
    admissible.map(async (row) => {
      const allocationsValides = await validAllocationsFor(db, row.kind, row.id);
      return {
        kind: row.kind,
        id: row.id,
        amountDue: row.amountDue,
        allocationsValides,
        totalAlloue: allocationsValides.reduce((sum, allocation) => sum + allocation.amount, 0),
      };
    }),
  );

  return { eligible: true, receivables };
}

type FrozenAllocation = { paymentId: string; amount: number };
type FrozenReceivable = {
  kind: 'RENT' | 'CHARGE';
  id: string;
  amountDue: number;
  allocations: FrozenAllocation[];
};
type FrozenContent = { receivables: FrozenReceivable[] };

function buildFrozenContent(receivables: EligibleReceivable[]): FrozenContent {
  return {
    receivables: receivables.map((receivable) => ({
      kind: receivable.kind,
      id: receivable.id,
      amountDue: receivable.amountDue,
      allocations: receivable.allocationsValides,
    })),
  };
}

/**
 * Émet la quittance d'un bail pour une période (DEC-058, section 3).
 *
 * Automatique et sans utilisateur : `emittedByUserId` est toujours nul ici
 * (3.3, 3.4). Une réémission sur une période déjà couverte ne crée jamais de
 * second exemplaire : elle retourne l'existant (4.1).
 */
export async function emitReceipt(
  db: ReceivablesDatabase,
  leaseId: string,
  periodStart: string,
  options: ReceiptServiceOptions = {},
): Promise<LeaseReceiptWithRelations> {
  const existing = await findLeaseReceiptByLeaseAndPeriod(db, leaseId, periodStart);
  if (existing) {
    const relations = await findLeaseReceiptRelationsById(db, existing.id);
    if (!relations) throw new Error('LEASE_RECEIPT_RELATIONS_NOT_FOUND');
    return relations;
  }

  const eligibility = await checkEligibility(db, leaseId, periodStart, options);
  if (!eligibility.eligible) {
    throw new ReceiptNotEligibleError(eligibility.reason ?? 'Conditions d’émission non réunies.');
  }

  const [lease] = await db.select().from(leases).where(eq(leases.id, leaseId)).limit(1);
  if (!lease) throw new ResourceOutOfScopeError();

  const [year, month] = periodStart.split('-').map(Number) as [number, number];
  const referenceNumber = await generateReceiptReference(
    db,
    lease.propertyId,
    lease.organizationId,
    year,
    month,
  );
  const publicReference = generateReceiptPublicReference();
  const totalAttested = eligibility.receivables.reduce(
    (sum, receivable) => sum + receivable.amountDue,
    0,
  );
  const now = options.now ?? new Date();

  const { receipt } = await insertLeaseReceiptTx(db, {
    organizationId: lease.organizationId,
    leaseId,
    propertyId: lease.propertyId,
    apartmentId: lease.apartmentId,
    tenantUserId: lease.tenantUserId,
    periodStart,
    referenceNumber,
    publicReference,
    totalAttested,
    currency: lease.currency,
    emittedAt: now,
    emittedByUserId: null,
    frozenContent: buildFrozenContent(eligibility.receivables),
  });

  const relations = await findLeaseReceiptRelationsById(db, receipt.id);
  if (!relations) throw new Error('LEASE_RECEIPT_RELATIONS_NOT_FOUND');
  return relations;
}

function frozenContentReferencesPayment(content: unknown, paymentId: string): boolean {
  if (typeof content !== 'object' || content === null || !('receivables' in content)) return false;

  const receivables = (content as { receivables?: unknown }).receivables;
  if (!Array.isArray(receivables)) return false;

  return receivables.some((receivable: unknown) => {
    if (typeof receivable !== 'object' || receivable === null || !('allocations' in receivable)) {
      return false;
    }
    const allocations = (receivable as { allocations?: unknown }).allocations;
    if (!Array.isArray(allocations)) return false;

    return allocations.some(
      (allocation: unknown) =>
        typeof allocation === 'object' &&
        allocation !== null &&
        (allocation as { paymentId?: unknown }).paymentId === paymentId,
    );
  });
}

/**
 * Invalide toutes les versions émises référençant un paiement devenu
 * CANCELLED ou DISPUTED (DEC-058, 5.3.a). Appelée par le service paiements
 * après une annulation ou une contestation, câblage laissé à une tâche
 * ultérieure.
 */
export async function invalidateReceiptForPayment(
  db: ReceivablesDatabase,
  paymentId: string,
  reason: string,
  options: ReceiptServiceOptions = {},
): Promise<number> {
  void options;

  const emisVersions = await db
    .select()
    .from(leaseReceiptVersions)
    .where(
      and(eq(leaseReceiptVersions.status, 'EMISE'), isNull(leaseReceiptVersions.invalidatedAt)),
    );

  const matching = emisVersions.filter((version) =>
    frozenContentReferencesPayment(version.frozenContent, paymentId),
  );

  for (const version of matching) {
    await invalidateReceiptVersionTx(db, version.id, reason, paymentId);
  }

  return matching.length;
}

export async function getLeaseReceiptById(
  db: ReceivablesDatabase,
  receiptId: string,
  context: AccessContext,
): Promise<LeaseReceiptWithRelations> {
  const result = await findLeaseReceiptById(db, receiptId, context);
  if (!result) throw new ResourceOutOfScopeError();
  return result;
}

export async function listLeaseReceipts(
  db: ReceivablesDatabase,
  context: AccessContext,
  filters: LeaseReceiptListFilters = {},
): Promise<LeaseReceiptListResult> {
  return listLeaseReceiptsForContext(db, context, filters);
}

export type MonthlyReceiptJobDetail = {
  leaseId: string;
  period: string;
  status: 'EMITTED' | 'SKIPPED';
  reason?: string;
};

export type MonthlyReceiptJobResult = {
  emitted: number;
  skipped: number;
  details: MonthlyReceiptJobDetail[];
};

/** Premier jour du mois précédent celui de `now` (DEC-058, 3.3). */
function previousPeriodOf(now: Date): string {
  const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const year = previousMonth.getUTCFullYear();
  const month = previousMonth.getUTCMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/**
 * Job mensuel de génération des quittances (DEC-058, 3.3 et 3.4).
 *
 * Cible toujours le mois PRÉCÉDENT celui de `now`, jamais le mois courant,
 * et seulement une fois sa fenêtre de finalisation ouverte (3.2, le 6 du
 * mois en cours relativement à `now`) : avant cette date, rien n'est fait.
 * Émission automatique et sans utilisateur, comme `emitReceipt` lui-même.
 */
export async function generateMonthlyReceiptsJob(
  db: ReceivablesDatabase,
  options: ReceiptServiceOptions = {},
): Promise<MonthlyReceiptJobResult> {
  const now = options.now ?? new Date();
  const periodStart = previousPeriodOf(now);

  if (now.getTime() < finalizationDateOf(periodStart).getTime()) {
    return { emitted: 0, skipped: 0, details: [] };
  }

  const [rentLeaseRows, chargeLeaseRows] = await Promise.all([
    db
      .select({ leaseId: rentInstallments.leaseId })
      .from(rentInstallments)
      .where(eq(rentInstallments.periodStart, periodStart)),
    db
      .select({ leaseId: chargeAllocations.leaseId })
      .from(chargeAllocations)
      .where(
        and(eq(chargeAllocations.periodStart, periodStart), isNotNull(chargeAllocations.leaseId)),
      ),
  ]);

  const leaseIds = Array.from(
    new Set([
      ...rentLeaseRows.map((row) => row.leaseId),
      ...chargeLeaseRows.map((row) => row.leaseId as string),
    ]),
  );

  const details: MonthlyReceiptJobDetail[] = [];
  let emitted = 0;
  let skipped = 0;

  for (const leaseId of leaseIds) {
    const eligibility = await checkEligibility(db, leaseId, periodStart, { now });

    if (!eligibility.eligible) {
      skipped += 1;
      details.push({
        leaseId,
        period: periodStart,
        status: 'SKIPPED',
        reason: eligibility.reason,
      });
      continue;
    }

    await emitReceipt(db, leaseId, periodStart, { now });
    emitted += 1;
    details.push({ leaseId, period: periodStart, status: 'EMITTED' });
  }

  return { emitted, skipped, details };
}
