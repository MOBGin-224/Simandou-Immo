import { headers } from 'next/headers';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Amount } from '@/components/ui/amount';
import { getDb } from '@/db/client';
import { clientIpFromHeaders, isRateLimited } from '@/lib/http/rate-limit';
import { formatDate } from '@/lib/ui/format';
import { getPublicVerification } from '@/modules/payments';
import type { PublicVerificationData } from '@/modules/payments';

const PUBLIC_REFERENCE_PATTERN = /^R-[0-9A-Za-z]{10}$/;

const PAYMENT_STATUS_LABELS: Record<PublicVerificationData['paymentStatus'], string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmé',
  DISPUTED: 'Contesté',
  CANCELLED: 'Annulé',
};

const PAYMENT_STATUS_TONES: Record<PublicVerificationData['paymentStatus'], BadgeTone> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  DISPUTED: 'warning',
  CANCELLED: 'neutral',
};

const DOCUMENT_STATUS_TONES: Record<PublicVerificationData['documentStatus'], BadgeTone> = {
  actif: 'success',
  remplacé: 'warning',
  invalidé: 'neutral',
};

const NEUTRAL_MESSAGE =
  'Vérification impossible. Vérifiez la référence du document ou contactez le gestionnaire.';

export default async function PublicReceiptVerificationPage({
  params,
}: PageProps<'/verify/[publicReference]'>) {
  const { publicReference } = await params;
  const requestHeaders = await headers();
  const isRateLimitedRequest = isRateLimited(clientIpFromHeaders(requestHeaders));
  const data =
    !isRateLimitedRequest && PUBLIC_REFERENCE_PATTERN.test(publicReference)
      ? await getPublicVerification(getDb(), publicReference)
      : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-1 items-center justify-center px-4 py-8">
      <section className="w-full rounded-card border border-line bg-surface p-5 shadow-sm sm:p-8">
        {data ? (
          <>
            <div className="mb-6">
              <p className="text-xs font-bold tracking-[0.16em] text-muted">SIMANDOU IMMO</p>
              <h1 className="mt-2 font-display text-h3 font-bold text-ink">Reçu vérifié</h1>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone={PAYMENT_STATUS_TONES[data.paymentStatus]}>
                  Paiement {PAYMENT_STATUS_LABELS[data.paymentStatus]}
                </Badge>
                <Badge tone={DOCUMENT_STATUS_TONES[data.documentStatus]}>
                  Document {data.documentStatus}
                </Badge>
              </div>
            </div>

            <div className="border-y border-line py-6 text-center">
              <Amount amount={data.amount} currency={data.currency} scale="hero" />
              <p className="mt-2 text-sm text-muted">Devise : {data.currency}</p>
            </div>

            <dl className="divide-y divide-line">
              <VerificationDetail label="Date du paiement" value={formatDate(data.paidAt)} />
              {data.validatedAt ? (
                <VerificationDetail
                  label="Date de validation"
                  value={formatDate(data.validatedAt)}
                />
              ) : null}
              <VerificationDetail label="Version du reçu" value={`N° ${data.version}`} />
              <VerificationDetail
                label="Date de vérification"
                value={formatDate(data.verifiedAt)}
              />
            </dl>

            <p className="mt-6 text-xs leading-5 text-muted">
              Cette vérification atteste la présence du reçu dans SIMANDOU IMMO. Elle ne confirme
              pas un mouvement d&apos;argent chez un opérateur ou une banque.
            </p>
          </>
        ) : (
          <p className="text-sm leading-6 text-ink">{NEUTRAL_MESSAGE}</p>
        )}
      </section>
    </main>
  );
}

function VerificationDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}
