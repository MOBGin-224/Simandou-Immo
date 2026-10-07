import { z } from 'zod';

import type { User, UserAccess } from '@/db/schema';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  endAllSessionsOf,
  writeCredential,
} from '@/lib/auth';
import {
  ResourceOutOfScopeError,
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
  findLatestAcceptedInvitation,
  findOrganizationName,
  findStoredOpenInvitation,
  findTenantAccess,
  findTenantAccessById,
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
 * **Ce qu'est un locataire au Lot 7** (DEC-046) : une personne invitée à l'espace
 * locataire d'un LOGEMENT désigné. Ni date d'entrée, ni loyer : ils appartiennent
 * au bail, au Lot 8. Aucune table `tenant_profiles` n'existe, et aucune n'est
 * créée : l'identité vit dans `users`, le rôle dans `user_access`, le contexte
 * locatif prévu dans `invitations`.
 *
 * **D'où vient le périmètre.** Un gestionnaire n'a d'autorité que sur ses
 * immeubles (ADR-007). Le lien entre un locataire et un immeuble n'existe au
 * Lot 7 que par son invitation, qui porte `apartment_id` et `property_id` : c'est
 * donc elle qui résout le périmètre, pour une invitation en attente comme pour un
 * accès déjà ouvert. Au Lot 8, le bail prendra ce rôle.
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
 * Utilisateur que l'invitation vise : réutilisé s'il existe, créé sinon (BR-009).
 *
 * Le numéro de téléphone est UNIQUE : inviter un numéro déjà connu ne peut pas
 * créer un second compte, il faut réutiliser celui qui existe. Ce que cela change
 * selon l'état du compte existant est consigné par DEC-041, et vaut pour un
 * locataire comme pour un gestionnaire :
 *
 *   en attente d'activation  réutilisé, son nom et son email sont mis à jour : nul
 *                            n'a pu s'y authentifier, donc nul ne peut s'étonner
 *   actif                    réutilisé TEL QUEL, le nom saisi est ignoré : il
 *                            appartient à la personne, pas à celui qui l'invite
 *   suspendu ou archivé      refusé
 */
async function resolveInvitee(
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
      const invitee = await resolveInvitee(tx, data);

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

// --- Liste des locataires -------------------------------------------------------------

export type TenantCollection = {
  tenants: TenantListItem[];
  meta: { total: number; page: number; pageSize: number };
};

/** L'immeuble est-il lisible dans ce périmètre ? Un immeuble inconnu ferme l'accès. */
function withinScopes(
  scopes: readonly PropertyScope[],
  item: {
    organizationId: string;
    propertyId: string | null;
  },
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
 * Liste les locataires et les invitations en attente (API section 15, PRD 10.2).
 *
 * Réunit deux natures, distinguées par `kind` : les accès, de tout statut, et les
 * invitations ouvertes. Les invitations acceptées ne s'y répètent pas, leur
 * locataire les remplace ; les invitations révoquées n'y figurent pas, elles sont
 * annulées.
 *
 * Le `status` est DÉRIVÉ, jamais stocké (DEC-046) : il se lit de l'invitation et
 * de l'accès.
 *
 * Deux filtres se superposent, et c'est voulu :
 *
 *   1. l'ORGANISATION, dans la requête SQL : aucune ligne d'une autre
 *      organisation n'est lue, c'est la barrière d'isolation ;
 *   2. l'IMMEUBLE, ici : le logement d'un locataire est porté par son invitation,
 *      donc le périmètre d'un gestionnaire ne se résout qu'après avoir rapproché
 *      l'accès de son invitation acceptée. Rien ne quitte le serveur dans
 *      l'intervalle.
 *
 * Un appelant qui n'a aucun périmètre lisible obtient « inexistant », comme pour
 * toute ressource de ce genre : c'est le cas d'un locataire, qui ne voit jamais
 * la liste des locataires (DEC-047).
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

  const now = nowOf(options);
  const organizationIds = scopes.map((scope) => scope.organizationId);

  const accessRows = await listTenantAccessRows(db, organizationIds);
  const pendingRows = await listPendingInvitationRows(db, organizationIds);
  const acceptedRows = await listAcceptedInvitationRows(db, organizationIds);

  // Dernière invitation acceptée par personne et organisation : elle date l'accès
  // et porte son logement.
  const latestAccepted = new Map<string, (typeof acceptedRows)[number]>();

  for (const row of acceptedRows) {
    const key = `${row.organizationId}:${row.userId}`;
    const known = latestAccepted.get(key);

    if (!known || row.acceptedAt.getTime() > known.acceptedAt.getTime()) {
      latestAccepted.set(key, row);
    }
  }

  const apartmentIds = [
    ...new Set(
      [
        ...pendingRows.map((row) => row.apartmentId),
        ...[...latestAccepted.values()].map((row) => row.apartmentId),
      ].filter((id): id is string => id !== null),
    ),
  ];

  const apartments = new Map(
    (await findApartmentsByIds(db, apartmentIds)).map((row) => [row.id, refOf(row)]),
  );

  const accessItems: TenantListItem[] = accessRows.map((row) => {
    const accepted = latestAccepted.get(`${row.organizationId}:${row.userId}`);
    const apartment = accepted?.apartmentId ? (apartments.get(accepted.apartmentId) ?? null) : null;

    return {
      kind: 'ACCESS',
      id: row.accessId,
      organizationId: row.organizationId,
      organizationName: row.organizationName,
      fullName: row.fullName,
      phone: row.phone,
      email: row.email,
      status: row.status,
      apartment,
      invitedAt: accepted?.issuedAt ?? null,
      activatedAt: accepted?.acceptedAt ?? null,
      expiresAt: null,
    };
  });

  const invitationItems: TenantListItem[] = pendingRows.map((row) => {
    const status: TenantListStatus =
      effectiveInvitationStatus({ status: row.status, expiresAt: row.expiresAt }, now) === 'EXPIRED'
        ? 'INVITATION_EXPIRED'
        : 'INVITED';

    return {
      kind: 'INVITATION',
      id: row.invitationId,
      organizationId: row.organizationId,
      organizationName: row.organizationName,
      fullName: row.fullName,
      phone: row.phone,
      email: row.email,
      status,
      apartment: row.apartmentId ? (apartments.get(row.apartmentId) ?? null) : null,
      invitedAt: row.issuedAt,
      activatedAt: null,
      expiresAt: row.expiresAt,
    };
  });

  const visible = [...invitationItems, ...accessItems].filter((item) =>
    withinScopes(scopes, {
      organizationId: item.organizationId,
      propertyId: item.apartment?.propertyId ?? null,
    }),
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

// --- Vie d'un accès : fiche, nom, suspension, réactivation, révocation ----------------

/**
 * Accès locataire accessible à l'appelant, ou refus indiscernable d'une absence.
 *
 * Un identifiant inconnu, mal formé, d'une autre organisation, ou qui désigne un
 * accès de propriétaire ou de gestionnaire, lève la MÊME erreur (ADR-007).
 *
 * La ressource soumise à la décision porte DEUX rattachements, et il faut les deux
 * (ADR-007) :
 *
 *   `propertyId`    l'immeuble du logement, porté par l'invitation acceptée. Sans
 *                   lui, un gestionnaire n'atteint rien, ce qui est correct : son
 *                   autorité est bornée à un périmètre d'immeubles.
 *   `ownerUserId`   la personne elle-même. C'est ce qui permet au locataire
 *                   d'atteindre SES données, et seulement les siennes : un autre
 *                   locataire reçoit « inexistant » (DEC-047).
 */
async function loadManageableAccess(
  db: TenantsDatabase,
  context: AccessContext,
  accessId: string,
  permission: Extract<Permission, 'tenant.read' | 'tenant.update' | 'tenant.revoke'>,
) {
  // Un identifiant qui n'est pas un UUID ne peut désigner aucun accès. Sans ce
  // contrôle PostgreSQL refuserait la conversion et produirait une erreur interne,
  // là où la réponse correcte est « inexistant ».
  if (!z.uuid().safeParse(accessId).success) throw new ResourceOutOfScopeError();

  const access = await findTenantAccessById(db, accessId);

  if (!access) throw new ResourceOutOfScopeError();

  const accepted = await findLatestAcceptedInvitation(db, access.organizationId, access.userId);
  const apartment = accepted?.apartmentId
    ? await findApartmentById(db, accepted.apartmentId)
    : undefined;

  requirePermission(context, permission, {
    organizationId: access.organizationId,
    propertyId: apartment?.propertyId ?? null,
    ownerUserId: access.userId,
  });

  return { access, accepted, apartment };
}

/** Fiche d'un locataire : identité, statut, logement désigné, dates. Rien de financier. */
async function toDetailView(db: TenantsDatabase, accessId: string): Promise<TenantDetailView> {
  const access = await findTenantAccessById(db, accessId);

  if (!access) throw new ResourceOutOfScopeError();

  const accepted = await findLatestAcceptedInvitation(db, access.organizationId, access.userId);
  const apartment = accepted?.apartmentId
    ? await findApartmentById(db, accepted.apartmentId)
    : undefined;

  return {
    id: access.accessId,
    userId: access.userId,
    organizationId: access.organizationId,
    organizationName: access.organizationName,
    fullName: access.fullName,
    phone: access.phone,
    email: access.email,
    status: access.status,
    apartment: apartment ? refOf(apartment) : null,
    invitedAt: accepted?.issuedAt ?? null,
    activatedAt: accepted?.acceptedAt ?? null,
    statusChangedAt: access.updatedAt,
    revokedAt: access.revokedAt,
  };
}

/**
 * Pourquoi une transition d'accès a été refusée : l'état RÉEL, relu après coup.
 *
 * La transition est conditionnelle en base. Quand elle ne touche aucune ligne,
 * c'est que l'accès n'était plus dans l'état attendu ; on relit son état pour dire
 * le vrai motif plutôt qu'un refus générique.
 */
async function stateErrorOf(
  db: TenantsDatabase,
  action: 'suspend' | 'reactivate' | 'revoke',
  accessId: string,
): Promise<Error> {
  const current = await findTenantAccessById(db, accessId);

  return current ? new TenantStateError(action, current.status) : new ResourceOutOfScopeError();
}

/** Consulte la fiche d'un locataire (MVP-BACKLOG-031, API section 15). */
export async function getTenant(
  db: TenantsDatabase,
  context: AccessContext,
  accessId: string,
): Promise<TenantDetailView> {
  const { access } = await loadManageableAccess(db, context, accessId, 'tenant.read');

  return toDetailView(db, access.accessId);
}

/**
 * Modifie le NOM d'un locataire (DEC-048, API section 15).
 *
 * Le nom, et rien d'autre : le téléphone et l'email ne sont modifiables par
 * personne au MVP, faute du mécanisme de vérification qu'exigent SEC-049 et
 * SEC-050. Le schéma ne les accepte même pas.
 *
 * Et seulement par le locataire LUI-MÊME, comme l'écrit la section 14 des rôles
 * et permissions. La raison est concrète : le nom vit dans `users`, donc le
 * modifier depuis l'écran d'un propriétaire changerait l'identité de la personne
 * partout, y compris chez un autre bailleur. Un propriétaire ou un gestionnaire
 * reçoit donc `TenantNameNotOwnedError`, et non un refus silencieux.
 */
export async function updateTenant(
  db: TenantsDatabase,
  context: AccessContext,
  accessId: string,
  input: unknown,
  options: TenantServiceOptions = {},
): Promise<TenantDetailView> {
  const data = parseOrThrow(updateTenantSchema, input);
  const { access } = await loadManageableAccess(db, context, accessId, 'tenant.update');

  if (access.userId !== context.userId) throw new TenantNameNotOwnedError();

  const updated = await updateUserFullName(db, access.userId, data.name, nowOf(options));

  if (!updated) throw new ResourceOutOfScopeError();

  return toDetailView(db, access.accessId);
}

/**
 * Suspend l'accès d'un locataire (DEC-047).
 *
 * Bloque l'accès à la requête suivante. Le propriétaire et le gestionnaire le
 * peuvent tous les deux, chacun sur son périmètre : c'est une différence assumée
 * avec le gestionnaire, que seul le propriétaire suspend (DEC-025).
 *
 * **Ne termine aucun bail** et ne retire aucun logement : la personne reste le
 * locataire du logement, elle cesse seulement d'utiliser l'application.
 */
export async function suspendTenant(
  db: TenantsDatabase,
  context: AccessContext,
  accessId: string,
  options: TenantServiceOptions = {},
): Promise<TenantDetailView> {
  const { access } = await loadManageableAccess(db, context, accessId, 'tenant.update');
  const moved = await transitionAccess(
    db,
    access.accessId,
    ['ACTIVE'],
    'SUSPENDED',
    nowOf(options),
  );

  if (!moved) throw await stateErrorOf(db, 'suspend', access.accessId);

  return toDetailView(db, access.accessId);
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
  accessId: string,
  options: TenantServiceOptions = {},
): Promise<TenantDetailView> {
  const { access } = await loadManageableAccess(db, context, accessId, 'tenant.update');
  const moved = await transitionAccess(
    db,
    access.accessId,
    ['SUSPENDED'],
    'ACTIVE',
    nowOf(options),
  );

  if (!moved) throw await stateErrorOf(db, 'reactivate', access.accessId);

  return toDetailView(db, access.accessId);
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
 * relation locative : les deux concepts restent distincts, et c'est la fin du
 * bail, au Lot 8, qui portera le retrait de l'accès au logement (DEC-047).
 *
 * L'HISTORIQUE EST CONSERVÉ. Rien n'est supprimé : ni la personne, ni sa ligne
 * d'accès. Possible depuis un accès actif comme suspendu.
 */
export async function revokeTenant(
  db: TenantsDatabase,
  context: AccessContext,
  accessId: string,
  options: TenantServiceOptions = {},
): Promise<TenantDetailView> {
  const { access } = await loadManageableAccess(db, context, accessId, 'tenant.revoke');
  const now = nowOf(options);

  await db.transaction(async (tx) => {
    const moved = await transitionAccess(
      tx,
      access.accessId,
      ['ACTIVE', 'SUSPENDED'],
      'REVOKED',
      now,
    );

    if (!moved) throw await stateErrorOf(tx, 'revoke', access.accessId);

    if ((await countActiveAccesses(tx, access.userId)) === 0) {
      await endAllSessionsOf(tx, access.userId);
    }
  });

  return toDetailView(db, access.accessId);
}

/**
 * Espace locataire de la personne connectée, au Lot 7 (DEC-046).
 *
 * Son logement, son statut, et rien de financier : le loyer, les paiements et les
 * quittances naissent du bail, au Lot 8. Tant qu'il n'existe pas, un locataire
 * qui vient d'activer son compte voit donc son logement et l'annonce de la suite,
 * ce qui est exactement ce que le chaînage des lots implique.
 *
 * Renvoie `null` quand la personne n'a aucun accès locataire actif : un
 * propriétaire ou un gestionnaire n'a pas d'espace locataire, et l'écran doit
 * pouvoir le dire sans traiter cela comme une erreur.
 */
export async function getMyTenantSpace(
  db: TenantsDatabase,
  context: AccessContext,
): Promise<TenantDetailView | null> {
  const membership = context.memberships.find((entry) => entry.role === 'TENANT');

  if (!membership) return null;

  return toDetailView(db, membership.accessId);
}
