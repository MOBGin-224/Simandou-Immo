import type { InterventionStatus } from './transitions';

export class InterventionNotFoundError extends Error {
  constructor() {
    super('INTERVENTION_NOT_FOUND');
    this.name = 'InterventionNotFoundError';
  }
}

/** DEC-060, 4.2 : la transition demandée ne figure pas dans `ALLOWED_TRANSITIONS`. */
export class InvalidTransitionError extends Error {
  constructor(
    readonly from: InterventionStatus,
    readonly to: InterventionStatus,
  ) {
    super(`La transition de ${from} vers ${to} n est pas autorisee.`);
    this.name = 'InvalidTransitionError';
  }
}

/** DEC-060, 4.5 : la transition vers COMPLETED exige un coût réel renseigné. */
export class MissingActualCostError extends Error {
  constructor() {
    super('La transition vers COMPLETED exige un cout reel renseigne.');
    this.name = 'MissingActualCostError';
  }
}

/** DEC-060, 4.4 : la transition vers CANCELLED exige un motif. */
export class MissingReasonError extends Error {
  constructor() {
    super('La transition vers CANCELLED exige un motif.');
    this.name = 'MissingReasonError';
  }
}

/** DEC-060, 4.6 et 8.3 : une intervention COMPLETED ou CANCELLED ne se modifie plus. */
export class InterventionTerminalError extends Error {
  constructor() {
    super('Une intervention COMPLETED ou CANCELLED ne se modifie plus.');
    this.name = 'InterventionTerminalError';
  }
}

export type FieldErrors = Record<string, string[]>;

/** Paramètres de requête ou de corps invalides (création, modification, filtres). */
export class InterventionValidationError extends Error {
  constructor(readonly fieldErrors: FieldErrors) {
    super('Les données fournies sont invalides.');
    this.name = 'InterventionValidationError';
  }
}
