/**
 * Surface du module Paiements réservée à l'interface client.
 *
 * Ce fichier ne réexporte QUE des constantes, des types et des fonctions
 * utilisables côté navigateur, sans charger de dépendance serveur ni de base
 * de données.
 */
import type { PaymentMethod, PaymentStatus } from './constants';
export { PAYMENT_METHODS, PAYMENT_STATUSES } from './constants';
export type { PaymentMethod, PaymentStatus } from './constants';

export type DeclarePaymentInput = {
  apartmentId: string;
  tenantId: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  reference?: string;
};

export type ListPaymentsFilters = {
  page?: number;
  status?: PaymentStatus;
  apartmentId?: string;
  tenantId?: string;
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  BANK_TRANSFER: 'Virement bancaire',
  OTHER: 'Chèque / Autre',
};

export function describePaymentMethod(method: PaymentMethod): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

/**
 * Appelle l'API POST /api/v1/payments/manual pour déclarer un paiement manuel (DEC-056).
 */
export async function declarePaymentRequest(input: DeclarePaymentInput): Promise<Response> {
  return fetch('/api/v1/payments/manual', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  });
}

/**
 * Appelle l'API GET /api/v1/payments pour lister les paiements avec filtres.
 */
export async function listPaymentsRequest(filters: ListPaymentsFilters = {}): Promise<Response> {
  const params = new URLSearchParams();

  if (filters.page !== undefined) params.set('page', String(filters.page));
  if (filters.status) params.set('status', filters.status);
  if (filters.apartmentId) params.set('apartmentId', filters.apartmentId);
  if (filters.tenantId) params.set('tenantId', filters.tenantId);

  const query = params.toString();
  const url = query ? `/api/v1/payments?${query}` : '/api/v1/payments';

  return fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });
}

/** Appelle l'API GET /api/v1/payments/[id] pour consulter un paiement. */
export async function getPaymentRequest(paymentId: string): Promise<Response> {
  return fetch(`/api/v1/payments/${encodeURIComponent(paymentId)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });
}

/** Appelle l'API POST /api/v1/payments/[id]/validate pour valider un paiement. */
export async function validatePaymentRequest(paymentId: string): Promise<Response> {
  return fetch(`/api/v1/payments/${encodeURIComponent(paymentId)}/validate`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
  });
}

export type DisputeCategory = 'NOT_PAID' | 'WRONG_AMOUNT' | 'WRONG_DATE' | 'WRONG_PERSON' | 'OTHER';

export const DISPUTE_CATEGORY_LABELS: Record<DisputeCategory, string> = {
  NOT_PAID: "Je n'ai pas reçu ce paiement",
  WRONG_AMOUNT: 'Le montant est incorrect',
  WRONG_DATE: 'La date est incorrecte',
  WRONG_PERSON: 'Le destinataire est incorrect',
  OTHER: 'Autre motif',
};

export async function disputePaymentRequest(
  paymentId: string,
  category: DisputeCategory,
  reason: string,
): Promise<Response> {
  return fetch(`/api/v1/payments/${encodeURIComponent(paymentId)}/dispute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ category, reason }),
  });
}

/** Appelle l'API POST /api/v1/payments/[id]/cancel pour annuler un paiement. */
export async function cancelPaymentRequest(paymentId: string, reason: string): Promise<Response> {
  return fetch(`/api/v1/payments/${encodeURIComponent(paymentId)}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ reason }),
  });
}
