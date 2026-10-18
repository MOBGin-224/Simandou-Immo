/**
 * Surface publique du module Incidents (Lot 13, DEC-059).
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
  addComment,
  assignIncident,
  createIncident,
  getIncident,
  listComments,
  listHistory,
  listIncidents,
  transitionStatus,
  updateIncident,
} from './service';

export {
  IncidentClosedError,
  IncidentNotFoundError,
  IncidentValidationError,
  InvalidTransitionError,
  MissingAssignmentError,
  MissingReasonError,
  type FieldErrors,
} from './errors';

export { ALLOWED_TRANSITIONS, isTransitionAllowed, type IncidentStatus } from './transitions';

export {
  addCommentSchema,
  assignIncidentSchema,
  createIncidentSchema,
  listIncidentsQuerySchema,
  parseAddComment,
  parseAssignIncident,
  parseCreateIncident,
  parseListIncidentsQuery,
  parseTransitionStatus,
  parseUpdateIncident,
  transitionStatusSchema,
  updateIncidentSchema,
  type AddCommentInput,
  type AssignIncidentInput,
  type CreateIncidentInput,
  type ListIncidentsQuery,
  type TransitionStatusInput,
  type UpdateIncidentInput,
} from './schemas';
