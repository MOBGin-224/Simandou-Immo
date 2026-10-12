'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Amount } from '@/components/ui/amount';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Overline } from '@/components/ui/overline';
import { PageHeader } from '@/components/ui/page-header';
import { formatDate } from '@/lib/ui/format';
import {
  describePaymentMethod,
  getPaymentRequest,
  validatePaymentRequest,
  type PaymentMethod,
  type PaymentStatus,
} from '@/modules/payments/client';

type Payment = {
  id: string;
  organizationId: string;
  propertyId: string;
  apartmentId: string;
  tenantId: string;
  createdBy: string | null;
  referenceNumber: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  paidAt: string;
  reference: string | null;
  status: PaymentStatus;
};

type PaymentAllocation = {
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

const STATUS_TONES: Record<PaymentStatus, 'warning' | 'success' | 'danger' | 'info'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  DISPUTED: 'danger',
  FAILED: 'danger',
  CANCELLED: 'info',
};

export default function ValidatePaymentClient({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
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

        if (!sessionResponse.ok) {
          throw new Error('Impossible de vérifier la session utilisateur.');
        }

        const session = (await sessionResponse.json()) as Session;
        if (!session?.user?.id) {
          throw new Error('Aucune session utilisateur active.');
        }

        if (cancelled) return;

        setPayment(detail.payment);
        setAllocations(detail.allocations);
        setCurrentUserId(session.user.id);

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

  async function handleValidate() {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await validatePaymentRequest(paymentId);
      const validatedPayment = await responseData<Payment>(
        response,
        'Impossible de valider le paiement.',
      );

      setPayment(validatedPayment);
      setConfirming(false);

      try {
        const detailResponse = await getPaymentRequest(paymentId);
        const detail = await responseData<PaymentDetail>(
          detailResponse,
          "Le paiement est confirmé, mais le détail des créances imputées n'a pas pu être chargé.",
        );
        setAllocations(detail.allocations);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Le paiement est confirmé, mais le détail des créances imputées n'a pas pu être chargé.",
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Impossible de valider le paiement.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const isDeclarant = payment?.createdBy === currentUserId;
  const isPending = payment?.status === 'PENDING';
  const actionsDisabled = !isPending || isDeclarant || isSubmitting;

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted">Chargement du paiement...</p>;
  }

  if (!payment) {
    return (
      <div className="flex max-w-xl flex-col gap-6">
        <PageHeader title="Valider un paiement" back={{ href: '/paiements', label: 'Retour' }} />
        <Alert tone="danger">{errorMessage ?? 'Impossible de charger ce paiement.'}</Alert>
      </div>
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <PageHeader
        title={payment.status === 'CONFIRMED' ? 'Paiement confirmé' : 'Vérifier un paiement'}
        description="Vérifiez les informations avant de confirmer cette déclaration."
        back={{ href: `/paiements/${encodeURIComponent(paymentId)}`, label: 'Retour' }}
      />

      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {supplementErrors.map((error) => (
        <Alert key={error} tone="warning">
          {error}
        </Alert>
      ))}
      {!isPending ? (
        <Alert tone="info">Ce paiement est déjà {STATUS_LABELS[payment.status]}.</Alert>
      ) : null}
      {isDeclarant ? (
        <Alert tone="warning">Vous ne pouvez pas valider votre propre déclaration.</Alert>
      ) : null}

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
            <dt className="text-muted">Déclarant</dt>
            <dd className="font-medium text-ink">
              {!payment.createdBy
                ? 'Non renseigné'
                : payment.createdBy === payment.tenantId
                  ? (tenant?.fullName ?? 'Locataire')
                  : payment.createdBy === currentUserId
                    ? 'Vous (gestionnaire ou propriétaire)'
                    : 'Gestionnaire ou propriétaire'}
            </dd>
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
            <div className="sm:col-span-2">
              <dt className="text-muted">Référence de transaction</dt>
              <dd className="font-mono text-ink">{payment.reference}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      {payment.status === 'CONFIRMED' ? (
        <Card className="flex flex-col gap-4 p-5">
          <h2 className="font-semibold text-ink">Créances imputées</h2>
          {allocations.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {allocations.map((allocation) => {
                const receivableId = allocation.rentInstallmentId ?? allocation.chargeAllocationId;
                const kind = allocation.rentInstallmentId ? 'Loyer' : 'Charge';

                return (
                  <li
                    key={receivableId}
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
            <p className="text-sm text-muted">Aucune créance imputée.</p>
          )}
        </Card>
      ) : null}

      <Card className="flex flex-col gap-4 p-5">
        {confirming ? (
          <Alert tone="warning" title="Confirmez-vous la validation?">
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="primary"
                size="lg"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="min-h-14 flex-1"
                onClick={handleValidate}
              >
                {isSubmitting ? 'Validation en cours...' : 'Confirmer'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                disabled={isSubmitting}
                className="min-h-14 flex-1"
                onClick={() => setConfirming(false)}
              >
                Annuler
              </Button>
            </div>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            disabled={actionsDisabled}
            className="min-h-14 text-base font-semibold"
            onClick={() => setConfirming(true)}
          >
            Valider le paiement
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            fullWidth
            disabled={actionsDisabled}
            className="min-h-14 text-base font-semibold"
            onClick={() => {
              router.push(`/paiements/${encodeURIComponent(paymentId)}/contester`);
            }}
          >
            Contester le paiement
          </Button>
        </div>
      </Card>
    </div>
  );
}
