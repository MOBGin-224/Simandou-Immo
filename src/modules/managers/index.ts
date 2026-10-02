/**
 * Surface publique du module Gestionnaires (MVP-ENG-002).
 *
 * Les autres modules et les routes importent CE fichier, jamais un fichier
 * interne : un module ne doit pas dépendre de l'implémentation d'un autre.
 *
 * Le dépôt de données n'est volontairement pas réexporté. Y accéder de
 * l'extérieur permettrait de lire des gestionnaires sans passer par le contrôle
 * d'accès, ce qui est exactement ce que ce découpage empêche.
 */

export type {
  AcceptedInvitation,
  InvitationPreview,
  InvitationPreviewMode,
  IssuedInvitation,
  ManagerDetailView,
  ManagerInvitationView,
  ManagerListItem,
  ManagerPropertyRef,
} from './domain';
export { compareManagerItems } from './domain';

export type {
  FieldErrors,
  InvitationNotOpenReason,
  ManagerAccessStatus,
  ManagerAction,
  ManagerInvitationConflictReason,
} from './errors';
export {
  InvitationInvalidError,
  InvitationLoginRequiredError,
  InvitationNotOpenError,
  InvitationTargetUnavailableError,
  ManagerInvitationConflictError,
  ManagerStateError,
  ManagerValidationError,
} from './errors';

/**
 * Les constantes viennent de `constants.ts` et non de `schemas.ts` : elles sont
 * aussi exposées à l'interface par `client.ts`, qui ne doit rien entraîner de
 * serveur derrière lui.
 */
export type { ManagerListKind, ManagerListStatus } from './constants';
export {
  MANAGER_EMAIL_MAX_LENGTH,
  MANAGER_LIST_STATUSES,
  MANAGER_NAME_MAX_LENGTH,
  MANAGER_PROPERTIES_MAX,
} from './constants';

export type { AcceptInvitationInput, InviteManagerInput, UpdateManagerScopeInput } from './schemas';
export { acceptInvitationSchema, inviteManagerSchema, updateManagerScopeSchema } from './schemas';

export type { ManagersDatabase } from './repository';

export type {
  AcceptInvitationDependencies,
  ManagerCollection,
  ManagerServiceOptions,
} from './service';
export {
  acceptManagerInvitation,
  getManager,
  getManagerInvitation,
  inviteManager,
  listManagers,
  previewInvitation,
  reactivateManager,
  resendManagerInvitation,
  revokeManager,
  revokeManagerInvitation,
  suspendManager,
  updateManagerScope,
} from './service';
