'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button, buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/ui/cn';
import { formatDate, formatMoney } from '@/lib/ui/format';
import {
  ALLOWED_TRANSITIONS,
  getInterventionRequest,
  INTERVENTION_STATUS_LABELS,
  isFullIntervention,
  listHistoryRequest,
  transitionStatusRequest,
  updateInterventionRequest,
  type InterventionFull,
  type InterventionItem,
  type InterventionStatus,
  type InterventionStatusHistoryEntry,
} from '@/modules/interventions/client';

const STATUS_TONES: Record<InterventionStatus, BadgeTone> = {
  PLANNED: 'neutral',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
};

type ApiErrorBody = {
  error?: { message?: string; details?: { fieldErrors?: Record<string, string[]> } };
};

function apiMessage(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const error = (body as ApiErrorBody).error;
    if (typeof error?.message === 'string') return error.message;
  }
  return fallback;
}

export type InterventionDetailClientProps = {
  interventionId: string;
  initialIntervention: InterventionItem | InterventionFull;
  isOwnerOrManager: boolean;
  currentUserId: string;
};

export default function InterventionDetailClient({
  interventionId,
  initialIntervention,
  isOwnerOrManager,
  currentUserId,
}: InterventionDetailClientProps) {
  const [intervention, setIntervention] = useState<InterventionItem | InterventionFull>(
    initialIntervention,
  );
  const [history, setHistory] = useState<InterventionStatusHistoryEntry[]>([]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [pendingTransition, setPendingTransition] = useState<InterventionStatus | null>(null);
  const [transitionReason, setTransitionReason] = useState('');
  const [transitionActualCost, setTransitionActualCost] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(initialIntervention.title);
  const [editDescription, setEditDescription] = useState(initialIntervention.description);
  const [editProviderName, setEditProviderName] = useState(
    isFullIntervention(initialIntervention) ? (initialIntervention.providerName ?? '') : '',
  );
  const [editProviderPhone, setEditProviderPhone] = useState(
    isFullIntervention(initialIntervention) ? (initialIntervention.providerPhone ?? '') : '',
  );
  const [editPlannedFor, setEditPlannedFor] = useState(initialIntervention.plannedFor ?? '');
  const [editEstimatedCost, setEditEstimatedCost] = useState(
    isFullIntervention(initialIntervention) && initialIntervention.estimatedCost !== null
      ? String(initialIntervention.estimatedCost)
      : '',
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | null>(null);

  async function reloadHistory() {
    const response = await listHistoryRequest(interventionId);
    if (response.ok) {
      const body = await response.json();
      setHistory(body.data ?? []);
    }
  }

  async function reloadIntervention() {
    const response = await getInterventionRequest(interventionId);
    if (response.ok) {
      const body = await response.json();
      setIntervention(body.data);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      const response = await listHistoryRequest(interventionId);
      if (cancelled) return;

      if (response.ok) {
        const body = await response.json();
        if (!cancelled) setHistory(body.data ?? []);
      }
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [interventionId]);

  function startTransition(toStatus: InterventionStatus) {
    setErrorMessage(null);
    setPendingTransition(toStatus);
    setTransitionReason('');
    setTransitionActualCost('');
  }

  async function confirmTransition(
    toStatus: InterventionStatus,
    reason: string | null,
    actualCost: number | null,
  ) {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await transitionStatusRequest(interventionId, toStatus, reason, actualCost);
      const body = await response.json();

      if (!response.ok) {
        setErrorMessage(apiMessage(body, 'Impossible de changer le statut.'));
      } else {
        setPendingTransition(null);
        setTransitionReason('');
        setTransitionActualCost('');
        await reloadIntervention();
        await reloadHistory();
      }
    } catch {
      setErrorMessage('Une erreur réseau est survenue.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEditing() {
    setEditTitle(intervention.title);
    setEditDescription(intervention.description);
    setEditProviderName(isFullIntervention(intervention) ? (intervention.providerName ?? '') : '');
    setEditProviderPhone(
      isFullIntervention(intervention) ? (intervention.providerPhone ?? '') : '',
    );
    setEditPlannedFor(intervention.plannedFor ?? '');
    setEditEstimatedCost(
      isFullIntervention(intervention) && intervention.estimatedCost !== null
        ? String(intervention.estimatedCost)
        : '',
    );
    setFieldErrors(null);
    setIsEditing(true);
  }

  async function handleSaveEdit() {
    setErrorMessage(null);
    setFieldErrors(null);
    setIsSubmitting(true);

    const fields =
      intervention.status === 'IN_PROGRESS'
        ? {
            providerName: editProviderName.trim() || null,
            providerPhone: editProviderPhone.trim() || null,
            estimatedCost: editEstimatedCost === '' ? null : parseInt(editEstimatedCost, 10),
          }
        : {
            title: editTitle,
            description: editDescription,
            providerName: editProviderName.trim() || null,
            providerPhone: editProviderPhone.trim() || null,
            plannedFor: editPlannedFor || null,
            estimatedCost: editEstimatedCost === '' ? null : parseInt(editEstimatedCost, 10),
          };

    try {
      const response = await updateInterventionRequest(interventionId, fields);
      const body = await response.json();

      if (!response.ok) {
        if (body?.error?.details?.fieldErrors) setFieldErrors(body.error.details.fieldErrors);
        setErrorMessage(apiMessage(body, 'Impossible de modifier cette intervention.'));
      } else {
        setIsEditing(false);
        await reloadIntervention();
      }
    } catch {
      setErrorMessage('Une erreur réseau est survenue.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function describeHistoryAuthor(userId: string): string {
    if (userId === currentUserId) return 'Vous';
    if (isFullIntervention(intervention)) {
      if (intervention.createdByUserId === userId) return intervention.createdByName;
      if (intervention.assignedToUserId === userId && intervention.assignedToName) {
        return intervention.assignedToName;
      }
    }
    return 'Gestionnaire ou propriétaire';
  }

  const data = intervention;
  const isTerminal = data.status === 'COMPLETED' || data.status === 'CANCELLED';
  const canEdit = isOwnerOrManager && !isTerminal;
  const canManage = isOwnerOrManager && !isTerminal;
  const allowedNextStatuses = canManage ? ALLOWED_TRANSITIONS[data.status] : [];
  const onlyLimitedFieldsEditable = data.status === 'IN_PROGRESS';
  const full = isFullIntervention(data) ? data : null;

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <PageHeader title={data.title} back={{ href: '/interventions', label: 'Interventions' }} />

      <div className="flex flex-wrap gap-1.5">
        <Badge tone={STATUS_TONES[data.status]}>{INTERVENTION_STATUS_LABELS[data.status]}</Badge>
      </div>

      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}

      {/* Section 2 : Détails */}
      {isEditing ? (
        <Card className="flex flex-col gap-4 p-5 sm:p-6">
          <h2 className="font-semibold text-ink">Modifier l&apos;intervention</h2>

          {onlyLimitedFieldsEditable ? (
            <p className="text-xs text-muted">
              Au statut « En cours », seuls le prestataire, son téléphone et le coût estimé peuvent
              être modifiés.
            </p>
          ) : null}

          <Field
            id="editTitle"
            label="Titre"
            required={!onlyLimitedFieldsEditable}
            errors={fieldErrors?.title}
          >
            {(attrs) => (
              <Input
                {...attrs}
                type="text"
                minLength={3}
                maxLength={200}
                disabled={onlyLimitedFieldsEditable}
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
              />
            )}
          </Field>

          <Field
            id="editDescription"
            label="Description"
            required={!onlyLimitedFieldsEditable}
            errors={fieldErrors?.description}
          >
            {(attrs) => (
              <Textarea
                {...attrs}
                maxLength={5000}
                rows={5}
                disabled={onlyLimitedFieldsEditable}
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
              />
            )}
          </Field>

          <Field id="editProviderName" label="Prestataire" errors={fieldErrors?.providerName}>
            {(attrs) => (
              <Input
                {...attrs}
                type="text"
                maxLength={200}
                value={editProviderName}
                onChange={(event) => setEditProviderName(event.target.value)}
              />
            )}
          </Field>

          <Field
            id="editProviderPhone"
            label="Téléphone du prestataire"
            errors={fieldErrors?.providerPhone}
          >
            {(attrs) => (
              <Input
                {...attrs}
                type="tel"
                maxLength={30}
                value={editProviderPhone}
                onChange={(event) => setEditProviderPhone(event.target.value)}
              />
            )}
          </Field>

          <Field id="editPlannedFor" label="Date prévue" errors={fieldErrors?.plannedFor}>
            {(attrs) => (
              <Input
                {...attrs}
                type="date"
                disabled={onlyLimitedFieldsEditable}
                value={editPlannedFor}
                onChange={(event) => setEditPlannedFor(event.target.value)}
              />
            )}
          </Field>

          <Field
            id="editEstimatedCost"
            label="Coût estimé"
            errors={fieldErrors?.estimatedCost}
            hint="Montant en Francs Guinéens (GNF)."
          >
            {(attrs) => (
              <Input
                {...attrs}
                type="number"
                min="0"
                step="1"
                value={editEstimatedCost}
                onChange={(event) => setEditEstimatedCost(event.target.value)}
              />
            )}
          </Field>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              disabled={isSubmitting}
              className="min-h-14 font-semibold"
              onClick={() => void handleSaveEdit()}
            >
              Enregistrer
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="md"
              fullWidth
              disabled={isSubmitting}
              onClick={() => setIsEditing(false)}
            >
              Annuler
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-ink">Détails</h2>
            {canEdit ? (
              <button
                type="button"
                onClick={startEditing}
                className="text-sm font-medium text-action-strong hover:text-brand"
              >
                Modifier
              </button>
            ) : null}
          </div>

          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Statut</dt>
              <dd>
                <Badge tone={STATUS_TONES[data.status]}>
                  {INTERVENTION_STATUS_LABELS[data.status]}
                </Badge>
              </dd>
            </div>

            <div>
              <dt className="text-muted">Logement</dt>
              <dd className="font-medium text-ink">
                {data.propertyName} · {data.apartmentNumber ?? 'Parties communes'}
              </dd>
            </div>

            {data.incidentTitle ? (
              <div>
                <dt className="text-muted">Incident lié</dt>
                <dd className="font-medium text-ink">
                  {full && full.incidentId ? (
                    <Link
                      href={`/incidents/${encodeURIComponent(full.incidentId)}`}
                      className="text-action-strong hover:text-brand"
                    >
                      {data.incidentTitle}
                    </Link>
                  ) : (
                    data.incidentTitle
                  )}
                </dd>
              </div>
            ) : null}

            <div>
              <dt className="text-muted">Créée le</dt>
              <dd className="font-medium text-ink">
                {formatDate(data.createdAt)}
                {full ? ` par ${full.createdByName}` : ''}
              </dd>
            </div>

            {full?.providerName ? (
              <div>
                <dt className="text-muted">Prestataire</dt>
                <dd className="font-medium text-ink">
                  {full.providerName}
                  {full.providerPhone ? ` · ${full.providerPhone}` : ''}
                </dd>
              </div>
            ) : null}

            {data.plannedFor ? (
              <div>
                <dt className="text-muted">Prévue pour le</dt>
                <dd className="font-medium text-ink">{formatDate(data.plannedFor)}</dd>
              </div>
            ) : null}

            {full?.assignedToName ? (
              <div>
                <dt className="text-muted">Responsable</dt>
                <dd className="font-medium text-ink">{full.assignedToName}</dd>
              </div>
            ) : null}

            {data.status === 'COMPLETED' && data.completedAt ? (
              <div>
                <dt className="text-muted">Terminée le</dt>
                <dd className="font-medium text-ink">{formatDate(data.completedAt)}</dd>
              </div>
            ) : null}

            {data.status === 'CANCELLED' && data.cancelledAt ? (
              <div>
                <dt className="text-muted">Annulée le</dt>
                <dd className="font-medium text-ink">{formatDate(data.cancelledAt)}</dd>
              </div>
            ) : null}
          </dl>
        </Card>
      )}

      <Card className="flex flex-col gap-3 p-5 sm:p-6">
        <h2 className="font-semibold text-ink">Description</h2>
        <p className="whitespace-pre-wrap text-sm text-ink">{data.description}</p>
      </Card>

      {/* Section 3 : Coûts, jamais pour un TENANT (DEC-060, 8.2) */}
      {full ? (
        <Card className="flex flex-col gap-3 p-5 sm:p-6">
          <h2 className="font-semibold text-ink">Coûts</h2>

          {full.estimatedCost === null && full.actualCost === null ? (
            <p className="text-sm text-muted">Aucun montant renseigné.</p>
          ) : (
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              {full.estimatedCost !== null ? (
                <div>
                  <dt className="text-muted">Estimation</dt>
                  <dd className="font-medium text-ink">{formatMoney(full.estimatedCost, 'GNF')}</dd>
                </div>
              ) : null}
              {full.actualCost !== null ? (
                <div>
                  <dt className="text-muted">Coût réel</dt>
                  <dd className="font-medium text-ink">{formatMoney(full.actualCost, 'GNF')}</dd>
                </div>
              ) : null}
            </dl>
          )}
        </Card>
      ) : null}

      {/* Section 4B : Transitions de statut */}
      {canManage && allowedNextStatuses.length > 0 ? (
        <Card className="flex flex-col gap-4 p-5 sm:p-6">
          <h2 className="font-semibold text-ink">Changer le statut</h2>

          <div className="flex flex-wrap gap-2">
            {allowedNextStatuses.map((toStatus) => (
              <Button
                key={toStatus}
                type="button"
                variant="secondary"
                size="md"
                disabled={isSubmitting}
                onClick={() =>
                  toStatus === 'COMPLETED' || toStatus === 'CANCELLED'
                    ? startTransition(toStatus)
                    : void confirmTransition(toStatus, null, null)
                }
              >
                {INTERVENTION_STATUS_LABELS[toStatus]}
              </Button>
            ))}
          </div>

          {pendingTransition === 'COMPLETED' ? (
            <div className="flex flex-col gap-3 rounded-md bg-surface-subtle p-3">
              <Field id="transitionActualCost" label="Coût réel" required hint="Montant en GNF.">
                {(attrs) => (
                  <Input
                    {...attrs}
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Ex : 150000"
                    value={transitionActualCost}
                    onChange={(event) => setTransitionActualCost(event.target.value)}
                  />
                )}
              </Field>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  disabled={isSubmitting || transitionActualCost === ''}
                  onClick={() =>
                    void confirmTransition('COMPLETED', null, parseInt(transitionActualCost, 10))
                  }
                >
                  Confirmer
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  disabled={isSubmitting}
                  onClick={() => setPendingTransition(null)}
                >
                  Annuler
                </Button>
              </div>
            </div>
          ) : null}

          {pendingTransition === 'CANCELLED' ? (
            <div className="flex flex-col gap-3 rounded-md bg-surface-subtle p-3">
              <Field id="transitionReason" label="Motif d'annulation" required>
                {(attrs) => (
                  <Textarea
                    {...attrs}
                    rows={3}
                    maxLength={1000}
                    placeholder="Pourquoi cette intervention est annulée."
                    value={transitionReason}
                    onChange={(event) => setTransitionReason(event.target.value)}
                  />
                )}
              </Field>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  disabled={isSubmitting || !transitionReason.trim()}
                  onClick={() => void confirmTransition('CANCELLED', transitionReason, null)}
                >
                  Confirmer
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  disabled={isSubmitting}
                  onClick={() => setPendingTransition(null)}
                >
                  Annuler
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* Section 5 : Historique */}
      <Card className="flex flex-col gap-4 p-5 sm:p-6">
        <h2 className="font-semibold text-ink">Historique</h2>

        {history.length === 0 ? (
          <p className="text-sm text-muted">Aucun changement de statut pour le moment.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-1 border-b border-line pb-3 last:border-0 last:pb-0"
              >
                <span className="text-sm font-medium text-ink">
                  {entry.fromStatus ? INTERVENTION_STATUS_LABELS[entry.fromStatus] : 'Création'}
                  {' → '}
                  {INTERVENTION_STATUS_LABELS[entry.toStatus]}
                </span>
                <span className="text-xs text-muted">
                  {describeHistoryAuthor(entry.byUserId)} · {formatDate(entry.createdAt)}
                </span>
                {entry.reason ? (
                  <p className="mt-1 rounded-md bg-surface-subtle p-2 text-sm text-ink">
                    {entry.reason}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Link
        href="/interventions"
        className={cn(buttonClasses('secondary', 'lg', true), 'min-h-14 text-base font-semibold')}
      >
        Retour à la liste
      </Link>
    </div>
  );
}
