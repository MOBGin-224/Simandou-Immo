/**
 * Surface publique du module Locataires (MVP-ENG-002).
 *
 * Les autres modules et les routes importent CE fichier, jamais un fichier
 * interne : un module ne doit pas dépendre de l'implémentation d'un autre.
 *
 * Le dépôt de données n'est volontairement pas réexporté. Y accéder de
 * l'extérieur permettrait de lire des locataires sans passer par le contrôle
 * d'accès, ce qui est exactement ce que ce découpage empêche.
 *
 * Les erreurs communes à toute invitation ne sont pas réexportées ici : elles
 * appartiennent au noyau `invitations` (DEC-046), et s'importent de là.
 */

export type {
  AcceptedTenantInvitation,
  ApartmentSource,
  IssuedTenantInvitation,
  TenantApartmentRef,
  TenantDetailView,
  TenantInvitationPreview,
  TenantInvitationView,
  TenantListItem,
} from './domain';
export { compareTenantItems, describeApartment, hasProductAccess } from './domain';

export type {
  FieldErrors,
  TenantAccessStatus,
  TenantAction,
  TenantInvitationConflictReason,
} from './errors';
export {
  TenantInvitationConflictError,
  TenantNameNotOwnedError,
  TenantNoAccessError,
  TenantOrganizationRequiredError,
  TenantStateError,
  TenantValidationError,
} from './errors';

/**
 * Les constantes viennent de `constants.ts` et non de `schemas.ts` : elles sont
 * aussi exposées à l'interface par `client.ts`, qui ne doit rien entraîner de
 * serveur derrière lui.
 */
export type { TenantListFilter, TenantListStatus } from './constants';
export {
  TENANT_EMAIL_MAX_LENGTH,
  TENANT_LIST_DEFAULT_PAGE_SIZE,
  TENANT_LIST_FILTERS,
  TENANT_LIST_MAX_PAGE_SIZE,
  TENANT_LIST_STATUSES,
  TENANT_NAME_MAX_LENGTH,
} from './constants';

export type {
  AcceptTenantInvitationInput,
  InviteTenantInput,
  ListTenantsQuery,
  TenantPersonInput,
  UpdateTenantInput,
} from './schemas';
export {
  acceptTenantInvitationSchema,
  inviteTenantSchema,
  listTenantsQuerySchema,
  tenantPersonSchema,
  updateTenantSchema,
} from './schemas';

export type { TenantsDatabase } from './repository';

export type {
  AcceptTenantInvitationDependencies,
  TenantCollection,
  TenantRelationshipOptions,
  TenantServiceOptions,
} from './service';
export {
  acceptTenantInvitation,
  getMyTenantSpace,
  getTenant,
  getTenantInvitation,
  inviteTenant,
  listTenants,
  previewTenantInvitation,
  reactivateTenant,
  resendTenantInvitation,
  /**
   * Exposée pour le module Contrats, qui crée la personne depuis le bail
   * (DEC-051, Lot 8b). Elle n'écrit que dans `users` et ne vérifie aucune
   * permission : son docblock dit pourquoi, et elle exige une transaction.
   */
  resolveTenantPerson,
  revokeTenant,
  revokeTenantInvitation,
  suspendTenant,
  updateTenant,
} from './service';
