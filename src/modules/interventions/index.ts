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
} from './repository';
export {
  findInterventionById,
  insertInterventionTx,
  listInterventionsForContext,
  listInterventionsForIncident,
  listInterventionStatusHistory,
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
