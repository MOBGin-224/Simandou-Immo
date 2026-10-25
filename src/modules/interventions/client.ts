/**
 * Surface du module Interventions réservée à l'interface client (Lot 14,
 * DEC-060).
 *
 * Ce fichier ne réexporte QUE des constantes, des types et des fonctions
 * utilisables côté navigateur, sans charger de dépendance serveur ni de base
 * de données. Même principe que `src/modules/incidents/client.ts`.
 */

export type InterventionStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

/**
 * Forme minimale, telle que reçue par un TENANT (DEC-060, 8.2) : ni coûts, ni
 * prestataire, ni affectation interne. Les champs absents de cette forme ne
 * sont pas `null` dans la réponse API, ils n'existent simplement pas dans
 * l'objet JSON : `isFullIntervention` le vérifie par présence de clé.
 */
export type InterventionItem = {
  id: string;
  title: string;
  description: string;
  status: InterventionStatus;
  plannedFor: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  apartmentNumber: string | null;
  propertyName: string;
  incidentTitle: string | null;
};

/** Forme complète, réservée à MANAGER et OWNER (DEC-060, 8.2). */
export type InterventionFull = InterventionItem & {
  organizationId: string;
  organizationName: string;
  propertyId: string;
  apartmentId: string | null;
  incidentId: string | null;
  createdByUserId: string;
  createdByName: string;
  assignedToUserId: string | null;
  assignedToName: string | null;
  providerName: string | null;
  providerPhone: string | null;
  estimatedCost: number | null;
  actualCost: number | null;
};

/** La réponse porte-t-elle la forme complète (DEC-060, 8.2) ? */
export function isFullIntervention(
  item: InterventionItem | InterventionFull,
): item is InterventionFull {
  return 'providerName' in item;
}

export type InterventionStatusHistoryEntry = {
  id: string;
  interventionId: string;
  fromStatus: InterventionStatus | null;
  toStatus: InterventionStatus;
  byUserId: string;
  reason: string | null;
  createdAt: string;
};

export const INTERVENTION_STATUS_LABELS: Record<InterventionStatus, string> = {
  PLANNED: 'Planifiée',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
};

export type CreateInterventionInput = {
  title: string;
  description: string;
  propertyId: string;
  apartmentId: string | null;
  incidentId: string | null;
  providerName: string | null;
  providerPhone: string | null;
  plannedFor: string | null;
  estimatedCost: number | null;
  assignedToUserId: string | null;
};

export type UpdateInterventionFields = Partial<{
  title: string;
  description: string;
  providerName: string | null;
  providerPhone: string | null;
  plannedFor: string | null;
  estimatedCost: number | null;
  apartmentId: string | null;
  assignedToUserId: string | null;
}>;

export type ListInterventionsFilters = {
  page?: number;
  pageSize?: number;
  status?: InterventionStatus[];
  propertyId?: string;
  apartmentId?: string;
  incidentId?: string;
  assignedToUserId?: string;
};

/** Appelle l'API GET /api/v1/interventions pour lister les interventions avec filtres. */
export async function listInterventionsRequest(
  filters: ListInterventionsFilters = {},
): Promise<Response> {
  const params = new URLSearchParams();

  if (filters.page !== undefined) params.set('page', String(filters.page));
  if (filters.pageSize !== undefined) params.set('pageSize', String(filters.pageSize));
  if (filters.status) for (const status of filters.status) params.append('status', status);
  if (filters.propertyId) params.set('propertyId', filters.propertyId);
  if (filters.apartmentId) params.set('apartmentId', filters.apartmentId);
  if (filters.incidentId) params.set('incidentId', filters.incidentId);
  if (filters.assignedToUserId) params.set('assignedToUserId', filters.assignedToUserId);

  const query = params.toString();
  const url = query ? `/api/v1/interventions?${query}` : '/api/v1/interventions';

  return fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
}

/** Appelle l'API GET /api/v1/interventions/[id] pour consulter une intervention. */
export async function getInterventionRequest(interventionId: string): Promise<Response> {
  return fetch(`/api/v1/interventions/${encodeURIComponent(interventionId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
}

/** Appelle l'API POST /api/v1/interventions pour créer une intervention (DEC-060, 8.1). */
export async function createInterventionRequest(input: CreateInterventionInput): Promise<Response> {
  return fetch('/api/v1/interventions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  });
}

/** Appelle l'API PATCH /api/v1/interventions/[id] pour modifier les champs autorisés (DEC-060, 8.3). */
export async function updateInterventionRequest(
  interventionId: string,
  fields: UpdateInterventionFields,
): Promise<Response> {
  return fetch(`/api/v1/interventions/${encodeURIComponent(interventionId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(fields),
  });
}

/**
 * Appelle l'API PATCH /api/v1/interventions/[id]/status pour une transition
 * (DEC-018, DEC-060 sections 4.4 et 4.5). `reason` n'est exigé que pour
 * CANCELLED, `actualCost` que pour COMPLETED : le serveur le revalide de
 * toute façon, cette fonction transmet simplement ce qu'on lui donne.
 */
export async function transitionStatusRequest(
  interventionId: string,
  toStatus: InterventionStatus,
  reason: string | null = null,
  actualCost: number | null = null,
): Promise<Response> {
  return fetch(`/api/v1/interventions/${encodeURIComponent(interventionId)}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      toStatus,
      reason: reason ?? undefined,
      actualCost: actualCost ?? undefined,
    }),
  });
}

/** Appelle l'API GET /api/v1/interventions/[id]/history pour l'historique des statuts. */
export async function listHistoryRequest(interventionId: string): Promise<Response> {
  return fetch(`/api/v1/interventions/${encodeURIComponent(interventionId)}/history`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
}

/** Appelle l'API GET /api/v1/interventions/by-incident/[incidentId] (DEC-060, 3.5). */
export async function listByIncidentRequest(incidentId: string): Promise<Response> {
  return fetch(`/api/v1/interventions/by-incident/${encodeURIComponent(incidentId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
}
