/**
 * Surface du module Incidents réservée à l'interface client (Lot 13, DEC-059).
 *
 * Ce fichier ne réexporte QUE des constantes, des types et des fonctions
 * utilisables côté navigateur, sans charger de dépendance serveur ni de base
 * de données. Même principe que `src/modules/receipts/client.ts` et
 * `src/modules/payments/client.ts`.
 */

export type IncidentStatus =
  'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'ON_HOLD' | 'RESOLVED' | 'CLOSED';

export type IncidentPriority = 'LOW' | 'NORMAL' | 'URGENT';

export type IncidentCategory =
  'PLUMBING' | 'ELECTRICITY' | 'AIR_CONDITIONING' | 'LOCKS_AND_KEYS' | 'OTHER';

/** Forme minimale d'un incident, telle que rendue par l'API (DEC-059). */
export type IncidentItem = {
  id: string;
  organizationId: string;
  propertyId: string;
  apartmentId: string;
  createdByUserId: string;
  title: string;
  description: string;
  priority: IncidentPriority;
  status: IncidentStatus;
  category: IncidentCategory;
  assignedToUserId: string | null;
  assignedAt: string | null;
  assignedByUserId: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IncidentWithRelations = {
  incident: IncidentItem;
  apartmentName: string;
  propertyName: string;
  organizationName: string;
  createdByName: string;
  assignedToName: string | null;
};

/**
 * Transitions autorisées du cycle de l'incident (DEC-017, DEC-059).
 *
 * Donnée de référence publique, dupliquée ici sans dépendance serveur :
 * `src/modules/incidents/transitions.ts` en est la source côté backend, et
 * les deux doivent rester identiques.
 */
export const ALLOWED_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  OPEN: ['ASSIGNED', 'IN_PROGRESS', 'CLOSED'],
  ASSIGNED: ['IN_PROGRESS', 'ON_HOLD', 'CLOSED'],
  IN_PROGRESS: ['ON_HOLD', 'RESOLVED', 'CLOSED'],
  ON_HOLD: ['IN_PROGRESS', 'CLOSED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
};

export type IncidentStatusHistoryEntry = {
  id: string;
  incidentId: string;
  fromStatus: IncidentStatus | null;
  toStatus: IncidentStatus;
  byUserId: string;
  reason: string | null;
  createdAt: string;
};

export type IncidentComment = {
  id: string;
  incidentId: string;
  authorUserId: string;
  content: string;
  createdAt: string;
};

export type IncidentCommentWithAuthor = {
  comment: IncidentComment;
  authorName: string;
};

export type UpdateIncidentFields = Partial<{
  title: string;
  description: string;
  priority: IncidentPriority;
  category: IncidentCategory;
}>;

export type ListIncidentsFilters = {
  page?: number;
  pageSize?: number;
  status?: IncidentStatus[];
  priority?: IncidentPriority;
  category?: IncidentCategory;
  propertyId?: string;
  apartmentId?: string;
  assignedToUserId?: string;
  /** Filtre virtuel status IN (OPEN, ASSIGNED), DEC-059 section 10.1. */
  toProcess?: boolean;
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: 'Nouveau',
  ASSIGNED: 'Affecté',
  IN_PROGRESS: 'En cours',
  ON_HOLD: 'En attente',
  RESOLVED: 'Résolu',
  CLOSED: 'Clôturé',
};

export const INCIDENT_PRIORITY_LABELS: Record<IncidentPriority, string> = {
  LOW: 'Basse',
  NORMAL: 'Normale',
  URGENT: 'Urgente',
};

export const INCIDENT_CATEGORY_LABELS: Record<IncidentCategory, string> = {
  PLUMBING: 'Plomberie',
  ELECTRICITY: 'Électricité',
  AIR_CONDITIONING: 'Climatisation',
  LOCKS_AND_KEYS: 'Serrurerie',
  OTHER: 'Autre',
};

export type CreateIncidentInput = {
  title: string;
  description: string;
  priority: IncidentPriority;
  category: IncidentCategory;
  apartmentId: string;
};

/** Appelle l'API POST /api/v1/incidents pour déclarer un incident (DEC-059). */
export async function createIncidentRequest(input: CreateIncidentInput): Promise<Response> {
  return fetch('/api/v1/incidents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  });
}

/** Appelle l'API GET /api/v1/incidents pour lister les incidents avec filtres. */
export async function listIncidentsRequest(filters: ListIncidentsFilters = {}): Promise<Response> {
  const params = new URLSearchParams();

  if (filters.page !== undefined) params.set('page', String(filters.page));
  if (filters.pageSize !== undefined) params.set('pageSize', String(filters.pageSize));
  if (filters.status) for (const status of filters.status) params.append('status', status);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.category) params.set('category', filters.category);
  if (filters.propertyId) params.set('propertyId', filters.propertyId);
  if (filters.apartmentId) params.set('apartmentId', filters.apartmentId);
  if (filters.assignedToUserId) params.set('assignedToUserId', filters.assignedToUserId);
  if (filters.toProcess) params.set('toProcess', 'true');

  const query = params.toString();
  const url = query ? `/api/v1/incidents?${query}` : '/api/v1/incidents';

  return fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
}

/** Appelle l'API GET /api/v1/incidents/[id] pour consulter un incident. */
export async function getIncidentRequest(incidentId: string): Promise<Response> {
  return fetch(`/api/v1/incidents/${encodeURIComponent(incidentId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
}

/** Appelle l'API PATCH /api/v1/incidents/[id] pour modifier les champs descriptifs (DEC-059, 4.5). */
export async function updateIncidentRequest(
  incidentId: string,
  fields: UpdateIncidentFields,
): Promise<Response> {
  return fetch(`/api/v1/incidents/${encodeURIComponent(incidentId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(fields),
  });
}

/** Appelle l'API PATCH /api/v1/incidents/[id]/status pour une transition (DEC-017). */
export async function transitionStatusRequest(
  incidentId: string,
  toStatus: IncidentStatus,
  reason: string | null = null,
): Promise<Response> {
  return fetch(`/api/v1/incidents/${encodeURIComponent(incidentId)}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ toStatus, reason: reason ?? undefined }),
  });
}

/** Appelle l'API PATCH /api/v1/incidents/[id]/assignment pour affecter l'incident (DEC-059, 4.4). */
export async function assignIncidentRequest(
  incidentId: string,
  assignedToUserId: string,
): Promise<Response> {
  return fetch(`/api/v1/incidents/${encodeURIComponent(incidentId)}/assignment`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ assignedToUserId }),
  });
}

/** Appelle l'API GET /api/v1/incidents/[id]/history pour l'historique des statuts. */
export async function listIncidentHistoryRequest(incidentId: string): Promise<Response> {
  return fetch(`/api/v1/incidents/${encodeURIComponent(incidentId)}/history`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
}

/** Appelle l'API GET /api/v1/incidents/[id]/comments pour lister les commentaires. */
export async function listCommentsRequest(incidentId: string): Promise<Response> {
  return fetch(`/api/v1/incidents/${encodeURIComponent(incidentId)}/comments`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
}

/** Appelle l'API POST /api/v1/incidents/[id]/comments pour ajouter un commentaire (DEC-059, 4.6). */
export async function addCommentRequest(incidentId: string, content: string): Promise<Response> {
  return fetch(`/api/v1/incidents/${encodeURIComponent(incidentId)}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ content }),
  });
}
