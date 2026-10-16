/**
 * Surface publique du module Incidents (Lot 13, DEC-059).
 *
 * Aucun service n'existe encore : seuls le dépôt et ses helpers sont
 * exportés à ce stade.
 */
export type {
  IncidentCommentWithAuthor,
  IncidentListFilters,
  IncidentListResult,
  IncidentsDatabase,
  IncidentWithRelations,
  InsertIncidentPayload,
  UpdateIncidentFields,
} from './repository';
export {
  findIncidentById,
  insertIncidentCommentTx,
  insertIncidentTx,
  listIncidentComments,
  listIncidentsForContext,
  listIncidentStatusHistory,
  transitionIncidentStatusTx,
  updateIncidentAssignmentTx,
  updateIncidentFieldsTx,
} from './repository';

export {
  IncidentClosedError,
  IncidentNotFoundError,
  InvalidTransitionError,
  MissingAssignmentError,
  MissingReasonError,
} from './errors';

export { ALLOWED_TRANSITIONS, isTransitionAllowed, type IncidentStatus } from './transitions';
