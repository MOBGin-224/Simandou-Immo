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
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_PRIORITY_LABELS,
  INCIDENT_STATUS_LABELS,
  listIncidentsRequest,
  type IncidentPriority,
  type IncidentStatus,
  type IncidentWithRelations,
} from '@/modules/incidents/client';

type ListMeta = {
  total: number;
  page: number;
  pageSize: number;
};

/** `TO_PROCESS` est le filtre virtuel de DEC-059 (section 10.1), pas un statut stocké. */
type StatusFilterValue = 'ALL' | 'TO_PROCESS' | IncidentStatus;
type PriorityFilterValue = 'ALL' | IncidentPriority;

const STATUS_FILTER_TABS: { value: StatusFilterValue; label: string }[] = [
  { value: 'ALL', label: 'Tous' },
  { value: 'TO_PROCESS', label: 'À traiter' },
  { value: 'OPEN', label: 'Nouveau' },
  { value: 'ASSIGNED', label: 'Affecté' },
  { value: 'IN_PROGRESS', label: 'En cours' },
  { value: 'ON_HOLD', label: 'En attente' },
  { value: 'RESOLVED', label: 'Résolu' },
  { value: 'CLOSED', label: 'Clôturé' },
];

const PRIORITY_FILTER_TABS: { value: PriorityFilterValue; label: string }[] = [
  { value: 'ALL', label: 'Toutes' },
  { value: 'LOW', label: 'Basse' },
  { value: 'NORMAL', label: 'Normale' },
  { value: 'URGENT', label: 'Urgente' },
];

/**
 * Tons de statut. « Nouveau » et « En attente » appellent une action
 * (orange) ; « Affecté » et « En cours » signalent une prise en charge en
 * cours (bleu d'information) ; « Résolu » est l'état visé (vert) ; « Clôturé »
 * est neutre, une fin normale de cycle (MVP-UI-011).
 */
const STATUS_TONES: Record<IncidentStatus, BadgeTone> = {
  OPEN: 'warning',
  ASSIGNED: 'info',
  IN_PROGRESS: 'info',
  ON_HOLD: 'warning',
  RESOLVED: 'success',
  CLOSED: 'neutral',
};

/** LOW et NORMAL partagent le même gris neutre ; seule URGENT est en rouge. */
const PRIORITY_TONES: Record<IncidentPriority, BadgeTone> = {
  LOW: 'neutral',
  NORMAL: 'neutral',
  URGENT: 'danger',
};

const STATUS_VALUES: readonly string[] = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'ON_HOLD',
  'RESOLVED',
  'CLOSED',
];
const PRIORITY_VALUES: readonly string[] = ['LOW', 'NORMAL', 'URGENT'];

export default function IncidentsListClient({ title }: { title: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const statusParam = searchParams.get('status');
  const priorityParam = searchParams.get('priority');
  const pageParam = searchParams.get('page');

  const currentStatus: StatusFilterValue =
    statusParam === 'TO_PROCESS' || (statusParam && STATUS_VALUES.includes(statusParam))
      ? (statusParam as StatusFilterValue)
      : 'ALL';

  const currentPriority: PriorityFilterValue =
    priorityParam && PRIORITY_VALUES.includes(priorityParam)
      ? (priorityParam as PriorityFilterValue)
      : 'ALL';

  const currentPage = pageParam && Number(pageParam) > 0 ? parseInt(pageParam, 10) : 1;

  const [incidents, setIncidents] = useState<IncidentWithRelations[]>([]);
  const [meta, setMeta] = useState<ListMeta>({ total: 0, page: 1, pageSize: 20 });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const response = await listIncidentsRequest({
          page: currentPage,
          toProcess: currentStatus === 'TO_PROCESS' ? true : undefined,
          status:
            currentStatus === 'ALL' || currentStatus === 'TO_PROCESS' ? undefined : [currentStatus],
          priority: currentPriority === 'ALL' ? undefined : currentPriority,
        });

        if (!response.ok) {
          throw new Error('Impossible de charger la liste des incidents.');
        }

        const body = (await response.json()) as {
          data: IncidentWithRelations[];
          meta: { total: number; page: number; pageSize: number };
        };

        if (cancelled) return;

        setIncidents(body.data ?? []);
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
              : 'Impossible de charger la liste des incidents.',
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
  }, [currentStatus, currentPriority, currentPage]);

  function pushParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete('page');

    const query = params.toString();
    router.push(query ? `/incidents?${query}` : '/incidents');
  }

  function changeStatus(status: StatusFilterValue) {
    pushParams((params) => {
      if (status === 'ALL') params.delete('status');
      else params.set('status', status);
    });
  }

  function changePriority(priority: PriorityFilterValue) {
    pushParams((params) => {
      if (priority === 'ALL') params.delete('priority');
      else params.set('priority', priority);
    });
  }

  function changePage(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage <= 1) {
      params.delete('page');
    } else {
      params.set('page', String(newPage));
    }

    const query = params.toString();
    router.push(query ? `/incidents?${query}` : '/incidents');
  }

  const pageCount = Math.max(1, Math.ceil(meta.total / meta.pageSize));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        description={
          loading
            ? 'Chargement des incidents...'
            : meta.total === 0
              ? 'Les incidents déclarés apparaîtront ici.'
              : pluralize(meta.total, 'incident')
        }
        actions={
          <Link href="/incidents/nouveau" className={buttonClasses('primary', 'md')}>
            Déclarer un incident
          </Link>
        }
      />

      <div className="flex flex-col gap-3">
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

        <nav aria-label="Filtrer par priorité" className="flex flex-wrap gap-1">
          {PRIORITY_FILTER_TABS.map((tab) => {
            const isActive = currentPriority === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => changePriority(tab.value)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-9 items-center rounded-md px-3 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-surface-subtle text-ink'
                    : 'text-muted hover:bg-surface hover:text-ink',
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {errorMessage ? (
        <Card className="border-danger/30 p-5 text-sm text-danger">{errorMessage}</Card>
      ) : null}

      {loading ? (
        <p className="py-8 text-center text-sm text-muted">Chargement des incidents...</p>
      ) : incidents.length === 0 ? (
        <EmptyState
          title="Aucun incident"
          description="Déclarez un incident pour signaler un problème dans un logement."
          action={
            <Link href="/incidents/nouveau" className={buttonClasses('primary', 'md')}>
              Déclarer un incident
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {incidents.map((item) => (
            <li key={item.incident.id}>
              <Link
                href={`/incidents/${encodeURIComponent(item.incident.id)}`}
                className="block transition-transform active:scale-[0.99]"
              >
                <Card className="flex flex-col gap-3 p-4 sm:p-5 hover:border-action">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-bold text-ink">
                      {item.incident.title}
                    </span>
                    <Badge tone={STATUS_TONES[item.incident.status]}>
                      {INCIDENT_STATUS_LABELS[item.incident.status]}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="neutral">{INCIDENT_CATEGORY_LABELS[item.incident.category]}</Badge>
                    <Badge tone={PRIORITY_TONES[item.incident.priority]}>
                      {INCIDENT_PRIORITY_LABELS[item.incident.priority]}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-1 text-xs text-muted sm:grid-cols-2">
                    <div>
                      <span>Logement : </span>
                      <span className="text-ink">
                        {item.propertyName} · {item.apartmentName}
                      </span>
                    </div>
                    <div>
                      <span>Déclaré par : </span>
                      <span className="text-ink">{item.createdByName}</span>
                    </div>
                  </div>

                  <span className="text-xs text-muted">
                    Déclaré le {formatDate(item.incident.createdAt)}
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!loading && pageCount > 1 ? (
        <nav
          aria-label="Pagination des incidents"
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
            Page {currentPage} sur {pageCount} ({meta.total} {pluralize(meta.total, 'incident')})
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
