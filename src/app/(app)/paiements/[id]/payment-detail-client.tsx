'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Amount } from '@/components/ui/amount';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Overline } from '@/components/ui/overline';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/ui/cn';
import { formatDate } from '@/lib/ui/format';
import {
  describePaymentMethod,
  getPaymentRequest,
  type PaymentMethod,
  type PaymentStatus,
} from '@/modules/payments/client';

type Payment = {
  id: string;
  organizationId: string;
  propertyId: string;
  apartmentId: string;
  tenantId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  reference: string | null;
  status: PaymentStatus;
  paidAt: string;
  declaredAt: string;
  referenceNumber: string;
  createdBy: string | null;
  validatedByUserId: string | null;
  validatedAt: string | null;
  disputedByUserId: string | null;
  disputedAt: string | null;
  disputeReason: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
};

type PaymentAllocation = {
  id: string;
  rentInstallmentId: string | null;
  chargeAllocationId: string | null;
  amount: number;
  currency: string;
};

type PaymentDetail = {
  payment: Payment;
  allocations: PaymentAllocation[];
};

type ApiErrorBody = {
  error?: {
    message?: string;
  };
};

type Tenant = {
  fullName: string;
};

type Apartment = {
  number: string;
};

type Property = {
  name: string;
};

type Session = {
  user?: {
    id?: string;
  } | null;
} | null;

function apiMessage(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const error = (body as ApiErrorBody).error;
    if (typeof error?.message === 'string') return error.message;
  }

  return fallback;
}

async function responseData<T>(response: Response, fallback: string): Promise<T> {
  const body: unknown = await response.json();
  if (!response.ok) throw new Error(apiMessage(body, fallback));

  if (typeof body !== 'object' || body === null || !('data' in body)) {
    throw new Error('La réponse du serveur est invalide.');
  }

  return body.data as T;
}

async function loadSupplement<T>(
  url: string,
  fallback: string,
): Promise<{ value: T | null; error: string | null }> {
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    return { value: await responseData<T>(response, fallback), error: null };
  } catch (error) {
    return {
      value: null,
      error: error instanceof Error ? error.message : fallback,
    };
  }
}

const STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'En attente de validation',
  CONFIRMED: 'Confirmé',
  DISPUTED: 'Contesté',
  FAILED: 'Échoué',
  CANCELLED: 'Annulé',
};

const STATUS_TONES: Record<PaymentStatus, BadgeTone> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  DISPUTED: 'danger',
  FAILED: 'danger',
  CANCELLED: 'neutral',
};

export default function PaymentDetailClient({
  paymentId,
  isOwnerOrManager,
}: {
  paymentId: string;
  isOwnerOrManager: boolean;
}) {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [supplementErrors, setSupplementErrors] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadPayment() {
      try {
        const [paymentResponse, sessionResponse] = await Promise.all([
          getPaymentRequest(paymentId),
          fetch('/api/auth/get-session', { headers: { Accept: 'application/json' } }),
        ]);
        const detail = await responseData<PaymentDetail>(
          paymentResponse,
          'Impossible de charger ce paiement.',
        );

        const session = sessionResponse.ok ? ((await sessionResponse.json()) as Session) : null;

        if (cancelled) return;

        setPayment(detail.payment);
        setAllocations(detail.allocations);
        setCurrentUserId(session?.user?.id ?? null);

        const [tenantResult, apartmentResult] = await Promise.all([
          loadSupplement<Tenant>(
            `/api/v1/tenants/${encodeURIComponent(detail.payment.tenantId)}?organizationId=${encodeURIComponent(detail.payment.organizationId)}`,
            'Impossible de charger le locataire.',
          ),
          loadSupplement<Apartment>(
            `/api/v1/apartments/${encodeURIComponent(detail.payment.apartmentId)}`,
            'Impossible de charger le logement.',
          ),
        ]);

        let propertyResult: { value: Property | null; error: string | null } = {
          value: null,
          error: null,
        };
        if (apartmentResult.value) {
          propertyResult = await loadSupplement<Property>(
            `/api/v1/properties/${encodeURIComponent(detail.payment.propertyId)}`,
            "Impossible de charger l'immeuble.",
          );
        }

        if (cancelled) return;
        setTenant(tenantResult.value);
        setApartment(apartmentResult.value);
        setProperty(propertyResult.value);
        setSupplementErrors(
          [tenantResult.error, apartmentResult.error, propertyResult.error].filter(
            (error): error is string => error !== null,
          ),
        );
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Impossible de charger ce paiement.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPayment();

    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted">Chargement du paiement...</p>;
  }

  if (!payment) {
    return (
      <div className="flex max-w-xl flex-col gap-6">
        <PageHeader title="Détail du paiement" back={{ href: '/paiements', label: 'Retour' }} />
        <Alert tone="danger">{errorMessage ?? 'Impossible de charger ce paiement.'}</Alert>
      </div>
    );
  }

  function describePerson(userId: string | null, you: string, other: string): string {
    if (!userId) return 'Non renseigné';
    if (userId === payment!.tenantId) return tenant?.fullName ?? 'Locataire';
    if (userId === currentUserId) return you;
    return other;
  }

  const isDeclarant = payment.createdBy !== null && payment.createdBy === currentUserId;
  const canValidateOrDispute = payment.status === 'PENDING' && !isDeclarant;
  const canCancel =
    isOwnerOrManager &&
    (payment.status === 'PENDING' ||
      payment.status === 'CONFIRMED' ||
      payment.status === 'DISPUTED');

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <PageHeader title="Détail du paiement" back={{ href: '/paiements', label: 'Retour' }} />

      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {supplementErrors.map((error) => (
        <Alert key={error} tone="warning">
          {error}
        </Alert>
      ))}

      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-3 border-b border-line pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Overline>NUMÉRO DE REÇU</Overline>
            <Badge tone={STATUS_TONES[payment.status]}>{STATUS_LABELS[payment.status]}</Badge>
          </div>
          <span className="font-mono text-lg font-bold text-ink">{payment.referenceNumber}</span>
          <Amount amount={payment.amount} currency={payment.currency} scale="hero" />
        </div>

        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Locataire</dt>
            <dd className="font-medium text-ink">{tenant?.fullName ?? payment.tenantId}</dd>
          </div>
          <div>
            <dt className="text-muted">Appartement</dt>
            <dd className="font-medium text-ink">{apartment?.number ?? payment.apartmentId}</dd>
          </div>
          <div>
            <dt className="text-muted">Immeuble</dt>
            <dd className="font-medium text-ink">{property?.name ?? payment.propertyId}</dd>
          </div>
          <div>
            <dt className="text-muted">Moyen de paiement</dt>
            <dd className="font-medium text-ink">{describePaymentMethod(payment.method)}</dd>
          </div>
          <div>
            <dt className="text-muted">Date du paiement</dt>
            <dd className="font-medium text-ink">{formatDate(payment.paidAt)}</dd>
          </div>
          {payment.reference ? (
            <div>
              <dt className="text-muted">Référence de transaction</dt>
              <dd className="font-mono text-ink">{payment.reference}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <Card className="flex flex-col gap-4 p-5 sm:p-6">
        <h2 className="font-semibold text-ink">Suivi de la déclaration</h2>

        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Déclarant</dt>
            <dd className="font-medium text-ink">
              {describePerson(payment.createdBy, 'Vous', 'Gestionnaire ou propriétaire')}
            </dd>
            <dd className="text-xs text-muted">{formatDate(payment.declaredAt)}</dd>
          </div>

          {payment.validatedByUserId ? (
            <div>
              <dt className="text-muted">Validateur</dt>
              <dd className="font-medium text-ink">
                {describePerson(payment.validatedByUserId, 'Vous', 'Gestionnaire ou propriétaire')}
              </dd>
              {payment.validatedAt ? (
                <dd className="text-xs text-muted">{formatDate(payment.validatedAt)}</dd>
              ) : null}
            </div>
          ) : null}

          {payment.status === 'DISPUTED' ? (
            <div className="sm:col-span-2">
              <dt className="text-muted">Contestataire</dt>
              <dd className="font-medium text-ink">
                {describePerson(payment.disputedByUserId, 'Vous', 'Gestionnaire ou propriétaire')}
              </dd>
              {payment.disputedAt ? (
                <dd className="text-xs text-muted">{formatDate(payment.disputedAt)}</dd>
              ) : null}
              {payment.disputeReason ? (
                <dd className="mt-1 rounded-md bg-surface-subtle p-3 text-sm text-ink">
                  {payment.disputeReason}
                </dd>
              ) : null}
            </div>
          ) : null}

          {payment.status === 'CANCELLED' ? (
            <div className="sm:col-span-2">
              <dt className="text-muted">Annulation</dt>
              {payment.cancelledAt ? (
                <dd className="text-xs text-muted">{formatDate(payment.cancelledAt)}</dd>
              ) : null}
              {payment.cancellationReason ? (
                <dd className="mt-1 rounded-md bg-surface-subtle p-3 text-sm text-ink">
                  {payment.cancellationReason}
                </dd>
              ) : null}
            </div>
          ) : null}
        </dl>
      </Card>

      <Card className="flex flex-col gap-4 p-5 sm:p-6">
        <h2 className="font-semibold text-ink">Créances imputées</h2>
        {allocations.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {allocations.map((allocation) => {
              const receivableId = allocation.rentInstallmentId ?? allocation.chargeAllocationId;
              const kind = allocation.rentInstallmentId ? 'Loyer' : 'Charge';

              return (
                <li
                  key={allocation.id}
                  className="flex flex-col gap-1 border-b border-line pb-3 last:border-0 last:pb-0"
                >
                  <span className="font-medium text-ink">
                    {kind} · créance {receivableId}
                  </span>
                  <Amount amount={allocation.amount} currency={allocation.currency} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">Aucune créance imputée pour le moment.</p>
        )}
      </Card>

      <div className="flex flex-col gap-3">
        {canValidateOrDispute ? (
          <>
            <Link
              href={`/paiements/${encodeURIComponent(paymentId)}/valider`}
              className={cn(
                buttonClasses('primary', 'lg', true),
                'min-h-14 text-base font-semibold',
              )}
            >
              Valider le paiement
            </Link>
            <Link
              href={`/paiements/${encodeURIComponent(paymentId)}/contester`}
              className={cn(
                buttonClasses('secondary', 'lg', true),
                'min-h-14 text-base font-semibold',
              )}
            >
              Contester le paiement
            </Link>
          </>
        ) : null}

        {payment.status === 'CONFIRMED' || payment.status === 'CANCELLED' ? (
          <a
            href={`/api/v1/payments/${encodeURIComponent(paymentId)}/receipt`}
            target="_blank"
            rel="noopener"
            className={cn(
              buttonClasses('secondary', 'lg', true),
              'min-h-14 text-base font-semibold',
            )}
          >
            Télécharger le reçu
          </a>
        ) : null}

        {canCancel ? (
          <Link
            href={`/paiements/${encodeURIComponent(paymentId)}/annuler`}
            className={cn(
              buttonClasses('destructive', 'lg', true),
              'min-h-14 text-base font-semibold',
            )}
          >
            Annuler le paiement
          </Link>
        ) : null}

        <Link
          href="/paiements"
          className={cn(buttonClasses('secondary', 'lg', true), 'min-h-14 text-base font-semibold')}
        >
          Retour à la liste
        </Link>
      </div>
    </div>
  );
}
