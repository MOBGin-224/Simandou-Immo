import type { Intervention } from '@/db/schema';

/** Valeurs de `intervention_status` (DEC-018, DEC-021), tel qu'inféré du schéma. */
export type InterventionStatus = Intervention['status'];

/**
 * Transitions autorisées du cycle de l'intervention (DEC-018, DEC-060 4.2).
 *
 * `COMPLETED` et `CANCELLED` sont terminaux (DEC-060, 4.6) : aucune transition
 * sortante. Le passage direct de `PLANNED` à `COMPLETED` est interdit
 * (DEC-060, 4.3) : `IN_PROGRESS` est un palier obligatoire.
 */
export const ALLOWED_TRANSITIONS: Record<InterventionStatus, InterventionStatus[]> = {
  PLANNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function isTransitionAllowed(from: InterventionStatus, to: InterventionStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
