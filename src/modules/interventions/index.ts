/**
 * Surface publique du module Interventions (Lot 14, DEC-060).
 */
export type {
  InsertInterventionPayload,
  InterventionFull,
  InterventionListFilters,
  InterventionListResult,
  InterventionMinimal,
  InterventionProjection,
  InterventionsDatabase,
  UpdateInterventionFields,
  VisibleIncidentSummary,
} from './repository';
export {
  findInterventionById,
  insertInterventionTx,
  listInterventionsForContext,
  listInterventionStatusHistory,
  loadVisibleIncidentSummary,
  projectIntervention,
  transitionInterventionStatusTx,
  updateInterventionFieldsTx,
} from './repository';

export {
  InterventionNotFoundError,
  InterventionTerminalError,
  InterventionValidationError,
  InvalidTransitionError,
  MissingActualCostError,
  MissingReasonError,
  type FieldErrors,
} from './errors';

export { ALLOWED_TRANSITIONS, isTransitionAllowed, type InterventionStatus } from './transitions';

export {
  createIntervention,
  getIntervention,
  listHistory,
  listInterventions,
  listInterventionsForIncident,
  transitionStatus,
  updateIntervention,
} from './service';

export {
  createInterventionSchema,
  listInterventionsQuerySchema,
  parseCreateIntervention,
  parseListInterventionsQuery,
  parseTransitionStatus,
  parseUpdateIntervention,
  transitionStatusSchema,
  updateInterventionSchema,
  type CreateInterventionInput,
  type ListInterventionsQuery,
  type TransitionStatusInput,
  type UpdateInterventionInput,
} from './schemas';
