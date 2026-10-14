/**
 * Surface du module Quittances réservée à l'interface client (DEC-058).
 *
 * Ce fichier ne réexporte QUE des constantes, des types et des fonctions
 * utilisables côté navigateur, sans charger de dépendance serveur ni de base
 * de données. Même principe que `src/modules/payments/client.ts`.
 */

export type ReceiptStatus = 'EMISE' | 'INVALIDEE';

export type ReceiptVersionItem = {
  id: string;
  version: number;
  status: ReceiptStatus;
  emittedAt: string;
  invalidatedAt: string | null;
  invalidationReason: string | null;
  frozenContent: unknown;
};

export type ReceiptItem = {
  id: string;
  leaseId: string;
  propertyId: string;
  apartmentId: string;
  tenantUserId: string;
  periodStart: string;
  referenceNumber: string;
  publicReference: string;
  totalAttested: number;
  currency: string;
};

export type ReceiptWithRelations = {
  receipt: ReceiptItem;
  currentVersion: ReceiptVersionItem | null;
  tenantName: string;
  apartmentName: string;
  propertyName: string;
  organizationName: string;
};

export type ListReceiptsFilters = {
  page?: number;
  status?: ReceiptStatus;
  propertyId?: string;
  tenantId?: string;
  period?: string;
};

export const RECEIPT_STATUS_LABELS: Record<ReceiptStatus, string> = {
  EMISE: 'Émise',
  INVALIDEE: 'Invalidée',
};

/** Appelle l'API GET /api/v1/receipts pour lister les quittances avec filtres. */
export async function listReceiptsRequest(filters: ListReceiptsFilters = {}): Promise<Response> {
  const params = new URLSearchParams();

  if (filters.page !== undefined) params.set('page', String(filters.page));
  if (filters.status) params.set('status', filters.status);
  if (filters.propertyId) params.set('propertyId', filters.propertyId);
  if (filters.tenantId) params.set('tenantId', filters.tenantId);
  if (filters.period) params.set('period', filters.period);

  const query = params.toString();
  const url = query ? `/api/v1/receipts?${query}` : '/api/v1/receipts';

  return fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
}

/** Appelle l'API GET /api/v1/receipts/[id] pour consulter une quittance. */
export async function getReceiptRequest(receiptId: string): Promise<Response> {
  return fetch(`/api/v1/receipts/${encodeURIComponent(receiptId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
}
