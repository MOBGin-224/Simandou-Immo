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
import { formatDate } from '@/lib/ui/format';
import {
  addCommentRequest,
  ALLOWED_TRANSITIONS,
  assignIncidentRequest,
  getIncidentRequest,
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_PRIORITY_LABELS,
  INCIDENT_STATUS_LABELS,
  listCommentsRequest,
  listIncidentHistoryRequest,
  transitionStatusRequest,
  updateIncidentRequest,
  type IncidentCategory,
  type IncidentCommentWithAuthor,
  type IncidentPriority,
  type IncidentStatus,
  type IncidentStatusHistoryEntry,
  type IncidentWithRelations,
} from '@/modules/incidents/client';
import { listManagersRequest, type ManagerListItem } from '@/modules/managers/client';

const STATUS_TONES: Record<IncidentStatus, BadgeTone> = {
  OPEN: 'warning',
  ASSIGNED: 'info',
  IN_PROGRESS: 'info',
  ON_HOLD: 'warning',
  RESOLVED: 'success',
  CLOSED: 'neutral',
};

const PRIORITY_TONES: Record<IncidentPriority, BadgeTone> = {
  LOW: 'neutral',
  NORMAL: 'neutral',
  URGENT: 'danger',
};

const CATEGORY_OPTIONS: IncidentCategory[] = [
  'PLUMBING',
  'ELECTRICITY',
  'AIR_CONDITIONING',
  'LOCKS_AND_KEYS',
  'OTHER',
];

const PRIORITY_OPTIONS: IncidentPriority[] = ['LOW', 'NORMAL', 'URGENT'];

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

export type IncidentDetailClientProps = {
  incidentId: string;
  initialIncident: IncidentWithRelations;
  isOwnerOrManager: boolean;
  currentUserId: string;
};

export default function IncidentDetailClient({
  incidentId,
  initialIncident,
  isOwnerOrManager,
  currentUserId,
}: IncidentDetailClientProps) {
  const [incident, setIncident] = useState<IncidentWithRelations>(initialIncident);
  const [history, setHistory] = useState<IncidentStatusHistoryEntry[]>([]);
  const [comments, setComments] = useState<IncidentCommentWithAuthor[]>([]);
  const [managers, setManagers] = useState<ManagerListItem[]>([]);
  const [managersError, setManagersError] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showAssignForm, setShowAssignForm] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState('');

  const [pendingTransition, setPendingTransition] = useState<IncidentStatus | null>(null);
  const [transitionReason, setTransitionReason] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(initialIncident.incident.title);
  const [editDescription, setEditDescription] = useState(initialIncident.incident.description);
  const [editPriority, setEditPriority] = useState(initialIncident.incident.priority);
  const [editCategory, setEditCategory] = useState(initialIncident.incident.category);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | null>(null);

  const [newComment, setNewComment] = useState('');

  const selectClasses =
    'min-h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink focus:border-action focus:outline-none';

  async function reloadHistory() {
    const response = await listIncidentHistoryRequest(incidentId);
    if (response.ok) {
      const body = await response.json();
      setHistory(body.data ?? []);
    }
  }

  async function reloadComments() {
    const response = await listCommentsRequest(incidentId);
    if (response.ok) {
      const body = await response.json();
      setComments(body.data ?? []);
    }
  }

  async function reloadIncident() {
    const response = await getIncidentRequest(incidentId);
    if (response.ok) {
      const body = await response.json();
      setIncident(body.data);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      const [historyResponse, commentsResponse] = await Promise.all([
        listIncidentHistoryRequest(incidentId),
        listCommentsRequest(incidentId),
      ]);

      if (cancelled) return;

      if (historyResponse.ok) {
        const historyBody = await historyResponse.json();
        if (!cancelled) setHistory(historyBody.data ?? []);
      }

      if (commentsResponse.ok) {
        const commentsBody = await commentsResponse.json();
        if (!cancelled) setComments(commentsBody.data ?? []);
      }
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [incidentId]);

  async function loadManagers() {
    setManagersError(null);
    try {
      const response = await listManagersRequest();
      const body = await response.json();

      if (!response.ok) {
        setManagersError(apiMessage(body, 'Impossible de charger la liste des gestionnaires.'));
        return;
      }

      setManagers(
        (body.data ?? []).filter(
          (item: ManagerListItem) => item.kind === 'ACCESS' && item.status === 'ACTIVE',
        ),
      );
    } catch {
      setManagersError('Une erreur réseau est survenue.');
    }
  }

  function toggleAssignForm() {
    setShowAssignForm((previous) => !previous);
    if (!showAssignForm) void loadManagers();
  }

  async function handleAssign() {
    if (!selectedManagerId) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await assignIncidentRequest(incidentId, selectedManagerId);
      const body = await response.json();

      if (!response.ok) {
        setErrorMessage(apiMessage(body, "Impossible d'affecter cet incident."));
      } else {
        setShowAssignForm(false);
        setSelectedManagerId('');
        await reloadIncident();
        await reloadHistory();
      }
    } catch {
      setErrorMessage('Une erreur réseau est survenue.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function startTransition(toStatus: IncidentStatus) {
    setErrorMessage(null);
    setPendingTransition(toStatus);
    setTransitionReason('');
  }

  async function confirmTransition(toStatus: IncidentStatus, reason: string | null) {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await transitionStatusRequest(incidentId, toStatus, reason);
      const body = await response.json();

      if (!response.ok) {
        setErrorMessage(apiMessage(body, 'Impossible de changer le statut.'));
      } else {
        setPendingTransition(null);
        setTransitionReason('');
        await reloadIncident();
        await reloadHistory();
      }
    } catch {
      setErrorMessage('Une erreur réseau est survenue.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEditing() {
    setEditTitle(incident.incident.title);
    setEditDescription(incident.incident.description);
    setEditPriority(incident.incident.priority);
    setEditCategory(incident.incident.category);
    setFieldErrors(null);
    setIsEditing(true);
  }

  async function handleSaveEdit() {
    setErrorMessage(null);
    setFieldErrors(null);
    setIsSubmitting(true);

    try {
      const response = await updateIncidentRequest(incidentId, {
        title: editTitle,
        description: editDescription,
        priority: editPriority,
        category: editCategory,
      });
      const body = await response.json();

      if (!response.ok) {
        if (body?.error?.details?.fieldErrors) setFieldErrors(body.error.details.fieldErrors);
        setErrorMessage(apiMessage(body, 'Impossible de modifier cet incident.'));
      } else {
        setIsEditing(false);
        await reloadIncident();
      }
    } catch {
      setErrorMessage('Une erreur réseau est survenue.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAddComment(event: React.FormEvent) {
    event.preventDefault();
    if (!newComment.trim()) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const response = await addCommentRequest(incidentId, newComment);
      const body = await response.json();

      if (!response.ok) {
        setErrorMessage(apiMessage(body, "Impossible d'ajouter ce commentaire."));
      } else {
        setNewComment('');
        await reloadComments();
      }
    } catch {
      setErrorMessage('Une erreur réseau est survenue.');
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * Nom d'un auteur d'historique, sans jointure dédiée côté serveur : on
   * résout ce qu'on connaît déjà (créateur, assigné, soi-même), et on
   * retombe sur une mention générique sinon. Même méthode que
   * `payment-detail-client.tsx`.
   */
  function describeHistoryAuthor(userId: string): string {
    if (userId === currentUserId) return 'Vous';
    if (userId === incident.incident.createdByUserId) return incident.createdByName;
    if (incident.incident.assignedToUserId === userId && incident.assignedToName) {
      return incident.assignedToName;
    }
    return 'Gestionnaire ou propriétaire';
  }

  const { incident: data } = incident;
  const isCreator = data.createdByUserId === currentUserId;
  const canEdit =
    data.status !== 'CLOSED' && (isOwnerOrManager || (isCreator && data.status === 'OPEN'));
  const canManage = isOwnerOrManager && data.status !== 'CLOSED';
  const allowedNextStatuses = isOwnerOrManager ? ALLOWED_TRANSITIONS[data.status] : [];

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <PageHeader title={data.title} back={{ href: '/incidents', label: 'Incidents' }} />

      <div className="flex flex-wrap gap-1.5">
        <Badge tone={STATUS_TONES[data.status]}>{INCIDENT_STATUS_LABELS[data.status]}</Badge>
        <Badge tone={PRIORITY_TONES[data.priority]}>
          {INCIDENT_PRIORITY_LABELS[data.priority]}
        </Badge>
        <Badge tone="neutral">{INCIDENT_CATEGORY_LABELS[data.category]}</Badge>
      </div>

      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}

      {/* Section 2 : Détails */}
      {isEditing ? (
        <Card className="flex flex-col gap-4 p-5 sm:p-6">
          <h2 className="font-semibold text-ink">Modifier l&apos;incident</h2>

          <Field id="editTitle" label="Titre" required errors={fieldErrors?.title}>
            {(attrs) => (
              <Input
                {...attrs}
                type="text"
                minLength={3}
                maxLength={200}
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
              />
            )}
          </Field>

          <Field
            id="editDescription"
            label="Description"
            required
            errors={fieldErrors?.description}
          >
            {(attrs) => (
              <Textarea
                {...attrs}
                maxLength={5000}
                rows={5}
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
              />
            )}
          </Field>

          <Field id="editCategory" label="Catégorie" required errors={fieldErrors?.category}>
            {({ id, 'aria-describedby': describedBy, 'aria-invalid': isInvalid }) => (
              <select
                id={id}
                aria-describedby={describedBy}
                aria-invalid={isInvalid}
                value={editCategory}
                onChange={(event) => setEditCategory(event.target.value as IncidentCategory)}
                className={selectClasses}
              >
                {CATEGORY_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {INCIDENT_CATEGORY_LABELS[value]}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field id="editPriority" label="Priorité" required errors={fieldErrors?.priority}>
            {({ id, 'aria-describedby': describedBy, 'aria-invalid': isInvalid }) => (
              <select
                id={id}
                aria-describedby={describedBy}
                aria-invalid={isInvalid}
                value={editPriority}
                onChange={(event) => setEditPriority(event.target.value as IncidentPriority)}
                className={selectClasses}
              >
                {PRIORITY_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {INCIDENT_PRIORITY_LABELS[value]}
                  </option>
                ))}
              </select>
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
              <dt className="text-muted">Immeuble</dt>
              <dd className="font-medium text-ink">{incident.propertyName}</dd>
            </div>
            <div>
              <dt className="text-muted">Appartement</dt>
              <dd className="font-medium text-ink">{incident.apartmentName}</dd>
            </div>
            <div>
              <dt className="text-muted">Déclaré par</dt>
              <dd className="font-medium text-ink">{incident.createdByName}</dd>
              <dd className="text-xs text-muted">{formatDate(data.createdAt)}</dd>
            </div>
            {data.assignedToUserId && data.assignedAt ? (
              <div>
                <dt className="text-muted">Affecté à</dt>
                <dd className="font-medium text-ink">{incident.assignedToName}</dd>
                <dd className="text-xs text-muted">{formatDate(data.assignedAt)}</dd>
              </div>
            ) : null}
            {(data.status === 'RESOLVED' || data.status === 'CLOSED') && data.resolvedAt ? (
              <div>
                <dt className="text-muted">Résolu le</dt>
                <dd className="font-medium text-ink">{formatDate(data.resolvedAt)}</dd>
              </div>
            ) : null}
            {data.status === 'CLOSED' && data.closedAt ? (
              <div>
                <dt className="text-muted">Clôturé le</dt>
                <dd className="font-medium text-ink">{formatDate(data.closedAt)}</dd>
              </div>
            ) : null}
          </dl>
        </Card>
      )}

      <Card className="flex flex-col gap-3 p-5 sm:p-6">
        <h2 className="font-semibold text-ink">Description</h2>
        <p className="whitespace-pre-wrap text-sm text-ink">{data.description}</p>
      </Card>

      {/* Section 3A : Affectation */}
      {canManage ? (
        <Card className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-ink">Affectation</h2>
            <button
              type="button"
              onClick={toggleAssignForm}
              className="text-sm font-medium text-action-strong hover:text-brand"
            >
              {showAssignForm ? 'Fermer' : 'Affecter à...'}
            </button>
          </div>

          {showAssignForm ? (
            <div className="flex flex-col gap-3">
              {managersError ? <Alert tone="warning">{managersError}</Alert> : null}

              <select
                value={selectedManagerId}
                onChange={(event) => setSelectedManagerId(event.target.value)}
                className={selectClasses}
              >
                <option value="">Choisir une personne</option>
                {managers.map((manager) => (
                  <option key={manager.userId} value={manager.userId}>
                    {manager.fullName}
                  </option>
                ))}
              </select>

              <Button
                type="button"
                variant="primary"
                size="md"
                fullWidth
                disabled={isSubmitting || !selectedManagerId}
                onClick={() => void handleAssign()}
              >
                Confirmer l&apos;affectation
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* Section 3B : Transitions de statut */}
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
                  data.status === 'RESOLVED' && toStatus === 'IN_PROGRESS'
                    ? startTransition(toStatus)
                    : void confirmTransition(toStatus, null)
                }
              >
                {INCIDENT_STATUS_LABELS[toStatus]}
              </Button>
            ))}
          </div>

          {pendingTransition === 'IN_PROGRESS' && data.status === 'RESOLVED' ? (
            <div className="flex flex-col gap-3 rounded-md bg-surface-subtle p-3">
              <Field id="transitionReason" label="Motif" required>
                {(attrs) => (
                  <Textarea
                    {...attrs}
                    rows={3}
                    maxLength={1000}
                    placeholder="Pourquoi l'incident revient en cours."
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
                  onClick={() => void confirmTransition('IN_PROGRESS', transitionReason)}
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

      {/* Section 4 : Historique */}
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
                  {entry.fromStatus ? INCIDENT_STATUS_LABELS[entry.fromStatus] : 'Création'}
                  {' → '}
                  {INCIDENT_STATUS_LABELS[entry.toStatus]}
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

      {/* Section 5 : Commentaires */}
      <Card className="flex flex-col gap-4 p-5 sm:p-6">
        <h2 className="font-semibold text-ink">Commentaires</h2>

        {comments.length === 0 ? (
          <p className="text-sm text-muted">Aucun commentaire pour le moment.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {comments.map((item) => (
              <li
                key={item.comment.id}
                className="flex flex-col gap-1 border-b border-line pb-3 last:border-0 last:pb-0"
              >
                <span className="text-xs text-muted">
                  {item.authorName} · {formatDate(item.comment.createdAt)}
                </span>
                <p className="text-sm text-ink">{item.comment.content}</p>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleAddComment} className="flex flex-col gap-3 pt-2">
          <Textarea
            maxLength={2000}
            rows={3}
            placeholder="Ajouter un commentaire..."
            value={newComment}
            onChange={(event) => setNewComment(event.target.value)}
          />
          <Button
            type="submit"
            variant="primary"
            size="md"
            fullWidth
            disabled={isSubmitting || !newComment.trim()}
          >
            Publier
          </Button>
        </form>
      </Card>

      <Link
        href="/incidents"
        className={cn(buttonClasses('secondary', 'lg', true), 'min-h-14 text-base font-semibold')}
      >
        Retour à la liste
      </Link>
    </div>
  );
}
