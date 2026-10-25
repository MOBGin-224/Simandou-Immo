'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button, buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/ui/cn';
import { formatDate, pluralize } from '@/lib/ui/format';
import {
  INTERVENTION_STATUS_LABELS,
  isFullIntervention,
  listInterventionsRequest,
  type InterventionFull,
  type InterventionItem,
  type InterventionStatus,
} from '@/modules/interventions/client';

type ListMeta = {
  total: number;
  page: number;
  pageSize: number;
};

type StatusFilterValue = 'ALL' | InterventionStatus;

const STATUS_FILTER_TABS: { value: StatusFilterValue; label: string }[] = [
  { value: 'ALL', label: 'Toutes' },
  { value: 'PLANNED', label: 'Planifiées' },
  { value: 'IN_PROGRESS', label: 'En cours' },
  { value: 'COMPLETED', label: 'Terminées' },
  { value: 'CANCELLED', label: 'Annulées' },
];

/**
 * Tons de statut (DEC-018, DEC-060). PLANNED est neutre, en attente de
 * démarrage ; IN_PROGRESS signale une prise en charge (bleu d'information) ;
 * COMPLETED est l'état visé (vert) ; CANCELLED est neutre, une fin normale de
 * cycle qui n'est pas un échec (MVP-UI-011).
 */
const STATUS_TONES: Record<InterventionStatus, BadgeTone> = {
  PLANNED: 'neutral',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
};

const STATUS_VALUES: readonly string[] = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

export default function InterventionsListClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const statusParam = searchParams.get('status');
  const pageParam = searchParams.get('page');

  const currentStatus: StatusFilterValue =
    statusParam && STATUS_VALUES.includes(statusParam) ? (statusParam as StatusFilterValue) : 'ALL';

  const currentPage = pageParam && Number(pageParam) > 0 ? parseInt(pageParam, 10) : 1;

  const [interventions, setInterventions] = useState<Array<InterventionItem | InterventionFull>>(
    [],
  );
  const [meta, setMeta] = useState<ListMeta>({ total: 0, page: 1, pageSize: 20 });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const response = await listInterventionsRequest({
          page: currentPage,
          status: currentStatus === 'ALL' ? undefined : [currentStatus],
        });

        if (!response.ok) {
          throw new Error('Impossible de charger la liste des interventions.');
        }

        const body = (await response.json()) as {
          data: Array<InterventionItem | InterventionFull>;
          meta: { total: number; page: number; pageSize: number };
        };

        if (cancelled) return;

        setInterventions(body.data ?? []);
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
              : 'Impossible de charger la liste des interventions.',
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

  function changeStatus(status: StatusFilterValue) {
    const params = new URLSearchParams(searchParams.toString());
    if (status === 'ALL') params.delete('status');
    else params.set('status', status);
    params.delete('page');

    const query = params.toString();
    router.push(query ? `/interventions?${query}` : '/interventions');
  }

  function changePage(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage <= 1) {
      params.delete('page');
    } else {
      params.set('page', String(newPage));
    }

    const query = params.toString();
    router.push(query ? `/interventions?${query}` : '/interventions');
  }

  const pageCount = Math.max(1, Math.ceil(meta.total / meta.pageSize));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Interventions"
        description={
          loading
            ? 'Chargement des interventions...'
            : meta.total === 0
              ? 'Le suivi des interventions apparaîtra ici.'
              : pluralize(meta.total, 'intervention')
        }
        actions={
          <Link href="/interventions/nouvelle" className={buttonClasses('primary', 'md')}>
            Nouvelle intervention
          </Link>
        }
      />

      <nav aria-label="Filtrer par statut" className="flex flex-wrap gap-1">
        {STATUS_FILTER_TABS.map((tab) => {
          const isActive = currentStatus === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => changeStatus(tab.value)}
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
        <p className="py-8 text-center text-sm text-muted">Chargement des interventions...</p>
      ) : interventions.length === 0 ? (
        <EmptyState
          title="Aucune intervention"
          description="Créez une intervention pour planifier un passage, lié ou non à un incident."
          action={
            <Link href="/interventions/nouvelle" className={buttonClasses('primary', 'md')}>
              Nouvelle intervention
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {interventions.map((item) => (
            <li key={item.id}>
              <Link
                href={`/interventions/${encodeURIComponent(item.id)}`}
                className="block transition-transform active:scale-[0.99]"
              >
                <Card className="flex flex-col gap-3 p-4 sm:p-5 hover:border-action">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-bold text-ink">
                      {item.title}
                    </span>
                    <Badge tone={STATUS_TONES[item.status]}>
                      {INTERVENTION_STATUS_LABELS[item.status]}
                    </Badge>
                  </div>

                  {item.incidentTitle ? (
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone="info" dot={false}>
                        Incident lié : {item.incidentTitle}
                      </Badge>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-1 text-xs text-muted sm:grid-cols-2">
                    <div>
                      <span>Logement : </span>
                      <span className="text-ink">
                        {item.propertyName} · {item.apartmentNumber ?? 'Parties communes'}
                      </span>
                    </div>
                    {isFullIntervention(item) && item.providerName ? (
                      <div>
                        <span>Prestataire : </span>
                        <span className="text-ink">{item.providerName}</span>
                      </div>
                    ) : null}
                  </div>

                  {item.plannedFor ? (
                    <span className="text-xs text-muted">
                      Prévue le {formatDate(item.plannedFor)}
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
          aria-label="Pagination des interventions"
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
            Page {currentPage} sur {pageCount} ({pluralize(meta.total, 'intervention')})
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
