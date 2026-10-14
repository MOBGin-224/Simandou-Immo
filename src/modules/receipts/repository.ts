import { and, count, desc, eq, or } from 'drizzle-orm';
import {
  apartments,
  leaseReceipts,
  leaseReceiptVersions,
  organizations,
  properties,
  users,
  type LeaseReceipt,
  type LeaseReceiptVersion,
  type NewLeaseReceipt,
  type NewLeaseReceiptVersion,
} from '@/db/schema';
import {
  propertyScopeCondition,
  readablePropertyScopes,
  type AccessContext,
} from '@/lib/authorization';
import type { ReceivablesDatabase } from '@/modules/receivables/service';

/**
 * Quittance avec les relations nécessaires à son affichage : la version
 * active (nulle juste après l'insertion, avant la mise à jour de
 * `currentVersionId`) et les noms dénormalisés depuis le bail (DEC-058).
 */
export type LeaseReceiptWithRelations = {
  receipt: LeaseReceipt;
  currentVersion: LeaseReceiptVersion | null;
  tenantName: string;
  apartmentName: string;
  propertyName: string;
  organizationName: string;
};

export type LeaseReceiptListFilters = {
  page?: number;
  status?: 'EMISE' | 'INVALIDEE';
  propertyId?: string;
  tenantUserId?: string;
  period?: string;
};

export type LeaseReceiptListResult = {
  receipts: LeaseReceiptWithRelations[];
  meta: { total: number; page: number; pageSize: number };
};

export type InsertLeaseReceiptPayload = {
  organizationId: string;
  leaseId: string;
  propertyId: string;
  apartmentId: string;
  tenantUserId: string;
  periodStart: string;
  referenceNumber: string;
  publicReference: string;
  totalAttested: number;
  currency: string;
  emittedAt: Date;
  emittedByUserId: string | null;
  frozenContent: NewLeaseReceiptVersion['frozenContent'];
};

const LEASE_RECEIPT_LIST_PAGE_SIZE = 20;

/**
 * Même périmètre que `paymentVisibilityCondition` du Lot 11 : propriétaire
 * et gestionnaire voient selon leur périmètre d'immeuble (`payment.read`,
 * réutilisée ici faute de permission dédiée à ce jour), le locataire ne voit
 * que ses propres quittances.
 */
function leaseReceiptVisibilityCondition(context: AccessContext) {
  const scopes = readablePropertyScopes(context, 'payment.read');
  const propertyCondition = propertyScopeCondition(scopes, {
    organizationId: leaseReceipts.organizationId,
    propertyId: leaseReceipts.propertyId,
  });
  const tenantCondition = or(
    ...context.memberships
      .filter((membership) => membership.role === 'TENANT')
      .map((membership) =>
        and(
          eq(leaseReceipts.organizationId, membership.organizationId),
          eq(leaseReceipts.tenantUserId, context.userId),
        ),
      ),
  );
  return or(propertyCondition, tenantCondition);
}

const RELATIONS_SELECTION = {
  receipt: leaseReceipts,
  currentVersion: leaseReceiptVersions,
  tenantName: users.fullName,
  apartmentName: apartments.number,
  propertyName: properties.name,
  organizationName: organizations.name,
};

function toWithRelations(row: {
  receipt: LeaseReceipt;
  currentVersion: LeaseReceiptVersion | null;
  tenantName: string;
  apartmentName: string;
  propertyName: string;
  organizationName: string;
}): LeaseReceiptWithRelations {
  return row;
}

export async function findLeaseReceiptById(
  db: ReceivablesDatabase,
  receiptId: string,
  context: AccessContext,
): Promise<LeaseReceiptWithRelations | null> {
  const visibilityCondition = leaseReceiptVisibilityCondition(context);
  if (!visibilityCondition) return null;

  const [row] = await db
    .select(RELATIONS_SELECTION)
    .from(leaseReceipts)
    .innerJoin(users, eq(users.id, leaseReceipts.tenantUserId))
    .innerJoin(apartments, eq(apartments.id, leaseReceipts.apartmentId))
    .innerJoin(properties, eq(properties.id, leaseReceipts.propertyId))
    .innerJoin(organizations, eq(organizations.id, leaseReceipts.organizationId))
    .leftJoin(leaseReceiptVersions, eq(leaseReceiptVersions.id, leaseReceipts.currentVersionId))
    .where(and(eq(leaseReceipts.id, receiptId), visibilityCondition))
    .limit(1);

  return row ? toWithRelations(row) : null;
}

/**
 * Charge les relations d'une quittance SANS filtre de périmètre.
 *
 * Réservée au service, pour l'émission automatique par job (DEC-058, 3.3 et
 * 3.4) : ce chemin n'a pas de `context` utilisateur, il n'y a donc rien à
 * vérifier. Ne jamais exposer cette fonction à une route.
 */
export async function findLeaseReceiptRelationsById(
  db: ReceivablesDatabase,
  receiptId: string,
): Promise<LeaseReceiptWithRelations | null> {
  const [row] = await db
    .select(RELATIONS_SELECTION)
    .from(leaseReceipts)
    .innerJoin(users, eq(users.id, leaseReceipts.tenantUserId))
    .innerJoin(apartments, eq(apartments.id, leaseReceipts.apartmentId))
    .innerJoin(properties, eq(properties.id, leaseReceipts.propertyId))
    .innerJoin(organizations, eq(organizations.id, leaseReceipts.organizationId))
    .leftJoin(leaseReceiptVersions, eq(leaseReceiptVersions.id, leaseReceipts.currentVersionId))
    .where(eq(leaseReceipts.id, receiptId))
    .limit(1);

  return row ? toWithRelations(row) : null;
}

/** Recherche par clé métier (DEC-058, 2.2), sans filtre de périmètre : usage interne au service. */
export async function findLeaseReceiptByLeaseAndPeriod(
  db: ReceivablesDatabase,
  leaseId: string,
  periodStart: string,
): Promise<LeaseReceipt | null> {
  const [row] = await db
    .select()
    .from(leaseReceipts)
    .where(and(eq(leaseReceipts.leaseId, leaseId), eq(leaseReceipts.periodStart, periodStart)))
    .limit(1);

  return row ?? null;
}

/**
 * Recherche par référence publique (DEC-058, 7.1), sans filtre de périmètre
 * ni jointure autre que la version courante : réservée à la vérification
 * publique, qui n'a ni utilisateur ni organisation.
 */
export async function findLeaseReceiptByPublicReference(
  db: ReceivablesDatabase,
  publicReference: string,
): Promise<{ receipt: LeaseReceipt; currentVersion: LeaseReceiptVersion | null } | null> {
  const [row] = await db
    .select({ receipt: leaseReceipts, currentVersion: leaseReceiptVersions })
    .from(leaseReceipts)
    .leftJoin(leaseReceiptVersions, eq(leaseReceiptVersions.id, leaseReceipts.currentVersionId))
    .where(eq(leaseReceipts.publicReference, publicReference))
    .limit(1);

  return row ?? null;
}

export async function listLeaseReceiptsForContext(
  db: ReceivablesDatabase,
  context: AccessContext,
  filters: LeaseReceiptListFilters = {},
): Promise<LeaseReceiptListResult> {
  const visibilityCondition = leaseReceiptVisibilityCondition(context);
  const page = filters.page ?? 1;

  if (!visibilityCondition) {
    return { receipts: [], meta: { total: 0, page, pageSize: LEASE_RECEIPT_LIST_PAGE_SIZE } };
  }

  const where = and(
    visibilityCondition,
    filters.status ? eq(leaseReceiptVersions.status, filters.status) : undefined,
    filters.propertyId ? eq(leaseReceipts.propertyId, filters.propertyId) : undefined,
    filters.tenantUserId ? eq(leaseReceipts.tenantUserId, filters.tenantUserId) : undefined,
    filters.period ? eq(leaseReceipts.periodStart, filters.period) : undefined,
  );
  const offset = (page - 1) * LEASE_RECEIPT_LIST_PAGE_SIZE;

  const baseQuery = () =>
    db
      .select(RELATIONS_SELECTION)
      .from(leaseReceipts)
      .innerJoin(users, eq(users.id, leaseReceipts.tenantUserId))
      .innerJoin(apartments, eq(apartments.id, leaseReceipts.apartmentId))
      .innerJoin(properties, eq(properties.id, leaseReceipts.propertyId))
      .innerJoin(organizations, eq(organizations.id, leaseReceipts.organizationId))
      .leftJoin(leaseReceiptVersions, eq(leaseReceiptVersions.id, leaseReceipts.currentVersionId))
      .where(where);

  const [rows, [totalRow]] = await Promise.all([
    baseQuery()
      .orderBy(desc(leaseReceipts.periodStart), desc(leaseReceipts.createdAt))
      .limit(LEASE_RECEIPT_LIST_PAGE_SIZE)
      .offset(offset),
    db
      .select({ total: count() })
      .from(leaseReceipts)
      .leftJoin(leaseReceiptVersions, eq(leaseReceiptVersions.id, leaseReceipts.currentVersionId))
      .where(where),
  ]);

  return {
    receipts: rows.map(toWithRelations),
    meta: { total: totalRow?.total ?? 0, page, pageSize: LEASE_RECEIPT_LIST_PAGE_SIZE },
  };
}

/**
 * Insère la quittance et sa première version dans la même transaction
 * (DEC-058, 2.5 et 5.1), puis met à jour `currentVersionId` : la version
 * n'existe qu'une fois la quittance créée, et la quittance ne référence sa
 * version qu'une fois celle-ci créée.
 */
export async function insertLeaseReceiptTx(
  db: ReceivablesDatabase,
  payload: InsertLeaseReceiptPayload,
): Promise<{ receipt: LeaseReceipt; version: LeaseReceiptVersion }> {
  return db.transaction(async (tx) => {
    const receiptValues: NewLeaseReceipt = {
      organizationId: payload.organizationId,
      leaseId: payload.leaseId,
      propertyId: payload.propertyId,
      apartmentId: payload.apartmentId,
      tenantUserId: payload.tenantUserId,
      periodStart: payload.periodStart,
      referenceNumber: payload.referenceNumber,
      publicReference: payload.publicReference,
      totalAttested: payload.totalAttested,
      currency: payload.currency,
    };

    const [insertedReceipt] = await tx.insert(leaseReceipts).values(receiptValues).returning();
    if (!insertedReceipt) throw new Error('LEASE_RECEIPT_INSERT_RETURNED_NO_ROW');

    const versionValues: NewLeaseReceiptVersion = {
      leaseReceiptId: insertedReceipt.id,
      version: 1,
      status: 'EMISE',
      emittedAt: payload.emittedAt,
      emittedByUserId: payload.emittedByUserId,
      frozenContent: payload.frozenContent,
    };

    const [insertedVersion] = await tx
      .insert(leaseReceiptVersions)
      .values(versionValues)
      .returning();
    if (!insertedVersion) throw new Error('LEASE_RECEIPT_VERSION_INSERT_RETURNED_NO_ROW');

    const [updatedReceipt] = await tx
      .update(leaseReceipts)
      .set({ currentVersionId: insertedVersion.id, updatedAt: new Date() })
      .where(eq(leaseReceipts.id, insertedReceipt.id))
      .returning();
    if (!updatedReceipt) throw new Error('LEASE_RECEIPT_UPDATE_RETURNED_NO_ROW');

    return { receipt: updatedReceipt, version: insertedVersion };
  });
}

/**
 * Invalide une version émise (DEC-058, 5.3 et 5.5). La version reste en
 * base, jamais effacée ni réécrite au-delà de ces quatre colonnes (DEC-020).
 */
export async function invalidateReceiptVersionTx(
  db: ReceivablesDatabase,
  versionId: string,
  reason: string,
  triggerPaymentId: string | null,
): Promise<LeaseReceiptVersion> {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(leaseReceiptVersions)
      .set({
        status: 'INVALIDEE',
        invalidatedAt: new Date(),
        invalidationReason: reason,
        invalidationTriggerPaymentId: triggerPaymentId,
      })
      .where(and(eq(leaseReceiptVersions.id, versionId), eq(leaseReceiptVersions.status, 'EMISE')))
      .returning();

    if (!updated) throw new Error('LEASE_RECEIPT_VERSION_NOT_EMISE_OR_NOT_FOUND');

    return updated;
  });
}
