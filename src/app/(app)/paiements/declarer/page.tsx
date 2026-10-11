'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Amount } from '@/components/ui/amount';
import { Badge } from '@/components/ui/badge';
import { Button, buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { Overline } from '@/components/ui/overline';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/ui/cn';
import { formatDate } from '@/lib/ui/format';
import {
  declarePaymentRequest,
  describePaymentMethod,
  listPaymentsRequest,
  type PaymentMethod,
} from '@/modules/payments/client';

type OutstandingState = {
  totalOutstanding: number;
  currency: string;
};

type DeclaredPaymentSuccess = {
  id: string;
  referenceNumber: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  paidAt: string;
  reference?: string | null;
  status: string;
};

function DeclarePaymentContent() {
  const searchParams = useSearchParams();
  const initialApartmentId =
    searchParams.get('appartement') ?? searchParams.get('apartmentId') ?? '';
  const initialTenantId = searchParams.get('locataire') ?? searchParams.get('tenantId') ?? '';

  const [apartmentId, setApartmentId] = useState(initialApartmentId);
  const [tenantId, setTenantId] = useState(initialTenantId);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('MOBILE_MONEY');
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [proofFileName, setProofFileName] = useState('');

  const [outstanding, setOutstanding] = useState<OutstandingState | null>(null);
  const [loadingOutstanding, setLoadingOutstanding] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | null>(null);
  const [declaredPayment, setDeclaredPayment] = useState<DeclaredPaymentSuccess | null>(null);

  const todayDate = new Date().toISOString().slice(0, 10);

  // 1. Récupération du solde restant dû (API existante /api/v1/me/outstanding)
  useEffect(() => {
    let cancelled = false;

    fetch('/api/v1/me/outstanding')
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (!cancelled && payload?.data) {
          setOutstanding({
            totalOutstanding: Number(payload.data.totalOutstanding ?? 0),
            currency: payload.data.currency ?? 'GNF',
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingOutstanding(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Si apartmentId ou tenantId non fournis, tentative de déduction via GET /api/v1/payments
  useEffect(() => {
    if (initialApartmentId && initialTenantId) return;

    listPaymentsRequest({ page: 1 })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (payload?.data && Array.isArray(payload.data) && payload.data.length > 0) {
          const recent = payload.data[0];
          if (!apartmentId && recent.apartmentId) setApartmentId(recent.apartmentId);
          if (!tenantId && recent.tenantId) setTenantId(recent.tenantId);
        }
      })
      .catch(() => {});
  }, [initialApartmentId, initialTenantId, apartmentId, tenantId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors(null);

    const parsedAmount = parseInt(amount, 10);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setFieldErrors({ amount: ['Veuillez saisir un montant positif supérieur à zéro.'] });
      return;
    }

    if (!apartmentId.trim()) {
      setFieldErrors({ apartmentId: ['Identifiant du logement obligatoire.'] });
      return;
    }

    if (!tenantId.trim()) {
      setFieldErrors({ tenantId: ['Identifiant du locataire obligatoire.'] });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await declarePaymentRequest({
        apartmentId: apartmentId.trim(),
        tenantId: tenantId.trim(),
        amount: parsedAmount,
        method,
        paidAt,
        reference: reference.trim() || undefined,
      });

      const body = await response.json();

      if (!response.ok) {
        if (body?.error?.details) {
          setFieldErrors(body.error.details);
        }
        setErrorMessage(
          body?.error?.message ??
            'Impossible d&apos;enregistrer la déclaration. Veuillez vérifier votre saisie.',
        );
      } else {
        setDeclaredPayment(body.data);
      }
    } catch {
      setErrorMessage('Une erreur réseau est survenue. Veuillez vérifier votre connexion.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectClasses =
    'min-h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink focus:border-action focus:outline-none';

  // Vue de succès / confirmation (DEC-056)
  if (declaredPayment) {
    return (
      <div className="flex max-w-xl flex-col gap-6">
        <PageHeader
          title="Paiement déclaré avec succès"
          description="Votre déclaration a été transmise pour validation croisée."
        />

        <Card className="flex flex-col gap-5 border-success/30 bg-surface p-6">
          <div className="flex items-center justify-between gap-2 border-b border-line pb-4">
            <div className="flex flex-col">
              <Overline>NUMÉRO DE REÇU</Overline>
              <span className="font-mono text-lg font-bold text-ink">
                {declaredPayment.referenceNumber}
              </span>
            </div>
            <Badge tone="warning">En attente de validation</Badge>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted">Montant déclaré</span>
            <Amount
              amount={declaredPayment.amount}
              currency={declaredPayment.currency}
              scale="key"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-md bg-surface-subtle p-3 text-sm sm:grid-cols-2">
            <div>
              <span className="text-muted">Moyen : </span>
              <span className="font-medium text-ink">
                {describePaymentMethod(declaredPayment.method)}
              </span>
            </div>
            <div>
              <span className="text-muted">Date du paiement : </span>
              <span className="font-medium text-ink">{formatDate(declaredPayment.paidAt)}</span>
            </div>
            {declaredPayment.reference ? (
              <div className="sm:col-span-2">
                <span className="text-muted">Référence transaction : </span>
                <span className="font-mono text-ink">{declaredPayment.reference}</span>
              </div>
            ) : null}
          </div>

          <Alert tone="info" title="Validation croisée requise (DEC-056)">
            Votre paiement est en attente de vérification par l&apos;autre partie (délai de 48h).
            Dès qu&apos;il sera validé, vos créances seront imputées automatiquement et votre solde
            restant dû sera déduit.
          </Alert>

          <div className="flex flex-col gap-3 pt-2">
            <Link
              href="/mon-logement"
              className={cn(buttonClasses('primary', 'lg', true), 'min-h-14 font-semibold')}
            >
              Retour à mon logement
            </Link>
            <button
              type="button"
              onClick={() => {
                setDeclaredPayment(null);
                setAmount('');
                setReference('');
                setProofFileName('');
              }}
              className={buttonClasses('secondary', 'md', true)}
            >
              Déclarer un autre paiement
            </button>
          </div>
        </Card>
      </div>
    );
  }

  const needsManualIds = !initialApartmentId || !initialTenantId;

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <PageHeader
        title="Déclarer un paiement"
        description="Signalez un règlement manuel (espèces, Mobile Money, virement bancaire)."
        back={{ href: '/mon-logement', label: 'Retour' }}
      />

      {/* 1. Solde actuel en tête */}
      <Card className="flex flex-col gap-2 p-5">
        <Overline>Total restant dû</Overline>
        {loadingOutstanding ? (
          <p className="text-sm text-muted">Chargement de votre solde...</p>
        ) : outstanding ? (
          <>
            <Amount
              amount={outstanding.totalOutstanding}
              currency={outstanding.currency}
              scale="hero"
            />
            {outstanding.totalOutstanding > 0 ? (
              <p className="text-xs text-muted">
                Tout versement validé réduira automatiquement vos dettes les plus anciennes (loyers
                puis charges).
              </p>
            ) : (
              <p className="text-xs text-success font-medium">
                Vous n&apos;avez aucun impayé en cours.
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-muted">Solde non disponible.</p>
        )}
      </Card>

      {/* 2. Formulaire de déclaration */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}

        {/* Montant */}
        <Field
          id="amount"
          label="Montant du paiement"
          required
          errors={fieldErrors?.amount}
          hint="Montant en Francs Guinéens (GNF). Ne peut pas dépasser le total dû."
        >
          {(attrs) => (
            <Input
              {...attrs}
              type="number"
              min="1"
              step="1"
              required
              placeholder="Ex : 500000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          )}
        </Field>

        {/* Moyen de paiement */}
        <Field
          id="method"
          label="Moyen de paiement"
          required
          errors={fieldErrors?.method}
          hint="Mode par lequel le versement a été effectué."
        >
          {({ id, 'aria-describedby': describedBy, 'aria-invalid': isInvalid }) => (
            <select
              id={id}
              aria-describedby={describedBy}
              aria-invalid={isInvalid}
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className={selectClasses}
            >
              <option value="MOBILE_MONEY">Mobile Money (Orange Money, MTN MoMo)</option>
              <option value="CASH">Espèces (remise en main propre)</option>
              <option value="BANK_TRANSFER">Virement bancaire</option>
              <option value="OTHER">Chèque / Autre moyen</option>
            </select>
          )}
        </Field>

        {/* Date du paiement */}
        <Field
          id="paidAt"
          label="Date du paiement"
          required
          errors={fieldErrors?.paidAt}
          hint="Date réelle du règlement (les dates dans le futur sont rejetées)."
        >
          {(attrs) => (
            <Input
              {...attrs}
              type="date"
              max={todayDate}
              required
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          )}
        </Field>

        {/* Référence (facultative) */}
        <Field
          id="reference"
          label="Référence de la transaction"
          errors={fieldErrors?.reference}
          hint="Numéro d'opération Mobile Money, référence bancaire ou numéro de chèque."
        >
          {(attrs) => (
            <Input
              {...attrs}
              type="text"
              maxLength={255}
              placeholder="Ex : MP261011.1402 ou VIR-8392"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          )}
        </Field>

        {/* Justificatif / Preuve (upload facultatif) */}
        <Field
          id="proof"
          label="Justificatif ou reçu"
          hint="Photo de reçu ou capture Mobile Money (JPG, PNG ou PDF, 5 Mo max). Stockage effectif à venir (DEC-033)."
        >
          {(attrs) => (
            <div className="flex flex-col gap-1.5">
              <Input
                {...attrs}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setProofFileName(file ? file.name : '');
                }}
              />
              {proofFileName ? (
                <span className="text-xs text-muted">Pièce sélectionnée : {proofFileName}</span>
              ) : null}
            </div>
          )}
        </Field>

        {/* Logement et Locataire (visibles si non fournis dans l'URL) */}
        {needsManualIds ? (
          <div className="rounded-md border border-line bg-surface-subtle p-3 flex flex-col gap-4">
            <Field
              id="apartmentId"
              label="Identifiant du logement"
              required
              errors={fieldErrors?.apartmentId}
              hint="Identifiant technique unique du logement concerné."
            >
              {(attrs) => (
                <Input
                  {...attrs}
                  type="text"
                  required
                  placeholder="UUID de l'appartement"
                  value={apartmentId}
                  onChange={(e) => setApartmentId(e.target.value)}
                />
              )}
            </Field>

            <Field
              id="tenantId"
              label="Identifiant du locataire"
              required
              errors={fieldErrors?.tenantId}
              hint="Identifiant technique de la personne locataire."
            >
              {(attrs) => (
                <Input
                  {...attrs}
                  type="text"
                  required
                  placeholder="UUID du locataire"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                />
              )}
            </Field>
          </div>
        ) : (
          <>
            <input type="hidden" name="apartmentId" value={apartmentId} />
            <input type="hidden" name="tenantId" value={tenantId} />
          </>
        )}

        {/* Bouton de déclaration mobile first (56px min) */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="min-h-14 text-base font-semibold"
        >
          {isSubmitting ? 'Déclaration en cours...' : 'Déclarer le paiement'}
        </Button>
      </form>
    </div>
  );
}

export default function DeclarePaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="py-8 text-center text-sm text-muted">Chargement du formulaire...</div>
      }
    >
      <DeclarePaymentContent />
    </Suspense>
  );
}
