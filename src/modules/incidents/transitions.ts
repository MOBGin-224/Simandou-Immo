import type { Incident } from '@/db/schema';

/** Valeurs de `incident_status` (DEC-021), tel qu'inféré du schéma. */
export type IncidentStatus = Incident['status'];

/**
 * Transitions autorisées du cycle de l'incident (DEC-017).
 *
 * `CLOSED` n'a aucune transition sortante : un incident clôturé ne se rouvre
 * pas (DEC-059, 8.2). `RESOLVED -> IN_PROGRESS` reste ouverte pour le cas
 * d'une résolution insuffisante (DEC-059, section 8), avec motif obligatoire
 * côté service (DEC-059, 6.3).
 */
export const ALLOWED_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  OPEN: ['ASSIGNED', 'IN_PROGRESS', 'CLOSED'],
  ASSIGNED: ['IN_PROGRESS', 'ON_HOLD', 'CLOSED'],
  IN_PROGRESS: ['ON_HOLD', 'RESOLVED', 'CLOSED'],
  ON_HOLD: ['IN_PROGRESS', 'CLOSED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
};

export function isTransitionAllowed(from: IncidentStatus, to: IncidentStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
