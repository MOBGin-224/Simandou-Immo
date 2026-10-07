import { z } from 'zod';

import type { User, UserAccess } from '@/db/schema';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  endAllSessionsOf,
  writeCredential,
} from '@/lib/auth';
import {
  PermissionDeniedError,
  ResourceOutOfScopeError,
  evaluate,
  readablePropertyScopes,
  requirePermission,
  type AccessContext,
  type Permission,
  type PropertyScope,
} from '@/lib/authorization';
import { getEnv } from '@/lib/env';
import {
  InvitationInvalidError,
  InvitationLoginRequiredError,
  InvitationNotOpenError,
  InvitationTargetUnavailableError,
  buildInvitationLink,
  effectiveInvitationStatus,
  generateInvitationToken,
  hashInvitationToken,
  invitationExpiry,
  invitationPreviewMode,
  isInvitationOpen,
  isWellFormedInvitationToken,
  type InvitationNotOpenReason,
} from '@/modules/invitations';

import type { TenantListStatus } from './constants';
import {
  compareTenantItems,
  type AcceptedTenantInvitation,
  type ApartmentSource,
  type IssuedTenantInvitation,
  type TenantApartmentRef,
  type TenantDetailView,
  type TenantInvitationPreview,
  type TenantInvitationView,
  type TenantListItem,
} from './domain';
import {
  TenantInvitationConflictError,
  TenantNameNotOwnedError,
  TenantNoAccessError,
  TenantOrganizationRequiredError,
  TenantStateError,
  TenantValidationError,
} from './errors';
import {
  OPEN_INVITATION_CONSTRAINT,
  activateUser,
  claimInvitation,
  countActiveAccesses,
  findApartmentById,
  findApartmentsByIds,
  findInvitationById,
  findInvitationByTokenHash,
  findOrganizationName,
  findOrganizationNames,
  findStoredOpenInvitation,
  findTenantAccess,
  findTenantAccessFor,
  findUserByEmail,
  findUserById,
  findUserByPhone,
  insertPendingUser,
  insertTenantAccess,
  insertTenantInvitation,
  isOrganizationOwner,
  isUniqueViolation,
  listAcceptedInvitationRows,
  listPendingInvitationRows,
  listTenantAccessRows,
  listTenantLeaseRows,
  markInvitationExpired,
  reactivateRevokedAccess,
  revokeInvitationRow,
  rotateInvitationToken,
  transitionAccess,
  updatePendingUser,
  updateUserFullName,
  type ApartmentRow,
  type TenantsDatabase,
} from './repository';
import {
  acceptTenantInvitationSchema,
  inviteTenantSchema,
  listTenantsQuerySchema,
  updateTenantSchema,
} from './schemas';

/**
 * Cas d'usage du module Locataires (MVP-BACKLOG-028 à 031, API sections 15 et 16).
 *
 * Chaque fonction suit l'ordre imposé par API-001, sans exception :
 *
 * ```text
 * Authentification  déjà faite, le contexte d'accès la présuppose
 * ↓
 * Validation        schéma Zod, ici et non chez l'appelant
 * ↓
 * Périmètre         logement, immeuble et permission, par le point de décision unique
 * ↓
 * Règle métier      doublons, états, logement recevable
 * ↓
 * Persistance       en transaction dès qu'il y a plus d'une écriture
 * ```
 *
 * **Ce qu'est un locataire** (DEC-051) : une PERSONNE qui a une relation locative
 * avec l'organisation, qu'elle utilise l'application ou non. Son identité métier
 * est `users.id`. `user_access` n'est pas cette identité : c'est un DROIT D'ACCÈS
 * au produit, qui peut être absent, suspendu ou révoqué sans que la personne
 * cesse d'être locataire. Aucune table `tenant_profiles` n'existe, et aucune n'est
 * créée : l'identité vit dans `users`, le droit dans `user_access`, la relation
 * locative dans `leases`, et l'invitation garde la trace de l'ouverture d'accès.
 *
 * Conséquence pratique : un locataire SANS COMPTE existe, au statut `NO_ACCESS`,
 * et les opérations d'accès, suspendre, réactiver, révoquer, lui opposent
 * `TenantNoAccessError` plutôt que d'inventer un droit à modifier.
 *
 * **La ressource est le COUPLE personne et organisation.** `users.id` ne porte pas
 * l'organisation, à dessein : la même personne peut être locataire chez deux
 * bailleurs. Quand une seule organisation lisible par l'appelant la connaît, elle
 * est déduite ; quand plusieurs la connaissent, le produit ne devine pas, il
 * demande, par `TenantOrganizationRequiredError`.
 *
 * **D'où viennent ces relations.** Trois traces les révèlent, et chacune suffit :
 * un `user_access`, une invitation encore ouverte, un bail. Les trois sont lues
 * puis fusionnées par `assembleRelationships`, qui est le seul endroit où cette
 * définition est écrite.
 *
 * **D'où vient le périmètre.** Un gestionnaire n'a d'autorité que sur ses
 * immeubles (ADR-007). Le lien entre un locataire et un immeuble vient du BAIL en
 * cours, et à défaut de son invitation, qui le portait avant que le bail existe
 * (DEC-046). `apartmentSource` dit laquelle des deux a parlé, afin qu'un écran
 * n'ait jamais à le deviner.
 *
 * Aucune fonction ne reçoit ni `Request`, ni `FormData`, ni composant : ce module
 * est testable contre une vraie base sans monter de serveur.
 */

/**
 * Réglages d'un appel, tous facultatifs.
 *
 * Existent pour la TESTABILITÉ : fixer l'instant courant, la durée de validité et
 * l'adresse du site permet de tester une expiration sans attendre sept jours. En
 * production rien n'est fourni, et la configuration d'environnement s'applique.
 */
export type TenantServiceOptions = {
  now?: Date;
  ttlDays?: number;
  appUrl?: string;
};

function nowOf(options: TenantServiceOptions): Date {
  return options.now ?? new Date();
}

/** Réglages d'émission d'un lien. L'environnement n'est lu que s'il le faut. */
function issuingSettings(options: TenantServiceOptions) {
  const needsEnv = options.ttlDays === undefined || options.appUrl === undefined;
  const env = needsEnv ? getEnv() : undefined;

  return {
    now: nowOf(options),
    ttlDays: options.ttlDays ?? env?.INVITATION_TTL_DAYS ?? 7,
    appUrl: options.appUrl ?? env?.APP_URL ?? '',
  };
}

function parseOrThrow<Schema extends z.ZodType>(schema: Schema, input: unknown): z.output<Schema> {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new TenantValidationError(
      z.flattenError(result.error).fieldErrors as Record<string, string[]>,
    );
  }

  return result.data;
}

/** Vue d'un logement, telle que les écrans la lisent. */
function refOf(row: ApartmentRow): TenantApartmentRef {
  return {
    id: row.id,
    number: row.number,
    propertyId: row.propertyId,
    propertyName: row.propertyName,
    archived: row.archivedAt !== null,
  };
}

// --- Logement visé par une invitation ---------------------------------------------

/**
 * Logement sur lequel l'appelant peut agir, ou refus indiscernable d'une absence.
 *
 * Un logement inexistant, mal identifié, d'une autre organisation ou hors du
 * périmètre reçoivent le MÊME refus (ADR-008, API section 16). Un logement
 * archivé, ou dont l'immeuble est archivé, est refusé par une erreur de
 * validation sur le champ : celui-là, l'appelant le voit bien dans ses écrans, et
 * lui dire « introuvable » serait trompeur.
 */
async function loadInvitableApartment(
  db: TenantsDatabase,
  context: AccessContext,
  apartmentId: string,
): Promise<ApartmentRow> {
  const apartment = await findApartmentById(db, apartmentId);

  if (!apartment) throw new ResourceOutOfScopeError();

  requirePermission(context, 'tenant.invite', {
    organizationId: apartment.organizationId,
    propertyId: apartment.propertyId,
  });

  if (apartment.archivedAt !== null || apartment.propertyArchivedAt !== null) {
    throw new TenantValidationError({
      apartmentId: ['Ce logement est archivé : il ne peut pas recevoir de locataire.'],
    });
  }

  return apartment;
}

// --- Invitation d'un locataire ------------------------------------------------------

/** Refuse une adresse email déjà portée par un AUTRE compte. */
async function assertEmailFree(
  db: TenantsDatabase,
  email: string | null,
  ownerId: string | null,
): Promise<void> {
  if (email === null) return;

  const holder = await findUserByEmail(db, email);

  if (holder && holder.id !== ownerId) {
    // Le message ne dit pas à qui appartient l'adresse, ni même qu'elle appartient
    // à un compte : il dit seulement qu'on ne peut pas l'employer ici.
    throw new TenantValidationError({ email: ['Cette adresse email ne peut pas être utilisée.'] });
  }
}

/**
 * Personne visée par un nom et un numéro : réutilisée si elle existe, créée
 * sinon (BR-009, DEC-041).
 *
 * Le numéro de téléphone est UNIQUE : viser un numéro déjà connu ne peut pas
 * créer un second compte, il faut réutiliser celui qui existe. Ce que cela change
 * selon l'état du compte existant est consigné par DEC-041, et vaut pour un
 * locataire comme pour un gestionnaire :
 *
 *   en attente d'activation  réutilisé, son nom et son email sont mis à jour : nul
 *                            n'a pu s'y authentifier, donc nul ne peut s'étonner
 *   actif                    réutilisé TEL QUEL, le nom saisi est ignoré : il
 *                            appartient à la personne, pas à celui qui l'invite
 *   suspendu ou archivé      refusé
 *
 * **Cette règle est la SEULE du produit**, et c'est pourquoi elle ne porte plus
 * le nom de l'invitation : depuis le Lot 8b, créer un bail peut aussi créer la
 * personne, sans invitation (DEC-051). Si les deux chemins avaient chacun leur
 * règle, le même numéro finirait par désigner deux personnes.
 */
async function resolvePerson(
  db: TenantsDatabase,
  data: { name: string; phone: string; email: string | null },
): Promise<User> {
  const existing = await findUserByPhone(db, data.phone);

  if (existing) {
    if (existing.archivedAt !== null || existing.status === 'SUSPENDED') {
      throw new InvitationTargetUnavailableError();
    }

    if (existing.status === 'PENDING_ACTIVATION') {
      const email = data.email ?? existing.email;

      await assertEmailFree(db, email, existing.id);

      const updated = await updatePendingUser(db, existing.id, { fullName: data.name, email });

      return updated ?? existing;
    }

    return existing;
  }

  await assertEmailFree(db, data.email, null);

  return insertPendingUser(db, { fullName: data.name, phone: data.phone, email: data.email });
}

/**
 * La personne peut-elle recevoir une invitation de locataire de cette organisation ?
 *
 * Un locataire RÉVOQUÉ le peut (DEC-043) : c'est ce qui lui permet de revenir. Un
 * locataire actif ou suspendu ne le peut pas, ni le propriétaire de
 * l'organisation.
 *
 * **Ce contrôle n'est PAS la règle de simultanéité de DEC-049.** Celle-ci porte
 * sur la relation locative et s'appliquera au Lot 8, pas au niveau de
 * l'invitation : la décision le dit explicitement. Ici il s'agit seulement de
 * l'hygiène des invitations et des accès.
 *
 * Une invitation encore ouverte en base mais périmée est CLÔTURÉE ici : l'index
 * d'unicité partiel la compterait sinon comme ouverte, et empêcherait d'en
 * émettre une nouvelle alors qu'elle est inutilisable.
 */
async function assertCanBeInvited(
  db: TenantsDatabase,
  target: User,
  organizationId: string,
  now: Date,
): Promise<void> {
  if (await isOrganizationOwner(db, target.id, organizationId)) {
    throw new TenantInvitationConflictError('already-owner');
  }

  const access = await findTenantAccess(db, target.id, organizationId);

  if (access && (access.status === 'ACTIVE' || access.status === 'SUSPENDED')) {
    throw new TenantInvitationConflictError('already-tenant');
  }

  const open = await findStoredOpenInvitation(db, organizationId, target.id);

  if (open) {
    if (isInvitationOpen(open, now)) throw new TenantInvitationConflictError('invitation-open');

    await markInvitationExpired(db, open.id, now);
  }
}

/** Vue d'une invitation, avec l'identité de l'invité et le logement qu'elle désigne. */
async function toInvitationView(
  db: TenantsDatabase,
  invitation: Awaited<ReturnType<typeof findInvitationById>>,
  now: Date,
): Promise<TenantInvitationView> {
  if (!invitation) throw new ResourceOutOfScopeError();

  const target = invitation.targetUserId
    ? await findUserById(db, invitation.targetUserId)
    : undefined;
  const apartment = invitation.apartmentId
    ? await findApartmentById(db, invitation.apartmentId)
    : undefined;

  return {
    id: invitation.id,
    organizationId: invitation.organizationId,
    // L'identité métier de la personne invitée (DEC-051) : c'est elle qui
    // conduira à sa fiche de locataire une fois l'invitation acceptee.
    userId: invitation.targetUserId,
    fullName: target?.fullName ?? invitation.contact,
    phone: target?.phone ?? null,
    email: target?.email ?? null,
    status: effectiveInvitationStatus(invitation, now),
    issuedAt: invitation.issuedAt,
    expiresAt: invitation.expiresAt,
    apartment: apartment ? refOf(apartment) : null,
  };
}

/**
 * Invite un locataire (MVP-BACKLOG-029, parcours 7, DEC-046).
 *
 * Aucun envoi : le système génère l'invitation et son lien, et l'inviteur le
 * transmet lui-même (DEC-026). Le lien est renvoyé ICI, une seule fois : la base
 * ne conserve que le hachage du jeton.
 *
 * L'invitation porte le contexte locatif prévu (BR-014) : le logement et son
 * immeuble. **Elle ne change AUCUN statut d'occupation** : le logement garde le
 * sien, qui ne deviendra dérivé de la relation locative qu'au Lot 8 (DEC-050).
 * Elle ne crée non plus aucune ligne de périmètre d'immeubles.
 *
 * Tout se passe dans une transaction : le profil préliminaire et l'invitation. Un
 * profil sans invitation ne doit jamais subsister.
 */
export async function inviteTenant(
  db: TenantsDatabase,
  context: AccessContext,
  input: unknown,
  options: TenantServiceOptions = {},
): Promise<IssuedTenantInvitation> {
  const data = parseOrThrow(inviteTenantSchema, input);
  const apartment = await loadInvitableApartment(db, context, data.apartmentId);

  const { now, ttlDays, appUrl } = issuingSettings(options);
  const { token, tokenHash } = generateInvitationToken();

  try {
    const { invitation, target } = await db.transaction(async (tx) => {
      const invitee = await resolvePerson(tx, data);

      await assertCanBeInvited(tx, invitee, apartment.organizationId, now);

      const created = await insertTenantInvitation(tx, {
        organizationId: apartment.organizationId,
        invitedBy: context.userId,
        targetUserId: invitee.id,
        propertyId: apartment.propertyId,
        apartmentId: apartment.id,
        contact: data.phone,
        tokenHash,
        issuedAt: now,
        expiresAt: invitationExpiry(now, ttlDays),
      });

      return { invitation: created, target: invitee };
    });

    return {
      invitation: {
        id: invitation.id,
        organizationId: invitation.organizationId,
        userId: target.id,
        fullName: target.fullName,
        phone: target.phone,
        email: target.email,
        status: effectiveInvitationStatus(invitation, now),
        issuedAt: invitation.issuedAt,
        expiresAt: invitation.expiresAt,
        apartment: refOf(apartment),
      },
      token,
      link: buildInvitationLink(appUrl, token),
    };
  } catch (error) {
    // Deux demandes simultanées passent chacune le pré-contrôle : l'index
    // d'unicité partiel arbitre, et la perdante reçoit le même refus que si elle
    // était arrivée après.
    if (isUniqueViolation(error, OPEN_INVITATION_CONSTRAINT)) {
      throw new TenantInvitationConflictError('invitation-open');
    }

    throw error;
  }
}

// --- Gestion d'une invitation par son identifiant -----------------------------------

/**
 * Invitation de locataire accessible à l'appelant, ou refus indiscernable d'une
 * absence.
 *
 * Un identifiant inconnu, mal formé, d'une invitation de gestionnaire ou d'une
 * autre organisation lève la MÊME erreur (ADR-007). Le périmètre est résolu par
 * l'immeuble que l'invitation porte : c'est ce qui borne un gestionnaire à ses
 * immeubles.
 */
async function loadManageableInvitation(
  db: TenantsDatabase,
  context: AccessContext,
  invitationId: string,
  permission: Extract<Permission, 'tenant.read' | 'tenant.invite'>,
) {
  // Un identifiant qui n'est pas un UUID ne peut désigner aucune invitation. Sans
  // ce contrôle PostgreSQL refuserait la conversion et produirait une erreur
  // interne, là où la réponse correcte est « inexistant ».
  if (!z.uuid().safeParse(invitationId).success) throw new ResourceOutOfScopeError();

  const invitation = await findInvitationById(db, invitationId);

  if (!invitation || invitation.role !== 'TENANT') throw new ResourceOutOfScopeError();

  requirePermission(context, permission, {
    organizationId: invitation.organizationId,
    propertyId: invitation.propertyId,
  });

  return invitation;
}

/** Pourquoi une invitation n'est plus ouverte, d'après son statut STOCKÉ. */
function notOpenReason(status: 'ACCEPTED' | 'REVOKED' | 'EXPIRED'): InvitationNotOpenReason {
  if (status === 'ACCEPTED') return 'accepted';
  if (status === 'REVOKED') return 'revoked';

  // `EXPIRED` n'est écrit que lorsqu'une nouvelle invitation REMPLACE celle-ci :
  // l'expiration seule se dérive et ne se stocke pas (DEC-041).
  return 'superseded';
}

/** Consulte une invitation de locataire, sans son lien, que la base ne peut pas restituer. */
export async function getTenantInvitation(
  db: TenantsDatabase,
  context: AccessContext,
  invitationId: string,
  options: TenantServiceOptions = {},
): Promise<TenantInvitationView> {
  const invitation = await loadManageableInvitation(db, context, invitationId, 'tenant.read');

  return toInvitationView(db, invitation, nowOf(options));
}

/**
 * Renvoie une invitation : régénère son jeton dans la même ligne (DEC-045).
 *
 * Même identifiant, l'ancien lien invalidé à l'instant de l'écriture, la durée de
 * validité repartie de zéro (BR-013). C'est aussi, au MVP, le mécanisme de
 * récupération d'un lien perdu ou périmé (ADR-008).
 *
 * Une invitation expirée se renvoie : c'est précisément son usage. Une invitation
 * acceptée, révoquée ou remplacée ne se renvoie pas.
 */
export async function resendTenantInvitation(
  db: TenantsDatabase,
  context: AccessContext,
  invitationId: string,
  options: TenantServiceOptions = {},
): Promise<IssuedTenantInvitation> {
  const invitation = await loadManageableInvitation(db, context, invitationId, 'tenant.invite');

  if (invitation.status !== 'PENDING' && invitation.status !== 'SENT') {
    throw new InvitationNotOpenError(notOpenReason(invitation.status));
  }

  const { now, ttlDays, appUrl } = issuingSettings(options);
  const { token, tokenHash } = generateInvitationToken();

  const rotated = await rotateInvitationToken(db, invitation.id, {
    tokenHash,
    issuedAt: now,
    expiresAt: invitationExpiry(now, ttlDays),
  });

  if (!rotated) {
    // Acceptée ou révoquée entre la lecture et l'écriture : on relit pour dire le vrai motif.
    const current = await findInvitationById(db, invitation.id);

    if (current && current.status !== 'PENDING' && current.status !== 'SENT') {
      throw new InvitationNotOpenError(notOpenReason(current.status));
    }

    throw new ResourceOutOfScopeError();
  }

  return {
    invitation: await toInvitationView(db, rotated, now),
    token,
    link: buildInvitationLink(appUrl, token),
  };
}

/**
 * Révoque une invitation qui n'a pas été acceptée (SEC-INV-005).
 *
 * Le lien devient inutilisable aussitôt. C'est aussi le moyen prévu de corriger
 * un numéro ou un email mal saisi (DEC-048) : révoquer, puis réinviter.
 *
 * Une invitation déjà acceptée ne se révoque pas : c'est alors l'ACCÈS du
 * locataire qu'il faut révoquer, ce qui est une autre opération. Et ni l'une ni
 * l'autre ne termine un bail (DEC-047).
 */
export async function revokeTenantInvitation(
  db: TenantsDatabase,
  context: AccessContext,
  invitationId: string,
  options: TenantServiceOptions = {},
): Promise<TenantInvitationView> {
  const invitation = await loadManageableInvitation(db, context, invitationId, 'tenant.invite');

  if (invitation.status === 'ACCEPTED') throw new InvitationNotOpenError('accepted');
  if (invitation.status === 'REVOKED') throw new InvitationNotOpenError('revoked');

  const now = nowOf(options);
  const revoked = await revokeInvitationRow(db, invitation.id, now);

  if (!revoked) {
    const current = await findInvitationById(db, invitation.id);

    if (current && (current.status === 'ACCEPTED' || current.status === 'REVOKED')) {
      throw new InvitationNotOpenError(notOpenReason(current.status));
    }

    throw new ResourceOutOfScopeError();
  }

  return toInvitationView(db, revoked, now);
}

// --- Côté invité : aperçu et acceptation (routes PUBLIQUES) -------------------------

type ResolvedTenantInvitation = {
  invitation: NonNullable<Awaited<ReturnType<typeof findInvitationByTokenHash>>>;
  target: User;
  apartment: ApartmentRow;
};

/**
 * Invitation utilisable à partir d'un jeton, ou `InvitationInvalidError`.
 *
 * Route PUBLIQUE : le jeton est la SEULE preuve. Chaque échec lève la MÊME erreur
 * avec le même message (ADR-008) : jeton mal formé, inconnu, expiré, révoqué,
 * consommé, **d'un autre rôle**, compte indisponible, ou logement disparu ou
 * archivé depuis l'émission. Les distinguer apprendrait à qui essaie des jetons
 * au hasard, ou à qui détient un lien, ce qu'il en est advenu.
 *
 * Le filtre sur le rôle est ce qui rend un jeton de gestionnaire indiscernable
 * d'un jeton inconnu dans ce module, et réciproquement dans l'autre (DEC-046).
 */
async function resolveInvitation(
  db: TenantsDatabase,
  token: string,
  now: Date,
): Promise<ResolvedTenantInvitation> {
  if (!isWellFormedInvitationToken(token)) throw new InvitationInvalidError();

  const invitation = await findInvitationByTokenHash(db, hashInvitationToken(token));

  if (!invitation || invitation.role !== 'TENANT') throw new InvitationInvalidError();
  if (!isInvitationOpen(invitation, now)) throw new InvitationInvalidError();
  if (invitation.targetUserId === null) throw new InvitationInvalidError();
  if (invitation.apartmentId === null) throw new InvitationInvalidError();

  const target = await findUserById(db, invitation.targetUserId);

  if (!target || target.archivedAt !== null || target.status === 'SUSPENDED') {
    throw new InvitationInvalidError();
  }

  const apartment = await findApartmentById(db, invitation.apartmentId);

  if (
    !apartment ||
    apartment.organizationId !== invitation.organizationId ||
    apartment.archivedAt !== null ||
    apartment.propertyArchivedAt !== null
  ) {
    throw new InvitationInvalidError();
  }

  return { invitation, target, apartment };
}

/**
 * Ce que la page d'activation affiche à un locataire (parcours 9).
 *
 * Ne modifie rien : consulter un lien ne le consomme pas, un aperçu chargé par un
 * navigateur ou un lecteur de liens ne doit pas brûler l'invitation.
 *
 * Aucun montant n'y figure : il n'en existe aucun avant le bail (DEC-046).
 */
export async function previewTenantInvitation(
  db: TenantsDatabase,
  input: { token: string; sessionUserId?: string | null },
  options: TenantServiceOptions = {},
): Promise<TenantInvitationPreview> {
  const { invitation, target, apartment } = await resolveInvitation(
    db,
    input.token,
    nowOf(options),
  );

  const organizationName = (await findOrganizationName(db, invitation.organizationId)) ?? '';
  const inviter = await findUserById(db, invitation.invitedBy);
  const sessionUserId = input.sessionUserId ?? null;

  return {
    organizationName,
    inviterName: inviter?.fullName ?? '',
    inviteeName: target.fullName,
    phone: target.phone,
    apartmentLabel: apartment.number,
    propertyName: apartment.propertyName,
    expiresAt: invitation.expiresAt,
    mode: invitationPreviewMode(target, sessionUserId),
    signedInAsOther:
      invitationPreviewMode(target, sessionUserId) === 'SIGN_IN_REQUIRED' && sessionUserId !== null,
  };
}

/** Dépendances de l'acceptation qui touchent l'authentification, injectées pour la testabilité. */
export type AcceptTenantInvitationDependencies = {
  /** Hache un mot de passe selon la politique du produit, sans rien écrire. */
  hashPassword: (password: string) => Promise<string>;
};

/**
 * Accepte une invitation de locataire (MVP-BACKLOG-030, parcours 9).
 *
 * UNE transaction, dans cet ordre, qui est celui qui rend la course inoffensive
 * (DEC-041) :
 *
 *   1. réclamer le lien par une mise à jour conditionnelle, ouvert ET non expiré ;
 *   2. relire l'invité, et refuser si son état a changé depuis l'aperçu ;
 *   3. créer l'accès locataire, ou réactiver celui d'un locataire révoqué ;
 *   4. pour un compte jamais activé seulement : écrire le mot de passe et activer.
 *
 * **Aucun périmètre d'immeubles n'est copié** (DEC-046) : l'étape qui, pour un
 * gestionnaire, recopie ses immeubles dans `manager_property_access` n'a pas
 * d'équivalent ici. Un locataire n'atteint aucun immeuble, et son logement reste
 * porté par l'invitation acceptée jusqu'à ce que le bail le porte, au Lot 8.
 *
 * Si deux visiteurs présentent le même lien, un seul passe l'étape 1. L'autre
 * échoue AVANT d'écrire quoi que ce soit : il ne peut donc pas laisser son mot de
 * passe sur le compte de l'autre.
 *
 * **Un lien ne définit JAMAIS le mot de passe d'un compte déjà actif.** Pour un
 * tel compte, l'acceptation exige une session de ce compte, et aucun mot de passe
 * n'est lu. C'est la règle qui empêche quiconque détient un lien de prendre la
 * main sur la personne invitée.
 */
export async function acceptTenantInvitation(
  db: TenantsDatabase,
  dependencies: AcceptTenantInvitationDependencies,
  input: { token: string; password?: unknown; sessionUserId?: string | null },
  options: TenantServiceOptions = {},
): Promise<AcceptedTenantInvitation> {
  const now = nowOf(options);
  const { password } = parseOrThrow(acceptTenantInvitationSchema, { password: input.password });

  const { invitation, target } = await resolveInvitation(db, input.token, now);

  let passwordHash: string | null = null;

  if (target.status === 'PENDING_ACTIVATION') {
    const candidate = password ?? '';

    if (candidate.length < MIN_PASSWORD_LENGTH || candidate.length > MAX_PASSWORD_LENGTH) {
      throw new TenantValidationError({
        password: [
          `Le mot de passe doit faire entre ${MIN_PASSWORD_LENGTH} et ${MAX_PASSWORD_LENGTH} caractères.`,
        ],
      });
    }

    // Haché AVANT la transaction : le hachage est lent par construction, et le
    // faire sous verrou prolongerait d'autant l'attente de l'autre visiteur.
    passwordHash = await dependencies.hashPassword(candidate);
  } else if (input.sessionUserId !== target.id) {
    throw new InvitationLoginRequiredError();
  }

  return db.transaction(async (tx) => {
    const claimed = await claimInvitation(tx, invitation.id, now);

    if (!claimed) throw new InvitationInvalidError();

    const current = await findUserById(tx, target.id);

    if (!current || current.archivedAt !== null || current.status !== target.status) {
      throw new InvitationInvalidError();
    }

    const existing = await findTenantAccess(tx, current.id, claimed.organizationId);
    let access: UserAccess;

    if (!existing) {
      access = await insertTenantAccess(tx, {
        userId: current.id,
        organizationId: claimed.organizationId,
      });
    } else if (existing.status === 'REVOKED') {
      const reactivated = await reactivateRevokedAccess(tx, existing.id, now);

      if (!reactivated) throw new InvitationInvalidError();

      access = reactivated;
    } else {
      // Actif ou suspendu : l'invitation n'aurait pas dû être émise, ou l'accès a
      // été créé depuis. Dans les deux cas, le lien ne doit rien accorder.
      throw new InvitationInvalidError();
    }

    if (passwordHash !== null) {
      await writeCredential(tx, { userId: current.id, passwordHash });
      await activateUser(tx, current.id, now);
    }

    return {
      userId: current.id,
      accessId: access.id,
      organizationId: claimed.organizationId,
      phone: current.phone,
      activatedAccount: passwordHash !== null,
    };
  });
}

// --- Le locataire, c'est-à-dire la personne et sa relation (DEC-051) ---------------

export type TenantCollection = {
  tenants: TenantListItem[];
  meta: { total: number; page: number; pageSize: number };
};

/** L'immeuble est-il lisible dans ce périmètre ? Un immeuble inconnu ferme l'accès. */
function withinScopes(
  scopes: readonly PropertyScope[],
  item: { organizationId: string; propertyId: string | null },
): boolean {
  return scopes.some((scope) => {
    if (scope.organizationId !== item.organizationId) return false;
    if (scope.propertyIds === 'all') return true;

    return item.propertyId !== null && scope.propertyIds.includes(item.propertyId);
  });
}

/** Le terme de recherche porte sur le nom et le téléphone, sans tenir compte de la casse. */
function matchesSearch(item: TenantListItem, search: string | null): boolean {
  if (search === null) return true;

  const needle = search.toLocaleLowerCase('fr');

  return (
    item.fullName.toLocaleLowerCase('fr').includes(needle) ||
    (item.phone ?? '').toLocaleLowerCase('fr').includes(needle)
  );
}

/**
 * Relation d'une personne avec une organisation, assemblée des trois traces.
 *
 * C'est le cœur de DEC-051 : une personne est locataire d'une organisation dès
 * qu'une invitation, un accès OU un bail l'y rattache. Aucune des trois n'est
 * obligatoire pour les deux autres, et c'est ce qui permet de représenter le
 * locataire qui n'utilisera jamais l'application.
 */
type Relationship = {
  organizationId: string;
  userId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  accessId: string | null;
  accessStatus: 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | null;
  accessUpdatedAt: Date | null;
  accessRevokedAt: Date | null;
  openInvitationId: string | null;
  openInvitationIssuedAt: Date | null;
  openInvitationExpiresAt: Date | null;
  openInvitationExpired: boolean;
  invitedAt: Date | null;
  activatedAt: Date | null;
  invitationApartmentId: string | null;
  activeLeaseId: string | null;
  leaseApartmentId: string | null;
  leasePropertyId: string | null;
};

function emptyRelationship(
  organizationId: string,
  userId: string,
  identity: { fullName: string; phone: string | null; email: string | null },
): Relationship {
  return {
    organizationId,
    userId,
    fullName: identity.fullName,
    phone: identity.phone,
    email: identity.email,
    accessId: null,
    accessStatus: null,
    accessUpdatedAt: null,
    accessRevokedAt: null,
    openInvitationId: null,
    openInvitationIssuedAt: null,
    openInvitationExpiresAt: null,
    openInvitationExpired: false,
    invitedAt: null,
    activatedAt: null,
    invitationApartmentId: null,
    activeLeaseId: null,
    leaseApartmentId: null,
    leasePropertyId: null,
  };
}

/**
 * Assemble les relations locataires des organisations indiquées.
 *
 * UNE seule fonction sert la liste et la fiche, la seconde n'étant que la
 * première filtrée à une personne : deux chemins de lecture pour la même notion
 * finiraient par diverger sur un détail, et c'est toujours le détail qui compte.
 *
 * Quatre lectures, quel que soit le nombre de personnes : les accès, les
 * invitations ouvertes, les invitations acceptées, les baux. Puis les logements
 * et les noms d'organisation, en une lecture chacun.
 */
async function assembleRelationships(
  db: TenantsDatabase,
  organizationIds: readonly string[],
  now: Date,
  userId?: string,
): Promise<TenantListItem[]> {
  if (organizationIds.length === 0) return [];

  const [accessRows, pendingRows, acceptedRows, leaseRows] = await Promise.all([
    listTenantAccessRows(db, organizationIds, userId),
    listPendingInvitationRows(db, organizationIds, userId),
    listAcceptedInvitationRows(db, organizationIds, userId),
    listTenantLeaseRows(db, organizationIds, userId),
  ]);

  const relationships = new Map<string, Relationship>();
  const keyOf = (organizationId: string, person: string) => `${organizationId}:${person}`;

  const upsert = (
    organizationId: string,
    person: string,
    identity: { fullName: string; phone: string | null; email: string | null },
  ): Relationship => {
    const key = keyOf(organizationId, person);
    const known = relationships.get(key);

    if (known) return known;

    const fresh = emptyRelationship(organizationId, person, identity);

    relationships.set(key, fresh);

    return fresh;
  };

  for (const row of accessRows) {
    const relationship = upsert(row.organizationId, row.userId, row);

    relationship.accessId = row.accessId;
    relationship.accessStatus = row.status;
    relationship.accessUpdatedAt = row.updatedAt;
    relationship.accessRevokedAt = row.revokedAt;
  }

  for (const row of pendingRows) {
    const relationship = upsert(row.organizationId, row.userId, row);

    relationship.openInvitationId = row.invitationId;
    relationship.openInvitationIssuedAt = row.issuedAt;
    relationship.openInvitationExpiresAt = row.expiresAt;
    relationship.openInvitationExpired =
      effectiveInvitationStatus({ status: row.status, expiresAt: row.expiresAt }, now) ===
      'EXPIRED';
    relationship.invitedAt = row.issuedAt;
    relationship.invitationApartmentId = row.apartmentId;
  }

  // La DERNIERE invitation acceptée par personne et organisation : elle date
  // l'ouverture de l'accès, et portait le logement avant que le bail existe.
  const latestAccepted = new Map<string, (typeof acceptedRows)[number]>();

  for (const row of acceptedRows) {
    const key = keyOf(row.organizationId, row.userId);
    const known = latestAccepted.get(key);

    if (!known || row.acceptedAt.getTime() > known.acceptedAt.getTime()) {
      latestAccepted.set(key, row);
    }
  }

  for (const [key, row] of latestAccepted) {
    const relationship = relationships.get(key);

    // Une invitation acceptée sans accès ni bail ne crée pas de relation à elle
    // seule : son accès a forcément été créé, et c'est lui qui la porte.
    if (!relationship) continue;

    relationship.activatedAt = row.acceptedAt;
    relationship.invitedAt = relationship.invitedAt ?? row.issuedAt;
    relationship.invitationApartmentId = relationship.invitationApartmentId ?? row.apartmentId;
  }

  for (const row of leaseRows) {
    const relationship = upsert(row.organizationId, row.tenantUserId, row);

    // Seul le bail EN COURS porte le logement : un bail terminé appartient à
    // l'historique, que la liste des baux montre (Database Schema section 18).
    if (row.status === 'ACTIVE' && relationship.activeLeaseId === null) {
      relationship.activeLeaseId = row.leaseId;
      relationship.leaseApartmentId = row.apartmentId;
      relationship.leasePropertyId = row.propertyId;
    }
  }

  const apartmentIds = [
    ...new Set(
      [...relationships.values()]
        .flatMap((relationship) => [
          relationship.leaseApartmentId,
          relationship.invitationApartmentId,
        ])
        .filter((id): id is string => id !== null),
    ),
  ];

  const apartments = new Map(
    (await findApartmentsByIds(db, apartmentIds)).map((row) => [row.id, row]),
  );
  const names = await findOrganizationNames(db, organizationIds);

  return [...relationships.values()].map((relationship) => {
    /*
     * Le BAIL fait foi pour le logement, l'invitation ne sert qu'en son absence.
     *
     * Au Lot 7 l'invitation le portait faute de bail (DEC-046). Les deux peuvent
     * diverger, si l'on invite une personne sur un logement puis qu'on lui en loue
     * un autre : afficher les deux sources côte à côte donnerait un écran qui se
     * contredit.
     */
    const apartmentId = relationship.leaseApartmentId ?? relationship.invitationApartmentId;
    const apartmentRow = apartmentId ? apartments.get(apartmentId) : undefined;
    const apartment = apartmentRow ? refOf(apartmentRow) : null;

    const source: ApartmentSource =
      relationship.leaseApartmentId !== null
        ? 'LEASE'
        : relationship.invitationApartmentId !== null
          ? 'INVITATION'
          : 'NONE';

    /*
     * Statut DÉRIVÉ, dans cet ordre, et l'ordre est le sens :
     *
     *   1. une invitation OUVERTE est le fait vivant : la personne est invitée,
     *      même si un accès révoqué subsiste d'un passage précédent (DEC-043) ;
     *   2. sinon l'accès, s'il y en a un ;
     *   3. sinon aucun accès, ce qui est l'état normal du locataire qui
     *      n'utilisera jamais l'application (DEC-051).
     */
    const status: TenantListStatus =
      relationship.openInvitationId !== null
        ? relationship.openInvitationExpired
          ? 'INVITATION_EXPIRED'
          : 'INVITED'
        : (relationship.accessStatus ?? 'NO_ACCESS');

    return {
      id: relationship.userId,
      organizationId: relationship.organizationId,
      organizationName: names.get(relationship.organizationId) ?? '',
      fullName: relationship.fullName,
      phone: relationship.phone,
      email: relationship.email,
      status,
      apartment,
      apartmentSource: source,
      accessId: relationship.accessId,
      invitationId: relationship.openInvitationId,
      leaseId: relationship.activeLeaseId,
      invitedAt: relationship.invitedAt,
      activatedAt: relationship.activatedAt,
      expiresAt: relationship.openInvitationExpiresAt,
    };
  });
}

/** Immeuble qui rattache une relation, pour la soumettre au contrôle d'accès. */
function propertyOf(item: TenantListItem): string | null {
  return item.apartment?.propertyId ?? null;
}

/**
 * Liste les locataires (API section 15, DEC-051).
 *
 * **Toute personne qui a une relation locative avec l'organisation**, qu'elle ait
 * ou non un accès à l'application : une invitation, un accès ou un bail suffit à
 * l'y faire figurer. Un élément par couple personne et organisation.
 *
 * Le `status` est DÉRIVÉ, jamais stocké, et distingue `NO_ACCESS` de `REVOKED` :
 * le premier n'a jamais eu de compte, le second en avait un qu'on lui a retiré.
 *
 * Deux filtres se superposent, et c'est voulu :
 *
 *   1. l'ORGANISATION, dans la requête SQL : aucune ligne d'une autre
 *      organisation n'est lue, c'est la barrière d'isolation ;
 *   2. l'IMMEUBLE, ici : le logement d'un locataire vient de son bail ou de son
 *      invitation, donc le périmètre d'un gestionnaire ne se résout qu'après
 *      avoir assemblé la relation. Rien ne quitte le serveur dans l'intervalle.
 *
 * Un appelant qui n'a aucun périmètre lisible obtient « inexistant » : c'est le
 * cas d'un locataire, qui ne voit jamais la liste des locataires (DEC-047).
 */
export async function listTenants(
  db: TenantsDatabase,
  context: AccessContext,
  input: unknown = {},
  options: TenantServiceOptions = {},
): Promise<TenantCollection> {
  const query = parseOrThrow(listTenantsQuerySchema, input);
  const scopes = readablePropertyScopes(context, 'tenant.read');

  if (scopes.length === 0) throw new ResourceOutOfScopeError();

  const assembled = await assembleRelationships(
    db,
    scopes.map((scope) => scope.organizationId),
    nowOf(options),
  );

  const visible = assembled.filter((item) =>
    withinScopes(scopes, { organizationId: item.organizationId, propertyId: propertyOf(item) }),
  );

  const filtered = visible
    .filter((item) => (query.status === 'ALL' ? true : item.status === query.status))
    .filter((item) => !query.propertyId || item.apartment?.propertyId === query.propertyId)
    .filter((item) => !query.apartmentId || item.apartment?.id === query.apartmentId)
    .filter((item) => matchesSearch(item, query.search))
    .sort(compareTenantItems);

  const start = (query.page - 1) * query.pageSize;

  return {
    tenants: filtered.slice(start, start + query.pageSize),
    meta: { total: filtered.length, page: query.page, pageSize: query.pageSize },
  };
}

// --- Une relation précise : fiche, nom, suspension, réactivation, révocation -------

/**
 * Réglages d'une opération qui vise UNE relation.
 *
 * `organizationId` est facultatif : la ressource locataire est le couple personne
 * et organisation, et `users.id` ne porte pas la seconde. Quand une seule
 * organisation de l'appelant connaît cette personne, elle est déduite ; quand
 * plusieurs la connaissent, elle doit être désignée (DEC-051).
 */
export type TenantRelationshipOptions = TenantServiceOptions & {
  organizationId?: string;
};

/**
 * Relation locataire accessible à l'appelant, ou refus indiscernable d'une absence.
 *
 * Un identifiant inconnu, mal formé, une personne d'une autre organisation, ou
 * une personne hors du périmètre d'immeubles lèvent la MÊME erreur (ADR-007).
 *
 * La ressource soumise à la décision porte DEUX rattachements, et il faut les
 * deux :
 *
 *   `propertyId`    l'immeuble du logement, porté par le bail ou l'invitation.
 *                   Sans lui, un gestionnaire n'atteint rien, ce qui est
 *                   correct : son autorité est bornée à un périmètre.
 *   `ownerUserId`   la personne elle-même. C'est ce qui permet au locataire
 *                   d'atteindre SES données, et seulement les siennes : un autre
 *                   locataire reçoit « inexistant » (DEC-047, BR-021).
 *
 * Depuis DEC-051, `ownerUserId` est exactement l'identifiant de la ressource :
 * l'autorisation du locataire sur ses propres données n'a plus besoin de
 * remonter d'un accès vers une personne.
 */
async function loadReadableRelationship(
  db: TenantsDatabase,
  context: AccessContext,
  userId: string,
  permission: Extract<Permission, 'tenant.read' | 'tenant.update' | 'tenant.revoke'>,
  options: TenantRelationshipOptions = {},
): Promise<TenantListItem> {
  // Un identifiant qui n'est pas un UUID ne peut désigner aucune personne. Sans
  // ce contrôle PostgreSQL refuserait la conversion et produirait une erreur
  // interne, là où la réponse correcte est « inexistant ».
  if (!z.uuid().safeParse(userId).success) throw new ResourceOutOfScopeError();

  const scopes = readablePropertyScopes(context, permission).filter(
    (scope) =>
      options.organizationId === undefined || scope.organizationId === options.organizationId,
  );

  /*
   * Le locataire lit ses propres données, et son rattachement est LUI-MÊME et non
   * un immeuble : `readablePropertyScopes` ne lui donne donc aucun périmètre
   * (BR-021). Son organisation vient de son rattachement.
   */
  const ownScopes =
    userId === context.userId
      ? context.memberships
          .filter((membership) => membership.role === 'TENANT')
          .filter(
            (membership) =>
              options.organizationId === undefined ||
              membership.organizationId === options.organizationId,
          )
          .map((membership) => ({
            organizationId: membership.organizationId,
            propertyIds: 'all' as const,
          }))
      : [];

  const searchable = [...scopes, ...ownScopes];

  if (searchable.length === 0) throw new ResourceOutOfScopeError();

  const assembled = await assembleRelationships(
    db,
    [...new Set(searchable.map((scope) => scope.organizationId))],
    nowOf(options),
    userId,
  );

  /*
   * `evaluate` et non `can` : la DISTINCTION entre les deux refus compte (ADR-007).
   *
   * Une ressource hors périmètre doit se comporter comme inexistante, donc 404.
   * Mais une ressource que l'appelant atteint bien, sur laquelle il n'a pas la
   * permission, doit donner 403 : c'est le cas du locataire qui viserait la
   * révocation de son propre accès, qu'il voit et ne peut pas décider. Collapser
   * les deux en « inexistant » lui dirait que sa propre fiche n'existe pas.
   */
  const decisions = assembled.map((item) => ({
    item,
    decision: evaluate(context, permission, {
      organizationId: item.organizationId,
      propertyId: propertyOf(item),
      ownerUserId: item.id,
    }),
  }));

  const readable = decisions.filter((entry) => entry.decision.allowed).map((entry) => entry.item);

  if (readable.length === 0) {
    const denied = decisions.some(
      (entry) => !entry.decision.allowed && entry.decision.reason === 'permission-denied',
    );

    throw denied ? new PermissionDeniedError(permission) : new ResourceOutOfScopeError();
  }

  if (readable.length > 1) {
    throw new TenantOrganizationRequiredError(readable.map((item) => item.organizationId));
  }

  return readable[0] as TenantListItem;
}

/** Fiche d'un locataire : son identité, sa relation, son logement. Rien de financier. */
async function toDetailView(db: TenantsDatabase, item: TenantListItem): Promise<TenantDetailView> {
  const access = item.accessId
    ? await findTenantAccessFor(db, item.id, item.organizationId)
    : undefined;

  return {
    ...item,
    statusChangedAt: access?.updatedAt ?? null,
    revokedAt: access?.revokedAt ?? null,
  };
}

/** Consulte la fiche d'un locataire (MVP-BACKLOG-031, API section 15). */
export async function getTenant(
  db: TenantsDatabase,
  context: AccessContext,
  userId: string,
  options: TenantRelationshipOptions = {},
): Promise<TenantDetailView> {
  const item = await loadReadableRelationship(db, context, userId, 'tenant.read', options);

  return toDetailView(db, item);
}

/**
 * Modifie le NOM d'un locataire (DEC-048, API section 15).
 *
 * Le nom, et rien d'autre : le téléphone et l'email ne sont modifiables par
 * personne au MVP, faute du mécanisme de vérification qu'exigent SEC-049 et
 * SEC-050. Le schéma ne les accepte même pas.
 *
 * Et seulement par le locataire LUI-MÊME. La raison est plus forte encore depuis
 * DEC-051 : `users` porte l'IDENTITÉ MÉTIER de la personne, donc la modifier
 * depuis l'écran d'un propriétaire changerait son identité partout, y compris
 * chez un autre bailleur.
 */
export async function updateTenant(
  db: TenantsDatabase,
  context: AccessContext,
  userId: string,
  input: unknown,
  options: TenantRelationshipOptions = {},
): Promise<TenantDetailView> {
  const data = parseOrThrow(updateTenantSchema, input);
  const item = await loadReadableRelationship(db, context, userId, 'tenant.update', options);

  if (item.id !== context.userId) throw new TenantNameNotOwnedError();

  const updated = await updateUserFullName(db, item.id, data.name, nowOf(options));

  if (!updated) throw new ResourceOutOfScopeError();

  return toDetailView(db, { ...item, fullName: updated.fullName });
}

/**
 * Accès sur lequel une opération d'accès va porter.
 *
 * Une personne locataire SANS accès n'a rien à suspendre ni à révoquer : c'est la
 * séparation que DEC-051 établit entre l'identité métier et le droit d'accès, et
 * le refus le dit plutôt que de feindre un succès.
 */
function accessOf(item: TenantListItem): string {
  if (item.accessId === null) throw new TenantNoAccessError();

  return item.accessId;
}

/**
 * Pourquoi une transition d'accès a été refusée : l'état RÉEL, relu après coup.
 *
 * La transition est conditionnelle en base. Quand elle ne touche aucune ligne,
 * c'est que l'accès n'était plus dans l'état attendu ; on relit son état pour
 * dire le vrai motif plutôt qu'un refus générique.
 */
async function stateErrorOf(
  db: TenantsDatabase,
  action: 'suspend' | 'reactivate' | 'revoke',
  item: TenantListItem,
): Promise<Error> {
  const current = await findTenantAccessFor(db, item.id, item.organizationId);

  return current ? new TenantStateError(action, current.status) : new ResourceOutOfScopeError();
}

/**
 * Suspend l'accès d'un locataire (DEC-047).
 *
 * Bloque l'accès à la requête suivante. Le propriétaire et le gestionnaire le
 * peuvent tous les deux, chacun sur son périmètre.
 *
 * **Ne termine aucun bail** et ne retire aucun logement : la personne reste la
 * locataire du logement, elle cesse seulement d'utiliser l'application.
 */
export async function suspendTenant(
  db: TenantsDatabase,
  context: AccessContext,
  userId: string,
  options: TenantRelationshipOptions = {},
): Promise<TenantDetailView> {
  const item = await loadReadableRelationship(db, context, userId, 'tenant.update', options);
  const moved = await transitionAccess(db, accessOf(item), ['ACTIVE'], 'SUSPENDED', nowOf(options));

  if (!moved) throw await stateErrorOf(db, 'suspend', item);

  return getTenant(db, context, userId, options);
}

/**
 * Réactive un locataire suspendu (DEC-047).
 *
 * Seul un accès SUSPENDU se réactive. Un accès révoqué ne se réactive jamais :
 * c'est la réinvitation qui le fait revenir (DEC-043).
 */
export async function reactivateTenant(
  db: TenantsDatabase,
  context: AccessContext,
  userId: string,
  options: TenantRelationshipOptions = {},
): Promise<TenantDetailView> {
  const item = await loadReadableRelationship(db, context, userId, 'tenant.update', options);
  const moved = await transitionAccess(db, accessOf(item), ['SUSPENDED'], 'ACTIVE', nowOf(options));

  if (!moved) throw await stateErrorOf(db, 'reactivate', item);

  return getTenant(db, context, userId, options);
}

/**
 * Révoque l'accès d'un locataire au produit (DEC-047).
 *
 * Une seule transaction :
 *
 *   1. l'accès passe à `REVOKED`, `revoked_at` posé ;
 *   2. ses sessions sont coupées, mais SEULEMENT s'il n'a plus aucun accès actif
 *      ailleurs : les sessions ne sont pas propres à une organisation, et couper
 *      celles d'une personne qui est encore locataire d'un autre bailleur la
 *      déconnecterait à tort.
 *
 * Aucun périmètre d'immeubles à révoquer : un accès locataire n'en a jamais eu
 * (DEC-046).
 *
 * **Révoquer l'accès au produit ne termine JAMAIS le bail**, et ne clôt aucune
 * relation locative : c'est la fin du bail qui porte le retrait de l'accès au
 * logement (DEC-047). Depuis DEC-051, la personne reste d'ailleurs dans la liste
 * des locataires, au statut `REVOKED` : elle occupe toujours son logement.
 *
 * L'HISTORIQUE EST CONSERVÉ. Rien n'est supprimé : ni la personne, ni sa ligne
 * d'accès. Possible depuis un accès actif comme suspendu.
 */
export async function revokeTenant(
  db: TenantsDatabase,
  context: AccessContext,
  userId: string,
  options: TenantRelationshipOptions = {},
): Promise<TenantDetailView> {
  const item = await loadReadableRelationship(db, context, userId, 'tenant.revoke', options);
  const accessId = accessOf(item);
  const now = nowOf(options);

  await db.transaction(async (tx) => {
    const moved = await transitionAccess(tx, accessId, ['ACTIVE', 'SUSPENDED'], 'REVOKED', now);

    if (!moved) throw await stateErrorOf(tx, 'revoke', item);

    if ((await countActiveAccesses(tx, item.id)) === 0) {
      await endAllSessionsOf(tx, item.id);
    }
  });

  return getTenant(db, context, userId, options);
}

/**
 * Espace locataire de la personne connectée (DEC-046, BR-021).
 *
 * Son logement, son statut, et son contrat quand le bail existe. Renvoie `null`
 * quand la personne n'a aucun accès locataire actif : un propriétaire ou un
 * gestionnaire n'a pas d'espace locataire, et l'écran doit pouvoir le dire sans
 * traiter cela comme une erreur.
 *
 * Le périmètre est LUI-MÊME et non un immeuble : c'est son rattachement qui
 * donne l'organisation, pas un périmètre lisible (BR-021).
 */
export async function getMyTenantSpace(
  db: TenantsDatabase,
  context: AccessContext,
  options: TenantServiceOptions = {},
): Promise<TenantDetailView | null> {
  const membership = context.memberships.find((entry) => entry.role === 'TENANT');

  if (!membership) return null;

  const [item] = await assembleRelationships(
    db,
    [membership.organizationId],
    nowOf(options),
    context.userId,
  );

  return item ? toDetailView(db, item) : null;
}

/**
 * Personne locataire désignée par son nom et son numéro, créée si elle est
 * inconnue (DEC-051, Lot 8b).
 *
 * Exposée pour que le module Contrats puisse créer un bail au nom d'une personne
 * qui n'a aucun compte et n'en aura jamais : c'est le « geste explicite » que
 * DEC-051 point 8 réserve, par opposition à la désignation d'un `users.id` trouvé
 * ailleurs.
 *
 * **Cette fonction ne vérifie AUCUNE permission, et c'est volontaire.** Elle ne
 * touche ni organisation ni accès : elle ne fait qu'établir l'identité d'une
 * personne dans `users`, table globale et sans organisation. C'est l'appelant qui
 * a déjà établi son périmètre sur le LOGEMENT, et c'est le bail qu'il écrit
 * ensuite qui rattache la personne à son organisation. Lui demander de vérifier
 * une permission ici supposerait une ressource qu'elle n'a pas.
 *
 * Elle doit recevoir une TRANSACTION : une personne créée sans le bail qui la
 * justifie ne doit jamais subsister.
 */
export async function resolveTenantPerson(
  db: TenantsDatabase,
  input: { name: string; phone: string; email: string | null },
): Promise<{ id: string; fullName: string; phone: string | null; email: string | null }> {
  const person = await resolvePerson(db, input);

  return {
    id: person.id,
    fullName: person.fullName,
    phone: person.phone,
    email: person.email,
  };
}
