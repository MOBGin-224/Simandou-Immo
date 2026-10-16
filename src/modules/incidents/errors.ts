import type { IncidentStatus } from './transitions';

export class IncidentNotFoundError extends Error {
  constructor() {
    super('INCIDENT_NOT_FOUND');
    this.name = 'IncidentNotFoundError';
  }
}

/** DEC-059, 4.5 : un incident CLOSED ne se modifie plus. */
export class IncidentClosedError extends Error {
  constructor() {
    super('INCIDENT_CLOSED');
    this.name = 'IncidentClosedError';
  }
}

/** DEC-017 : la transition demandée ne figure pas dans `ALLOWED_TRANSITIONS`. */
export class InvalidTransitionError extends Error {
  constructor(
    readonly from: IncidentStatus,
    readonly to: IncidentStatus,
  ) {
    super(`La transition de ${from} vers ${to} n est pas autorisee.`);
    this.name = 'InvalidTransitionError';
  }
}

/** DEC-059, 4.4 et 2.1 : le passage a ASSIGNED exige une affectation deja renseignee. */
export class MissingAssignmentError extends Error {
  constructor() {
    super('Le passage au statut ASSIGNED exige une affectation prealable.');
    this.name = 'MissingAssignmentError';
  }
}

/** DEC-059, 6.3 et 8.3 : la transition RESOLVED -> IN_PROGRESS exige un motif. */
export class MissingReasonError extends Error {
  constructor() {
    super('La transition de RESOLVED vers IN_PROGRESS exige un motif.');
    this.name = 'MissingReasonError';
  }
}
