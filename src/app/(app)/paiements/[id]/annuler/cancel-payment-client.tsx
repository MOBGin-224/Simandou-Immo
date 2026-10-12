'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Amount } from '@/components/ui/amount';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Textarea } from '@/components/ui/field';
import { Overline } from '@/components/ui/overline';
import { PageHeader } from '@/components/ui/page-header';
import { formatDate } from '@/lib/ui/format';
import {
  cancelPaymentRequest,
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
  createdBy: string | null;
  referenceNumber: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  paidAt: string;
  reference: string | null;
  status: PaymentStatus;
  cancellationReason?: string | null;
};

type PaymentDetail = {
  payment: Payment;
  allocations: unknown[];
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

export default function CancelPaymentClient({
  paymentId,
  isTenantOnly,
}: {
  paymentId: string;
  isTenantOnly: boolean;
}) {
  const router = useRouter();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [supplementErrors, setSupplementErrors] = useState<string[]>([]);
  const [cancelledReasonSaved, setCancelledReasonSaved] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPayment() {
      try {
        const paymentResponse = await getPaymentRequest(paymentId);
        const detail = await responseData<PaymentDetail>(
          paymentResponse,
          'Impossible de charger ce paiement.',
        );

        if (cancelled) return;

        setPayment(detail.payment);

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

  async function handleCancel() {
    setErrorMessage(null);

    const trimmedReason = reason.trim();
    if (trimmedReason.length < 3) {
      setErrorMessage("Le motif de l'annulation doit contenir au moins 3 caractères.");
      setConfirming(false);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await cancelPaymentRequest(paymentId, trimmedReason);
      const cancelledPayment = await responseData<Payment>(
        response,
        "Impossible d'annuler le paiement.",
      );

      setPayment(cancelledPayment);
      setCancelledReasonSaved(trimmedReason);
      setConfirming(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible d'annuler le paiement.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isCancelled = payment?.status === 'CANCELLED';
  const actionsDisabled = isCancelled || isTenantOnly || isSubmitting;

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted">Chargement du paiement...</p>;
  }

  if (!payment) {
    return (
      <div className="flex max-w-xl flex-col gap-6">
        <PageHeader title="Annuler un paiement" back={{ href: '/paiements', label: 'Retour' }} />
        <Alert tone="danger">{errorMessage ?? 'Impossible de charger ce paiement.'}</Alert>
      </div>
    );
  }

  // Écran de confirmation de succès après annulation
  if (isCancelled && cancelledReasonSaved) {
    return (
      <div className="flex max-w-xl flex-col gap-6">
        <PageHeader
          title="Paiement annulé"
          description="Ce paiement a été annulé avec succès et n'est plus comptabilisé."
          back={{ href: '/paiements', label: 'Retour' }}
        />

        <Card className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex flex-col gap-3 border-b border-line pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Overline>NUMÉRO DE REÇU</Overline>
              <Badge tone="info">Annulé</Badge>
            </div>
            <span className="font-mono text-lg font-bold text-ink">{payment.referenceNumber}</span>
            <Amount amount={payment.amount} currency={payment.currency} scale="hero" />
          </div>

          <div className="flex flex-col gap-1 rounded-md bg-surface-subtle p-3 text-sm">
            <span className="text-muted">Motif de l&apos;annulation :</span>
            <span className="font-medium text-ink">{cancelledReasonSaved}</span>
          </div>

          <Alert tone="info" title="Paiement neutralisé (DEC-020)">
            Le paiement est marqué ANNULÉ dans l&apos;historique. Il n&apos;est plus comptabilisé
            dans les soldes et ses créances ont été restaurées si le paiement était confirmé.
          </Alert>

          <Button
            type="button"
            variant="secondary"
            size="lg"
            fullWidth
            className="min-h-14 text-base font-semibold"
            onClick={() => router.push('/paiements')}
          >
            Retour à la liste des paiements
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <PageHeader
        title="Annuler un paiement"
        description="Annulation d'un règlement manuel."
        back={{ href: `/paiements/${encodeURIComponent(paymentId)}`, label: 'Retour' }}
      />

      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
      {supplementErrors.map((error) => (
        <Alert key={error} tone="warning">
          {error}
        </Alert>
      ))}

      <Alert tone="danger" title="Avertissement">
        Cette action est définitive. Le paiement sera marqué ANNULÉ dans l&apos;historique et ne
        sera plus comptabilisé dans les soldes. Les allocations restent visibles mais neutralisées.
      </Alert>

      {isCancelled ? <Alert tone="info">Ce paiement est déjà annulé.</Alert> : null}
      {isTenantOnly ? (
        <Alert tone="warning">Vous n&apos;êtes pas autorisé à annuler un paiement.</Alert>
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

      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!actionsDisabled) {
              setConfirming(true);
            }
          }}
          className="flex flex-col gap-5"
        >
          <Field
            id="reason"
            label="Motif de l'annulation"
            required
            hint="Indiquez obligatoirement la raison de l'annulation (entre 3 et 1000 caractères)."
          >
            {(attrs) => (
              <Textarea
                {...attrs}
                required
                minLength={3}
                maxLength={1000}
                rows={4}
                disabled={actionsDisabled}
                placeholder="Ex : Erreur de saisie, doublon de quittance..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            )}
          </Field>

          {confirming ? (
            <Alert tone="danger" title="Confirmez-vous l'annulation?">
              <p className="mt-1 text-sm">
                Êtes-vous certain de vouloir annuler ce paiement ? Cette action est irréversible.
              </p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="destructive"
                  size="lg"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="min-h-14 flex-1"
                  onClick={handleCancel}
                >
                  {isSubmitting ? 'Annulation en cours...' : 'Oui, annuler le paiement'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  disabled={isSubmitting}
                  className="min-h-14 flex-1"
                  onClick={() => setConfirming(false)}
                >
                  Non, retour
                </Button>
              </div>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-3">
            <Button
              type="submit"
              variant="destructive"
              size="lg"
              fullWidth
              disabled={actionsDisabled}
              className="min-h-14 text-base font-semibold"
            >
              Annuler le paiement
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              fullWidth
              className="min-h-14 text-base font-semibold"
              onClick={() => router.back()}
            >
              Retour
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
