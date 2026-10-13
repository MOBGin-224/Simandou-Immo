'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Amount } from '@/components/ui/amount';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button, buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/ui/cn';
import { formatDate, pluralize } from '@/lib/ui/format';
import {
  describePaymentMethod,
  listPaymentsRequest,
  type PaymentItem,
  type PaymentStatus,
} from '@/modules/payments/client';

type ListMeta = {
  total: number;
  page: number;
  pageSize: number;
  pageCount?: number;
};

type FilterTab = {
  value: PaymentStatus | 'ALL';
  label: string;
};

const FILTER_TABS: FilterTab[] = [
  { value: 'ALL', label: 'Tous' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'CONFIRMED', label: 'Confirmés' },
  { value: 'DISPUTED', label: 'Contestés' },
  { value: 'CANCELLED', label: 'Annulés' },
];

const STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'En attente',
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

const EMPTY_BY_FILTER: Record<PaymentStatus | 'ALL', { title: string; description: string }> = {
  ALL: {
    title: 'Aucun paiement',
    description: 'Aucun paiement manuel n&apos;a encore été enregistré sur votre périmètre.',
  },
  PENDING: {
    title: 'Aucun paiement en attente',
    description:
      'Tous les paiements déclarés ont été traités ou aucun paiement n&apos;est en attente.',
  },
  CONFIRMED: {
    title: 'Aucun paiement confirmé',
    description: 'Les paiements validés et imputés apparaîtront ici.',
  },
  DISPUTED: {
    title: 'Aucun paiement contesté',
    description: 'Aucune déclaration de paiement n&apos;a été contestée.',
  },
  CANCELLED: {
    title: 'Aucun paiement annulé',
    description: 'Les paiements annulés restent consultables ici.',
  },
  FAILED: {
    title: 'Aucun paiement échoué',
    description: 'Aucun paiement n&apos;est en échec.',
  },
};

export default function PaymentsListClient({ canDeclare }: { canDeclare: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const statusParam = searchParams.get('status');
  const pageParam = searchParams.get('page');

  const currentStatus: PaymentStatus | 'ALL' =
    statusParam && ['PENDING', 'CONFIRMED', 'DISPUTED', 'CANCELLED'].includes(statusParam)
      ? (statusParam as PaymentStatus)
      : 'ALL';

  const currentPage = pageParam && Number(pageParam) > 0 ? parseInt(pageParam, 10) : 1;

  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [meta, setMeta] = useState<ListMeta>({ total: 0, page: 1, pageSize: 20, pageCount: 1 });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const response = await listPaymentsRequest({
          page: currentPage,
          status: currentStatus === 'ALL' ? undefined : currentStatus,
        });

        if (!response.ok) {
          throw new Error('Impossible de charger la liste des paiements.');
        }

        const body = (await response.json()) as {
          data: PaymentItem[];
          meta: { total: number; page: number; pageSize: number };
        };

        if (cancelled) return;

        const total = body.meta.total ?? 0;
        const pageSize = body.meta.pageSize || 20;
        const pageCount = Math.max(1, Math.ceil(total / pageSize));

        setPayments(body.data ?? []);
        setMeta({
          total,
          page: body.meta.page ?? 1,
          pageSize,
          pageCount,
        });
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Impossible de charger la liste des paiements.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [currentStatus, currentPage]);

  function changeFilter(status: PaymentStatus | 'ALL') {
    const params = new URLSearchParams(searchParams.toString());
    if (status === 'ALL') {
      params.delete('status');
    } else {
      params.set('status', status);
    }
    params.delete('page');

    const query = params.toString();
    router.push(query ? `/paiements?${query}` : '/paiements');
  }

  function changePage(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage <= 1) {
      params.delete('page');
    } else {
      params.set('page', String(newPage));
    }

    const query = params.toString();
    router.push(query ? `/paiements?${query}` : '/paiements');
  }

  const empty = EMPTY_BY_FILTER[currentStatus];
  const pageCount = meta.pageCount ?? 1;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Paiements"
        description={
          loading
            ? 'Chargement des paiements...'
            : meta.total === 0
              ? 'Les règlements enregistrés apparaîtront ici.'
              : pluralize(meta.total, 'paiement')
        }
        actions={
          canDeclare ? (
            <Link
              href="/locataires"
              className={cn(buttonClasses('primary', 'md'), 'min-h-11 font-medium')}
            >
              Déclarer un paiement
            </Link>
          ) : undefined
        }
      />

      {/* Filtres par statut */}
      <nav aria-label="Filtrer les paiements" className="flex flex-wrap gap-1">
        {FILTER_TABS.map((tab) => {
          const isActive = currentStatus === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => changeFilter(tab.value)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors',
                isActive ? 'bg-brand text-white' : 'text-muted hover:bg-surface hover:text-ink',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {errorMessage ? (
        <Card className="border-danger/30 p-5 text-sm text-danger">{errorMessage}</Card>
      ) : null}

      {/* Contenu principal */}
      {loading ? (
        <p className="py-8 text-center text-sm text-muted">Chargement des paiements...</p>
      ) : payments.length === 0 ? (
        <EmptyState
          title={empty.title}
          description={empty.description}
          action={
            canDeclare ? (
              <Link
                href="/locataires"
                className={cn(buttonClasses('primary', 'md'), 'font-medium')}
              >
                Déclarer un paiement
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {payments.map((payment) => (
            <li key={payment.id}>
              <Link
                href={`/paiements/${encodeURIComponent(payment.id)}`}
                className="block transition-transform active:scale-[0.99]"
              >
                <Card className="flex flex-col gap-3 p-4 sm:p-5 hover:border-action">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                    <span className="font-mono text-sm font-bold text-ink">
                      {payment.referenceNumber}
                    </span>
                    <Badge tone={STATUS_TONES[payment.status]}>
                      {STATUS_LABELS[payment.status]}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Amount amount={payment.amount} currency={payment.currency} scale="key" />
                    <span className="text-xs text-muted">
                      {describePaymentMethod(payment.method)} · {formatDate(payment.paidAt)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-1 text-xs text-muted sm:grid-cols-2">
                    <div>
                      <span>Locataire : </span>
                      <span className="font-mono text-ink">{payment.tenantId}</span>
                    </div>
                    <div>
                      <span>Logement : </span>
                      <span className="font-mono text-ink">{payment.apartmentId}</span>
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Pagination mobile-first (56px min) */}
      {!loading && pageCount > 1 ? (
        <nav
          aria-label="Pagination des paiements"
          className="flex flex-col items-center justify-between gap-4 pt-4 sm:flex-row"
        >
          <div className="w-full sm:w-auto">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              fullWidth
              disabled={currentPage <= 1}
              className="min-h-14 font-semibold"
              onClick={() => changePage(currentPage - 1)}
            >
              Précédent
            </Button>
          </div>

          <span className="text-sm text-muted">
            Page {currentPage} sur {pageCount} ({meta.total} {pluralize(meta.total, 'paiement')})
          </span>

          <div className="w-full sm:w-auto">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              fullWidth
              disabled={currentPage >= pageCount}
              className="min-h-14 font-semibold"
              onClick={() => changePage(currentPage + 1)}
            >
              Suivant
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
