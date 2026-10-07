/**
 * Surface publique du noyau Invitations (MVP-ENG-002, ADR-008).
 *
 * Le noyau ne contient que des règles PURES, et les erreurs qui les accompagnent :
 * le jeton, l'expiration, le lien, le mode d'aperçu, les refus qui ne dépendent
 * d'aucun rôle. La persistance et les cas d'usage vivent dans le module qui
 * invite, `managers` au Lot 6 et `tenants` au Lot 7, qui réutilisent ces mêmes
 * règles sans les réécrire (DEC-046).
 */

export type { GeneratedInvitationToken } from './token';
export {
  INVITATION_TOKEN_BYTES,
  INVITATION_TOKEN_PATTERN,
  generateInvitationToken,
  hashInvitationToken,
  isWellFormedInvitationToken,
} from './token';

export type { InvitationPreviewMode, InvitationStatus, InvitationTiming } from './domain';
export {
  buildInvitationLink,
  effectiveInvitationStatus,
  invitationExpiry,
  invitationPath,
  invitationPreviewMode,
  isInvitationOpen,
} from './domain';

export type { InvitationNotOpenReason } from './errors';
export {
  InvitationInvalidError,
  InvitationLoginRequiredError,
  InvitationNotOpenError,
  InvitationTargetUnavailableError,
} from './errors';

export { passwordConfirmationError } from './form';
