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
  describePaymentMethod,
  disputePaymentRequest,
  getPaymentRequest,
  type DisputeCategory,
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

const selectClasses =
  'min-h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink focus:border-action focus:outline-none';

export default function DisputePaymentClient({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<DisputeCategory>('NOT_PAID');
  const [details, setDetails] = useState('');
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

  async function handleDispute() {
    setErrorMessage(null);
    setIsSubmitting(true);

    const reason = details.trim() ? details.trim() : category;

    try {
      const response = await disputePaymentRequest(paymentId, category, reason);
      const disputedPayment = await responseData<Payment>(
        response,
        'Impossible de contester le paiement.',
      );

      setPayment(disputedPayment);
      setConfirming(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Impossible de contester le paiement.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const isDeclarant = payment?.createdBy === currentUserId;
  const isPending = payment?.status === 'PENDING';
  const isDisputed = payment?.status === 'DISPUTED';
  const actionsDisabled = !isPending || isDeclarant || isSubmitting;

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted">Chargement du paiement...</p>;
  }

  if (!payment) {
    return (
      <div className="flex max-w-xl flex-col gap-6">
        <PageHeader
          title="Contester un paiement"
          back={{ href: '/mon-logement', label: 'Retour' }}
        />
        <Alert tone="danger">{errorMessage ?? 'Impossible de charger ce paiement.'}</Alert>
      </div>
    );
  }

  // Écran de confirmation de succès après contestation
  if (isDisputed) {
    return (
      <div className="flex max-w-xl flex-col gap-6">
        <PageHeader
          title="Paiement contesté"
          description="Cette déclaration a été contestée et n'est pas comptabilisée."
          back={{ href: '/mon-logement', label: 'Retour' }}
        />

        <Card className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex flex-col gap-3 border-b border-line pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Overline>NUMÉRO DE REÇU</Overline>
              <Badge tone="danger">Contesté</Badge>
            </div>
            <span className="font-mono text-lg font-bold text-ink">{payment.referenceNumber}</span>
            <Amount amount={payment.amount} currency={payment.currency} scale="hero" />
          </div>

          <Alert tone="warning" title="Paiement non comptabilisé">
            Ce paiement a été marqué comme contesté. Il n&apos;est plus comptabilisé dans les soldes
            et aucune créance ne lui est imputée.
          </Alert>

          <Button
            type="button"
            variant="secondary"
            size="lg"
            fullWidth
            className="min-h-14 text-base font-semibold"
            onClick={() => router.push('/mon-logement')}
          >
            Retour
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <PageHeader
        title="Contester un paiement"
        description="Signalez une contestation concernant ce règlement."
        back={{ href: `/paiements/${encodeURIComponent(paymentId)}/valider`, label: 'Retour' }}
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
        <Alert tone="warning">Vous ne pouvez pas contester votre propre déclaration.</Alert>
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
            id="category"
            label="Motif de la contestation"
            required
            hint="Indiquez la raison principale pour laquelle vous contestez ce paiement."
          >
            {({ id, 'aria-describedby': describedBy, 'aria-invalid': isInvalid }) => (
              <select
                id={id}
                aria-describedby={describedBy}
                aria-invalid={isInvalid}
                value={category}
                disabled={actionsDisabled}
                onChange={(e) => setCategory(e.target.value as DisputeCategory)}
                className={selectClasses}
                required
              >
                <option value="NOT_PAID">Je n&apos;ai pas reçu ce paiement</option>
                <option value="WRONG_AMOUNT">Le montant est incorrect</option>
                <option value="WRONG_DATE">La date est incorrecte</option>
                <option value="WRONG_PERSON">Le destinataire est incorrect</option>
                <option value="OTHER">Autre motif</option>
              </select>
            )}
          </Field>

          <Field
            id="details"
            label="Détails"
            hint="Précisez tout élément utile pour expliquer la contestation (1000 caractères max)."
          >
            {(attrs) => (
              <Textarea
                {...attrs}
                maxLength={1000}
                rows={4}
                disabled={actionsDisabled}
                placeholder="Précisez votre motif si nécessaire..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            )}
          </Field>

          {confirming ? (
            <Alert
              tone="warning"
              title="Confirmez-vous la contestation? Cette action rendra le paiement non comptabilisé."
            >
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="min-h-14 flex-1"
                  onClick={handleDispute}
                >
                  {isSubmitting ? 'Contestation en cours...' : 'Confirmer'}
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
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={actionsDisabled}
              className="min-h-14 text-base font-semibold"
            >
              Confirmer la contestation
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
