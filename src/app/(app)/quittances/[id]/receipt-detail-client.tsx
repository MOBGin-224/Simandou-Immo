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
import { formatDate, formatMonth } from '@/lib/ui/format';
import { buildMessengerShareUrl, buildWhatsAppShareUrl } from '@/lib/ui/share-links';
import {
  getReceiptRequest,
  RECEIPT_STATUS_LABELS,
  type ReceiptStatus,
  type ReceiptWithRelations,
} from '@/modules/receipts/client';

type ApiErrorBody = {
  error?: {
    message?: string;
  };
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

const STATUS_TONES: Record<ReceiptStatus, BadgeTone> = {
  EMISE: 'success',
  INVALIDEE: 'neutral',
};

export default function ReceiptDetailClient({
  receiptId,
  appUrl,
}: {
  receiptId: string;
  appUrl: string;
}) {
  const [data, setData] = useState<ReceiptWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadReceipt() {
      try {
        const response = await getReceiptRequest(receiptId);
        const detail = await responseData<ReceiptWithRelations>(
          response,
          'Impossible de charger cette quittance.',
        );

        if (!cancelled) setData(detail);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Impossible de charger cette quittance.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadReceipt();

    return () => {
      cancelled = true;
    };
  }, [receiptId]);

  if (loading) {
    return <p className="py-8 text-center text-sm text-muted">Chargement de la quittance...</p>;
  }

  if (!data) {
    return (
      <div className="flex max-w-xl flex-col gap-6">
        <PageHeader
          title="Détail de la quittance"
          back={{ href: '/quittances', label: 'Retour' }}
        />
        <Alert tone="danger">{errorMessage ?? 'Impossible de charger cette quittance.'}</Alert>
      </div>
    );
  }

  const { receipt, currentVersion } = data;
  const frozenContent = currentVersion?.frozenContent as
    { receivables?: Array<{ kind: 'RENT' | 'CHARGE'; amountDue: number }> } | undefined;
  const receivables = frozenContent?.receivables ?? [];

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <PageHeader title="Détail de la quittance" back={{ href: '/quittances', label: 'Retour' }} />

      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}

      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-3 border-b border-line pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Overline>NUMÉRO DE QUITTANCE</Overline>
            {currentVersion ? (
              <Badge tone={STATUS_TONES[currentVersion.status]}>
                {RECEIPT_STATUS_LABELS[currentVersion.status]}
              </Badge>
            ) : null}
          </div>
          <span className="font-mono text-lg font-bold text-ink">{receipt.referenceNumber}</span>
          <Amount amount={receipt.totalAttested} currency={receipt.currency} scale="hero" />
        </div>

        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Période couverte</dt>
            <dd className="font-medium text-ink">{formatMonth(receipt.periodStart)}</dd>
          </div>
          <div>
            <dt className="text-muted">Locataire</dt>
            <dd className="font-medium text-ink">{data.tenantName}</dd>
          </div>
          <div>
            <dt className="text-muted">Appartement</dt>
            <dd className="font-medium text-ink">{data.apartmentName}</dd>
          </div>
          <div>
            <dt className="text-muted">Immeuble</dt>
            <dd className="font-medium text-ink">{data.propertyName}</dd>
          </div>
          {currentVersion ? (
            <div>
              <dt className="text-muted">Date d&apos;émission</dt>
              <dd className="font-medium text-ink">{formatDate(currentVersion.emittedAt)}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      {currentVersion?.status === 'INVALIDEE' ? (
        <Card className="border-danger/30 bg-danger/5 p-5 sm:p-6">
          <p className="text-sm font-semibold text-danger">Quittance invalidée</p>
          {currentVersion.invalidationReason ? (
            <p className="mt-1 text-sm text-ink">{currentVersion.invalidationReason}</p>
          ) : null}
        </Card>
      ) : null}

      <Card className="flex flex-col gap-4 p-5 sm:p-6">
        <h2 className="font-semibold text-ink">Détail des créances</h2>
        {receivables.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {receivables.map((receivable, index) => (
              <li
                key={index}
                className="flex items-center justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0"
              >
                <span className="font-medium text-ink">
                  {receivable.kind === 'RENT' ? 'Loyer' : 'Charge'}
                </span>
                <Amount amount={receivable.amountDue} currency={receipt.currency} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Aucune créance détaillée.</p>
        )}
      </Card>

      <div className="flex flex-col gap-3">
        <a
          href={`/api/v1/receipts/${encodeURIComponent(receiptId)}/pdf`}
          target="_blank"
          rel="noopener"
          className={cn(buttonClasses('secondary', 'lg', true), 'min-h-14 text-base font-semibold')}
        >
          Télécharger la quittance
        </a>

        {appUrl ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href={buildWhatsAppShareUrl(
                `Vérifiez cette quittance SIMANDOU IMMO: ${appUrl}/verify/${encodeURIComponent(receipt.publicReference)}`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses('secondary', 'md', true)}
            >
              Partager sur WhatsApp
            </a>
            <a
              href={buildMessengerShareUrl(
                `${appUrl}/verify/${encodeURIComponent(receipt.publicReference)}`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses('secondary', 'md', true)}
            >
              Partager sur Messenger
            </a>
          </div>
        ) : null}

        <Link
          href="/quittances"
          className={cn(buttonClasses('secondary', 'lg', true), 'min-h-14 text-base font-semibold')}
        >
          Retour à la liste
        </Link>
      </div>
    </div>
  );
}
