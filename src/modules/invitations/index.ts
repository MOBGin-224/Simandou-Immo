/**
 * Surface publique du noyau Invitations (MVP-ENG-002, ADR-008).
 *
 * Le noyau ne contient que des règles PURES : le jeton, l'expiration, le lien. La
 * persistance et les cas d'usage vivent dans le module qui invite, aujourd'hui
 * `managers`, demain `tenants` (Lot 7), qui réutiliseront ces mêmes règles sans
 * les réécrire.
 */

export type { GeneratedInvitationToken } from './token';
export {
  INVITATION_TOKEN_BYTES,
  INVITATION_TOKEN_PATTERN,
  generateInvitationToken,
  hashInvitationToken,
  isWellFormedInvitationToken,
} from './token';

export type { InvitationStatus, InvitationTiming } from './domain';
export {
  buildInvitationLink,
  effectiveInvitationStatus,
  invitationExpiry,
  invitationPath,
  isInvitationOpen,
} from './domain';
