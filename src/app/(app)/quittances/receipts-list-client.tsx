'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Amount } from '@/components/ui/amount';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/ui/cn';
import { formatDate, formatMonth, pluralize } from '@/lib/ui/format';
import {
  listReceiptsRequest,
  RECEIPT_STATUS_LABELS,
  type ReceiptStatus,
  type ReceiptWithRelations,
} from '@/modules/receipts/client';

type ListMeta = {
  total: number;
  page: number;
  pageSize: number;
};

type FilterTab = {
  value: ReceiptStatus | 'ALL';
  label: string;
};

const FILTER_TABS: FilterTab[] = [
  { value: 'ALL', label: 'Toutes' },
  { value: 'EMISE', label: 'Émises' },
  { value: 'INVALIDEE', label: 'Invalidées' },
];

const STATUS_TONES: Record<ReceiptStatus, BadgeTone> = {
  EMISE: 'success',
  INVALIDEE: 'neutral',
};

export default function ReceiptsListClient({ title }: { title: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const statusParam = searchParams.get('status');
  const pageParam = searchParams.get('page');

  const currentStatus: ReceiptStatus | 'ALL' =
    statusParam && ['EMISE', 'INVALIDEE'].includes(statusParam)
      ? (statusParam as ReceiptStatus)
      : 'ALL';

  const currentPage = pageParam && Number(pageParam) > 0 ? parseInt(pageParam, 10) : 1;

  const [receipts, setReceipts] = useState<ReceiptWithRelations[]>([]);
  const [meta, setMeta] = useState<ListMeta>({ total: 0, page: 1, pageSize: 20 });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const response = await listReceiptsRequest({
          page: currentPage,
          status: currentStatus === 'ALL' ? undefined : currentStatus,
        });

        if (!response.ok) {
          throw new Error('Impossible de charger la liste des quittances.');
        }

        const body = (await response.json()) as {
          data: ReceiptWithRelations[];
          meta: { total: number; page: number; pageSize: number };
        };

        if (cancelled) return;

        setReceipts(body.data ?? []);
        setMeta({
          total: body.meta.total ?? 0,
          page: body.meta.page ?? 1,
          pageSize: body.meta.pageSize || 20,
        });
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Impossible de charger la liste des quittances.',
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

  function changeFilter(status: ReceiptStatus | 'ALL') {
    const params = new URLSearchParams(searchParams.toString());
    if (status === 'ALL') {
      params.delete('status');
    } else {
      params.set('status', status);
    }
    params.delete('page');

    const query = params.toString();
    router.push(query ? `/quittances?${query}` : '/quittances');
  }

  function changePage(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage <= 1) {
      params.delete('page');
    } else {
      params.set('page', String(newPage));
    }

    const query = params.toString();
    router.push(query ? `/quittances?${query}` : '/quittances');
  }

  const pageCount = Math.max(1, Math.ceil(meta.total / meta.pageSize));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        description={
          loading
            ? 'Chargement des quittances...'
            : meta.total === 0
              ? 'Les quittances émises apparaîtront ici.'
              : pluralize(meta.total, 'quittance')
        }
      />

      <nav aria-label="Filtrer les quittances" className="flex flex-wrap gap-1">
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

      {loading ? (
        <p className="py-8 text-center text-sm text-muted">Chargement des quittances...</p>
      ) : receipts.length === 0 ? (
        <EmptyState
          title="Aucune quittance"
          description="Les quittances sont émises automatiquement chaque mois, une fois la période réglée."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {receipts.map((item) => (
            <li key={item.receipt.id}>
              <Link
                href={`/quittances/${encodeURIComponent(item.receipt.id)}`}
                className="block transition-transform active:scale-[0.99]"
              >
                <Card className="flex flex-col gap-3 p-4 sm:p-5 hover:border-action">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                    <span className="font-mono text-sm font-bold text-ink">
                      {item.receipt.referenceNumber}
                    </span>
                    {item.currentVersion ? (
                      <Badge tone={STATUS_TONES[item.currentVersion.status]}>
                        {RECEIPT_STATUS_LABELS[item.currentVersion.status]}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Amount
                      amount={item.receipt.totalAttested}
                      currency={item.receipt.currency}
                      scale="key"
                    />
                    <span className="text-xs text-muted">
                      {formatMonth(item.receipt.periodStart)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-1 text-xs text-muted sm:grid-cols-2">
                    <div>
                      <span>Locataire : </span>
                      <span className="text-ink">{item.tenantName}</span>
                    </div>
                    <div>
                      <span>Logement : </span>
                      <span className="text-ink">{item.apartmentName}</span>
                    </div>
                  </div>

                  {item.currentVersion ? (
                    <span className="text-xs text-muted">
                      Émise le {formatDate(item.currentVersion.emittedAt)}
                    </span>
                  ) : null}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!loading && pageCount > 1 ? (
        <nav
          aria-label="Pagination des quittances"
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
            Page {currentPage} sur {pageCount} ({meta.total} {pluralize(meta.total, 'quittance')})
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
