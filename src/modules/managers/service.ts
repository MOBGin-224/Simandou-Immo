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
  organizationsWhereAllowed,
  requirePermission,
  type AccessContext,
} from '@/lib/authorization';
import { getEnv } from '@/lib/env';
import {
  buildInvitationLink,
  effectiveInvitationStatus,
  generateInvitationToken,
  hashInvitationToken,
  invitationExpiry,
  isInvitationOpen,
  isWellFormedInvitationToken,
} from '@/modules/invitations';

import type { ManagerListStatus } from './constants';
import {
  compareManagerItems,
  type AcceptedInvitation,
  type InvitationPreview,
  type IssuedInvitation,
  type ManagerInvitationView,
  type ManagerDetailView,
  type ManagerListItem,
  type ManagerPropertyRef,
} from './domain';
import {
  InvitationInvalidError,
  InvitationLoginRequiredError,
  InvitationNotOpenError,
  InvitationTargetUnavailableError,
  ManagerInvitationConflictError,
  ManagerStateError,
  ManagerValidationError,
  type InvitationNotOpenReason,
} from './errors';
import {
  OPEN_INVITATION_CONSTRAINT,
  activateUser,
  countActiveAccesses,
  claimInvitation,
  findInvitationById,
  findInvitationByTokenHash,
  findLatestAcceptedInvitation,
  findManagerAccess,
  findManagerAccessById,
  findOrganizationName,
  findPropertiesByIds,
  findStoredOpenInvitation,
  findUserByEmail,
  findUserById,
  findUserByPhone,
  grantProperties,
  insertInvitationProperties,
  insertManagerAccess,
  insertManagerInvitation,
  insertPendingUser,
  isOrganizationOwner,
  isUniqueViolation,
  listAcceptedInvitationRows,
  listActiveScopes,
  listInvitationProperties,
  listManagerAccessRows,
  listPendingInvitationRows,
  markInvitationExpired,
  reactivateRevokedAccess,
  revokeAllScopes,
  revokeInvitationRow,
  revokeScopes,
  rotateInvitationToken,
  transitionAccess,
  updatePendingUser,
  type InvitationPropertyRow,
  type ManagersDatabase,
} from './repository';
import { acceptInvitationSchema, inviteManagerSchema, updateManagerScopeSchema } from './schemas';

/**
 * Cas d'usage du module Gestionnaires (MVP-BACKLOG-024 à 026, API section 13).
 *
 * Chaque fonction suit l'ordre imposé par API-001, sans exception :
 *
 * ```text
 * Authentification  déjà faite, le contexte d'accès la présuppose
 * ↓
 * Validation        schéma Zod, ici et non chez l'appelant
 * ↓
 * Organisation      périmètre et permission, par le point de décision unique
 * ↓
 * Règle métier      doublons, états, immeubles recevables
 * ↓
 * Persistance       en transaction dès qu'il y a plus d'une écriture
 * ```
 *
 * Les quatre permissions `manager.*` sont réservées au propriétaire (DEC-025).
 * Un gestionnaire ou un locataire obtient « inexistant », jamais « interdit » :
 * la ressource est de niveau organisation, et un gestionnaire n'en atteint aucune
 * (ADR-007).
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
export type ManagerServiceOptions = {
  now?: Date;
  ttlDays?: number;
  appUrl?: string;
};

function nowOf(options: ManagerServiceOptions): Date {
  return options.now ?? new Date();
}

/** Réglages d'émission d'un lien. L'environnement n'est lu que s'il le faut. */
function issuingSettings(options: ManagerServiceOptions) {
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
    throw new ManagerValidationError(
      z.flattenError(result.error).fieldErrors as Record<string, string[]>,
    );
  }

  return result.data;
}

function refOf(row: { id: string; name: string; archivedAt: Date | null }): ManagerPropertyRef {
  return { id: row.id, name: row.name, archived: row.archivedAt !== null };
}

// --- Immeubles recevables ---------------------------------------------------------

/**
 * Vérifie que chaque immeuble existe, appartient à l'organisation et n'est pas archivé.
 *
 * Un immeuble inexistant et un immeuble d'une AUTRE organisation reçoivent le même
 * refus, avec le même message : les distinguer apprendrait à un propriétaire quels
 * identifiants désignent un immeuble ailleurs (ADR-007).
 */
async function loadAssignableProperties(
  db: ManagersDatabase,
  organizationId: string,
  propertyIds: readonly string[],
): Promise<ManagerPropertyRef[]> {
  const rows = await findPropertiesByIds(db, propertyIds);
  const usable = rows.filter(
    (row) => row.organizationId === organizationId && row.archivedAt === null,
  );

  if (usable.length !== propertyIds.length) {
    throw new ManagerValidationError({
      propertyIds: ['Un immeuble sélectionné est introuvable ou archivé.'],
    });
  }

  return usable
    .map(refOf)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
}

// --- Invitation d'un gestionnaire ---------------------------------------------------

/** Refuse une adresse email déjà portée par un AUTRE compte. */
async function assertEmailFree(
  db: ManagersDatabase,
  email: string | null,
  ownerId: string | null,
): Promise<void> {
  if (email === null) return;

  const holder = await findUserByEmail(db, email);

  if (holder && holder.id !== ownerId) {
    // Le message ne dit pas à qui appartient l'adresse, ni même qu'elle appartient
    // à un compte : il dit seulement qu'on ne peut pas l'employer ici.
    throw new ManagerValidationError({ email: ['Cette adresse email ne peut pas être utilisée.'] });
  }
}

/**
 * Utilisateur que l'invitation vise : réutilisé s'il existe, créé sinon (BR-009).
 *
 * Le numéro de téléphone est UNIQUE : inviter un numéro déjà connu ne peut pas
 * créer un second compte, il faut réutiliser celui qui existe. Ce que cela
 * change selon l'état du compte existant est consigné par DEC-041.
 *
 *   en attente d'activation  réutilisé, son nom et son email sont mis à jour : nul
 *                            n'a pu s'y authentifier, donc nul ne peut s'étonner
 *   actif                    réutilisé TEL QUEL, le nom saisi est ignoré : il
 *                            appartient à la personne, pas à celui qui l'invite
 *   suspendu ou archivé      refusé
 */
async function resolveInvitee(
  db: ManagersDatabase,
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
 * La personne peut-elle recevoir une invitation de gestionnaire de cette organisation ?
 *
 * Un gestionnaire RÉVOQUÉ le peut (DEC-043) : c'est ce qui lui permet de revenir.
 * Un gestionnaire actif ou suspendu ne le peut pas, ni le propriétaire.
 *
 * Une invitation encore ouverte en base mais périmée est CLÔTURÉE ici : l'index
 * d'unicité partiel la compterait sinon comme ouverte, et empêcherait d'en émettre
 * une nouvelle alors qu'elle est inutilisable.
 */
async function assertCanBeInvited(
  db: ManagersDatabase,
  target: User,
  organizationId: string,
  now: Date,
): Promise<void> {
  if (await isOrganizationOwner(db, target.id, organizationId)) {
    throw new ManagerInvitationConflictError('already-owner');
  }

  const access = await findManagerAccess(db, target.id, organizationId);

  if (access && (access.status === 'ACTIVE' || access.status === 'SUSPENDED')) {
    throw new ManagerInvitationConflictError('already-manager');
  }

  const open = await findStoredOpenInvitation(db, organizationId, target.id);

  if (open) {
    if (isInvitationOpen(open, now)) throw new ManagerInvitationConflictError('invitation-open');

    await markInvitationExpired(db, open.id, now);
  }
}

/** Vue d'une invitation, avec l'identité de l'invité et les immeubles qu'elle attribue. */
async function toInvitationView(
  db: ManagersDatabase,
  invitation: Awaited<ReturnType<typeof findInvitationById>>,
  now: Date,
): Promise<ManagerInvitationView> {
  if (!invitation) throw new ResourceOutOfScopeError();

  const target = invitation.targetUserId
    ? await findUserById(db, invitation.targetUserId)
    : undefined;
  const rows = await listInvitationProperties(db, [invitation.id]);

  return {
    id: invitation.id,
    organizationId: invitation.organizationId,
    fullName: target?.fullName ?? invitation.contact,
    phone: target?.phone ?? null,
    email: target?.email ?? null,
    status: effectiveInvitationStatus(invitation, now),
    issuedAt: invitation.issuedAt,
    expiresAt: invitation.expiresAt,
    properties: rows.map(refOf),
  };
}

/**
 * Invite un gestionnaire (MVP-BACKLOG-025, MVP-FEAT-019, MVP-FEAT-020).
 *
 * Aucun envoi : le système génère l'invitation et son lien, et le propriétaire
 * le transmet lui-même (DEC-026). Le lien est renvoyé ICI, une seule fois : la
 * base ne conserve que le hachage du jeton.
 *
 * Tout se passe dans une transaction : le profil préliminaire, l'invitation et
 * ses immeubles. Une invitation sans immeuble, ou un profil sans invitation, ne
 * doit jamais subsister.
 */
export async function inviteManager(
  db: ManagersDatabase,
  context: AccessContext,
  input: unknown,
  options: ManagerServiceOptions = {},
): Promise<IssuedInvitation> {
  const data = parseOrThrow(inviteManagerSchema, input);

  requirePermission(context, 'manager.invite', { organizationId: data.organizationId });

  const { now, ttlDays, appUrl } = issuingSettings(options);
  const properties = await loadAssignableProperties(db, data.organizationId, data.propertyIds);
  const { token, tokenHash } = generateInvitationToken();

  try {
    const { invitation, target } = await db.transaction(async (tx) => {
      const invitee = await resolveInvitee(tx, data);

      await assertCanBeInvited(tx, invitee, data.organizationId, now);

      const created = await insertManagerInvitation(tx, {
        organizationId: data.organizationId,
        invitedBy: context.userId,
        targetUserId: invitee.id,
        contact: data.phone,
        tokenHash,
        issuedAt: now,
        expiresAt: invitationExpiry(now, ttlDays),
      });

      await insertInvitationProperties(tx, created.id, data.propertyIds);

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
        properties,
      },
      token,
      link: buildInvitationLink(appUrl, token),
    };
  } catch (error) {
    // Deux demandes simultanées passent chacune le pré-contrôle : l'index
    // d'unicité partiel arbitre, et la perdante reçoit le même refus que si elle
    // était arrivée après.
    if (isUniqueViolation(error, OPEN_INVITATION_CONSTRAINT)) {
      throw new ManagerInvitationConflictError('invitation-open');
    }

    throw error;
  }
}

// --- Gestion d'une invitation par son identifiant -----------------------------------

/**
 * Invitation de gestionnaire accessible à l'appelant, ou refus indiscernable d'une absence.
 *
 * Un identifiant inconnu, mal formé, d'une invitation de locataire ou d'une autre
 * organisation lève la MÊME erreur (ADR-007).
 */
async function loadManageableInvitation(
  db: ManagersDatabase,
  context: AccessContext,
  invitationId: string,
  permission: 'manager.read' | 'manager.invite',
) {
  // Un identifiant qui n'est pas un UUID ne peut désigner aucune invitation. Sans
  // ce contrôle PostgreSQL refuserait la conversion et produirait une erreur
  // interne, là où la réponse correcte est « inexistant ».
  if (!z.uuid().safeParse(invitationId).success) throw new ResourceOutOfScopeError();

  const invitation = await findInvitationById(db, invitationId);

  if (!invitation || invitation.role !== 'MANAGER') throw new ResourceOutOfScopeError();

  requirePermission(context, permission, { organizationId: invitation.organizationId });

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

/** Consulte une invitation de gestionnaire, sans son lien, que la base ne peut pas restituer. */
export async function getManagerInvitation(
  db: ManagersDatabase,
  context: AccessContext,
  invitationId: string,
  options: ManagerServiceOptions = {},
): Promise<ManagerInvitationView> {
  const invitation = await loadManageableInvitation(db, context, invitationId, 'manager.read');

  return toInvitationView(db, invitation, nowOf(options));
}

/**
 * Renvoie une invitation : régénère son jeton dans la même ligne (DEC-041).
 *
 * Même identifiant, l'ancien lien invalidé à l'instant de l'écriture, la durée de
 * validité repartie de zéro (BR-013). C'est aussi, au MVP, le mécanisme de
 * récupération d'un lien perdu ou périmé (ADR-008).
 *
 * Une invitation expirée se renvoie : c'est précisément son usage. Une invitation
 * acceptée, révoquée ou remplacée ne se renvoie pas.
 */
export async function resendManagerInvitation(
  db: ManagersDatabase,
  context: AccessContext,
  invitationId: string,
  options: ManagerServiceOptions = {},
): Promise<IssuedInvitation> {
  const invitation = await loadManageableInvitation(db, context, invitationId, 'manager.invite');

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
 * Le lien devient inutilisable aussitôt. Une invitation déjà acceptée ne se
 * révoque pas : c'est alors l'ACCÈS du gestionnaire qu'il faut révoquer, ce qui
 * est une autre opération, avec d'autres conséquences.
 */
export async function revokeManagerInvitation(
  db: ManagersDatabase,
  context: AccessContext,
  invitationId: string,
  options: ManagerServiceOptions = {},
): Promise<ManagerInvitationView> {
  const invitation = await loadManageableInvitation(db, context, invitationId, 'manager.invite');

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

type ResolvedInvitation = {
  invitation: NonNullable<Awaited<ReturnType<typeof findInvitationByTokenHash>>>;
  target: User;
  properties: InvitationPropertyRow[];
};

/** Un immeuble attribuable maintenant : de la bonne organisation, et non archivé depuis. */
function stillAssignable(organizationId: string) {
  return (row: InvitationPropertyRow) =>
    row.organizationId === organizationId && row.archivedAt === null;
}

/**
 * Invitation utilisable à partir d'un jeton, ou `InvitationInvalidError`.
 *
 * Route PUBLIQUE : le jeton est la SEULE preuve. Chaque échec lève la MÊME erreur
 * avec le même message (ADR-008) : jeton mal formé, inconnu, expiré, révoqué,
 * consommé, d'un autre rôle, compte indisponible, ou tous les immeubles archivés
 * depuis l'émission. Les distinguer apprendrait à qui essaie des jetons au
 * hasard, ou à qui détient un lien, ce qu'il en est advenu.
 */
async function resolveInvitation(
  db: ManagersDatabase,
  token: string,
  now: Date,
): Promise<ResolvedInvitation> {
  if (!isWellFormedInvitationToken(token)) throw new InvitationInvalidError();

  const invitation = await findInvitationByTokenHash(db, hashInvitationToken(token));

  if (!invitation || invitation.role !== 'MANAGER') throw new InvitationInvalidError();
  if (!isInvitationOpen(invitation, now)) throw new InvitationInvalidError();
  if (invitation.targetUserId === null) throw new InvitationInvalidError();

  const target = await findUserById(db, invitation.targetUserId);

  if (!target || target.archivedAt !== null || target.status === 'SUSPENDED') {
    throw new InvitationInvalidError();
  }

  const properties = (await listInvitationProperties(db, [invitation.id])).filter(
    stillAssignable(invitation.organizationId),
  );

  if (properties.length === 0) throw new InvitationInvalidError();

  return { invitation, target, properties };
}

/**
 * Ce que la page d'activation affiche (parcours 5, étape 3).
 *
 * Ne modifie rien : consulter un lien ne le consomme pas, un aperçu chargé par un
 * navigateur ou un lecteur de liens ne doit pas brûler l'invitation.
 */
export async function previewInvitation(
  db: ManagersDatabase,
  input: { token: string; sessionUserId?: string | null },
  options: ManagerServiceOptions = {},
): Promise<InvitationPreview> {
  const { invitation, target, properties } = await resolveInvitation(
    db,
    input.token,
    nowOf(options),
  );

  const organizationName = (await findOrganizationName(db, invitation.organizationId)) ?? '';
  const inviter = await findUserById(db, invitation.invitedBy);
  const sessionUserId = input.sessionUserId ?? null;

  const mode =
    target.status === 'PENDING_ACTIVATION'
      ? 'DEFINE_PASSWORD'
      : sessionUserId === target.id
        ? 'CONFIRM'
        : 'SIGN_IN_REQUIRED';

  return {
    organizationName,
    inviterName: inviter?.fullName ?? '',
    inviteeName: target.fullName,
    phone: target.phone,
    propertyNames: properties.map((row) => row.name),
    expiresAt: invitation.expiresAt,
    mode,
    signedInAsOther: mode === 'SIGN_IN_REQUIRED' && sessionUserId !== null,
  };
}

/** Dépendances de l'acceptation qui touchent l'authentification, injectées pour la testabilité. */
export type AcceptInvitationDependencies = {
  /** Hache un mot de passe selon la politique du produit, sans rien écrire. */
  hashPassword: (password: string) => Promise<string>;
};

/**
 * Accepte une invitation (MVP-BACKLOG-025, parcours 5).
 *
 * UNE transaction, dans cet ordre, qui est celui qui rend la course inoffensive
 * (DEC-041) :
 *
 *   1. réclamer le lien par une mise à jour conditionnelle, ouvert ET non expiré ;
 *   2. relire l'invité, et refuser si son état a changé depuis l'aperçu ;
 *   3. relire les immeubles attribuables, et refuser s'il n'en reste aucun ;
 *   4. créer l'accès, ou réactiver celui d'un gestionnaire révoqué (DEC-043) ;
 *   5. attribuer le périmètre de CETTE invitation ;
 *   6. pour un compte jamais activé seulement : écrire le mot de passe et activer.
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
export async function acceptManagerInvitation(
  db: ManagersDatabase,
  dependencies: AcceptInvitationDependencies,
  input: { token: string; password?: unknown; sessionUserId?: string | null },
  options: ManagerServiceOptions = {},
): Promise<AcceptedInvitation> {
  const now = nowOf(options);
  const { password } = parseOrThrow(acceptInvitationSchema, { password: input.password });

  const { invitation, target } = await resolveInvitation(db, input.token, now);

  let passwordHash: string | null = null;

  if (target.status === 'PENDING_ACTIVATION') {
    const candidate = password ?? '';

    if (candidate.length < MIN_PASSWORD_LENGTH || candidate.length > MAX_PASSWORD_LENGTH) {
      throw new ManagerValidationError({
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

    const properties = (await listInvitationProperties(tx, [claimed.id])).filter(
      stillAssignable(claimed.organizationId),
    );

    if (properties.length === 0) throw new InvitationInvalidError();

    const existing = await findManagerAccess(tx, current.id, claimed.organizationId);
    let access: UserAccess;

    if (!existing) {
      access = await insertManagerAccess(tx, {
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

    await grantProperties(
      tx,
      access.id,
      properties.map((row) => row.id),
    );

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

// --- Liste des gestionnaires ----------------------------------------------------------

export type ManagerCollection = {
  managers: ManagerListItem[];
  meta: { total: number };
};

/**
 * Liste les gestionnaires et les invitations en attente (MVP-FEAT-019, PRD 10.2).
 *
 * Réunit deux natures, distinguées par `kind` : les accès, de tout statut, et les
 * invitations ouvertes. Les invitations acceptées ne s'y répètent pas, leur
 * gestionnaire les remplace ; les invitations révoquées n'y figurent pas, elles
 * sont annulées.
 *
 * Réservée au propriétaire (`manager.read`). Un appelant qui ne l'est dans aucune
 * organisation obtient « inexistant », comme pour toute ressource d'organisation.
 */
export async function listManagers(
  db: ManagersDatabase,
  context: AccessContext,
  options: ManagerServiceOptions = {},
): Promise<ManagerCollection> {
  const organizationIds = organizationsWhereAllowed(context, 'manager.read');

  if (organizationIds.length === 0) throw new ResourceOutOfScopeError();

  const now = nowOf(options);
  const accessRows = await listManagerAccessRows(db, organizationIds);
  const pendingRows = await listPendingInvitationRows(db, organizationIds);
  const acceptedRows = await listAcceptedInvitationRows(db, organizationIds);

  const scopes = await listActiveScopes(
    db,
    accessRows.map((row) => row.accessId),
  );
  const invitationScopes = await listInvitationProperties(
    db,
    pendingRows.map((row) => row.invitationId),
  );

  // Dernière invitation acceptée par personne et organisation, pour dater l'accès.
  const latestAccepted = new Map<string, (typeof acceptedRows)[number]>();

  for (const row of acceptedRows) {
    const key = `${row.organizationId}:${row.userId}`;
    const known = latestAccepted.get(key);

    if (!known || row.acceptedAt.getTime() > known.acceptedAt.getTime())
      latestAccepted.set(key, row);
  }

  const accessItems: ManagerListItem[] = accessRows.map((row) => {
    const accepted = latestAccepted.get(`${row.organizationId}:${row.userId}`);

    return {
      kind: 'ACCESS',
      id: row.accessId,
      organizationId: row.organizationId,
      organizationName: row.organizationName,
      fullName: row.fullName,
      phone: row.phone,
      email: row.email,
      status: row.status,
      properties: scopes.filter((scope) => scope.accessId === row.accessId).map(refOf),
      invitedAt: accepted?.issuedAt ?? null,
      activatedAt: accepted?.acceptedAt ?? null,
      expiresAt: null,
    };
  });

  const invitationItems: ManagerListItem[] = pendingRows.map((row) => {
    const status: ManagerListStatus =
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
      properties: invitationScopes
        .filter((scope) => scope.invitationId === row.invitationId)
        .map(refOf),
      invitedAt: row.issuedAt,
      activatedAt: null,
      expiresAt: row.expiresAt,
    };
  });

  const managers = [...invitationItems, ...accessItems].sort(compareManagerItems);

  return { managers, meta: { total: managers.length } };
}

// --- Vie d'un accès : fiche, périmètre, suspension, réactivation, révocation ---------------

/**
 * Accès de gestionnaire accessible à l'appelant, ou refus indiscernable d'une absence.
 *
 * Un identifiant inconnu, mal formé, d'une autre organisation, ou qui désigne un
 * accès de propriétaire ou de locataire, lève la MÊME erreur (ADR-007).
 */
async function loadManageableAccess(
  db: ManagersDatabase,
  context: AccessContext,
  accessId: string,
  permission: 'manager.read' | 'manager.update' | 'manager.revoke',
) {
  // Un identifiant qui n'est pas un UUID ne peut désigner aucun accès. Sans ce
  // contrôle PostgreSQL refuserait la conversion et produirait une erreur interne,
  // là où la réponse correcte est « inexistant ».
  if (!z.uuid().safeParse(accessId).success) throw new ResourceOutOfScopeError();

  const access = await findManagerAccessById(db, accessId);

  if (!access) throw new ResourceOutOfScopeError();

  requirePermission(context, permission, { organizationId: access.organizationId });

  return access;
}

/** Fiche d'un accès : identité, statut, périmètre actuel, dates d'invitation et d'activation. */
async function toDetailView(db: ManagersDatabase, accessId: string): Promise<ManagerDetailView> {
  const access = await findManagerAccessById(db, accessId);

  if (!access) throw new ResourceOutOfScopeError();

  const scopes = await listActiveScopes(db, [access.accessId]);
  const accepted = await findLatestAcceptedInvitation(db, access.organizationId, access.userId);

  return {
    id: access.accessId,
    organizationId: access.organizationId,
    organizationName: access.organizationName,
    fullName: access.fullName,
    phone: access.phone,
    email: access.email,
    status: access.status,
    properties: scopes.map(refOf),
    invitedAt: accepted?.issuedAt ?? null,
    activatedAt: accepted?.acceptedAt ?? null,
    statusChangedAt: access.updatedAt,
    revokedAt: access.revokedAt,
  };
}

/**
 * Pourquoi une transition d'accès a été refusée : l'état RÉEL, relu après coup.
 *
 * La transition est conditionnelle en base. Quand elle ne touche aucune ligne, c'est
 * que l'accès n'était plus dans l'état attendu ; on relit son état pour dire le vrai
 * motif plutôt qu'un refus générique.
 */
async function stateErrorOf(
  db: ManagersDatabase,
  action: 'suspend' | 'reactivate' | 'revoke' | 'update-scope',
  accessId: string,
): Promise<Error> {
  const current = await findManagerAccessById(db, accessId);

  return current ? new ManagerStateError(action, current.status) : new ResourceOutOfScopeError();
}

/** Consulte la fiche d'un gestionnaire (MVP-BACKLOG-026, PRD 10.2). */
export async function getManager(
  db: ManagersDatabase,
  context: AccessContext,
  accessId: string,
): Promise<ManagerDetailView> {
  const access = await loadManageableAccess(db, context, accessId, 'manager.read');

  return toDetailView(db, access.accessId);
}

/**
 * Modifie la liste des immeubles d'un gestionnaire (MVP-FEAT-021, DEC-042).
 *
 * La liste fournie REMPLACE la précédente. Les immeubles retirés sont révoqués, la
 * ligne restant avec son `revoked_at` ; les immeubles ajoutés sont attribués, la
 * ligne d'un immeuble déjà attribué autrefois étant RÉACTIVÉE plutôt que dupliquée.
 *
 * Seuls les immeubles AJOUTÉS doivent être actifs et de l'organisation. Un immeuble
 * déjà dans le périmètre peut y rester même s'il a été archivé depuis : le retirer
 * serait une décision du propriétaire, pas une conséquence de l'archivage.
 *
 * L'effet est immédiat : le contexte d'accès est relu en base à chaque requête. Le
 * périmètre d'un accès SUSPENDU se modifie aussi, et l'accès reste suspendu.
 *
 * Refusé pour un accès révoqué : on le réinvite, avec un périmètre neuf (DEC-043).
 */
export async function updateManagerScope(
  db: ManagersDatabase,
  context: AccessContext,
  accessId: string,
  input: unknown,
  options: ManagerServiceOptions = {},
): Promise<ManagerDetailView> {
  const data = parseOrThrow(updateManagerScopeSchema, input);
  const access = await loadManageableAccess(db, context, accessId, 'manager.update');
  const now = nowOf(options);

  await db.transaction(async (tx) => {
    // Relu DANS la transaction : l'accès a pu être révoqué depuis la lecture.
    const fresh = await findManagerAccessById(tx, access.accessId);

    if (!fresh || fresh.status === 'REVOKED') {
      throw new ManagerStateError('update-scope', 'REVOKED');
    }

    const currentIds = new Set(
      (await listActiveScopes(tx, [access.accessId])).map((row) => row.id),
    );
    const wanted = new Set(data.propertyIds);

    const additions = data.propertyIds.filter((id) => !currentIds.has(id));
    const removals = [...currentIds].filter((id) => !wanted.has(id));

    if (additions.length > 0) await loadAssignableProperties(tx, access.organizationId, additions);

    await revokeScopes(tx, access.accessId, removals, now);
    await grantProperties(tx, access.accessId, additions);
  });

  return toDetailView(db, access.accessId);
}

/**
 * Suspend un gestionnaire (DEC-044).
 *
 * Bloque l'accès à la requête suivante, en CONSERVANT le périmètre : la
 * réactivation restitue exactement l'accès d'avant. Ne touche ni le compte, ni les
 * sessions, ni les accès de la personne dans d'autres organisations.
 */
export async function suspendManager(
  db: ManagersDatabase,
  context: AccessContext,
  accessId: string,
  options: ManagerServiceOptions = {},
): Promise<ManagerDetailView> {
  const access = await loadManageableAccess(db, context, accessId, 'manager.update');
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
 * Réactive un gestionnaire suspendu (DEC-044).
 *
 * Seul un accès SUSPENDU se réactive. Un accès révoqué ne se réactive jamais : c'est
 * la réinvitation qui le fait revenir (DEC-043), avec un périmètre neuf.
 */
export async function reactivateManager(
  db: ManagersDatabase,
  context: AccessContext,
  accessId: string,
  options: ManagerServiceOptions = {},
): Promise<ManagerDetailView> {
  const access = await loadManageableAccess(db, context, accessId, 'manager.update');
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
 * Révoque l'accès d'un gestionnaire (MVP-FEAT-022, BR-019, DEC-013).
 *
 * Une seule transaction :
 *
 *   1. l'accès passe à `REVOKED`, `revoked_at` posé ;
 *   2. TOUT son périmètre est révoqué avec lui, les lignes restant ;
 *   3. ses sessions sont coupées, mais SEULEMENT s'il n'a plus aucun accès actif
 *      ailleurs : les sessions ne sont pas propres à une organisation, et couper
 *      celles d'une personne qui travaille encore pour un autre propriétaire la
 *      déconnecterait à tort.
 *
 * La révocation est déjà effective à la requête suivante sans l'étape 3 : le contexte
 * d'accès est relu en base à chaque requête. Couper les sessions évite seulement
 * qu'un navigateur reste connecté à un produit qui ne lui montre plus rien.
 *
 * L'HISTORIQUE EST CONSERVÉ. Rien n'est supprimé : ni la personne, ni sa ligne
 * d'accès, ni son périmètre passé. Les actions qu'elle a faites restent attribuées à
 * son identité (PRD 12.1). Possible depuis un accès actif comme suspendu.
 */
export async function revokeManager(
  db: ManagersDatabase,
  context: AccessContext,
  accessId: string,
  options: ManagerServiceOptions = {},
): Promise<ManagerDetailView> {
  const access = await loadManageableAccess(db, context, accessId, 'manager.revoke');
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

    await revokeAllScopes(tx, access.accessId, now);

    if ((await countActiveAccesses(tx, access.userId)) === 0) {
      await endAllSessionsOf(tx, access.userId);
    }
  });

  return toDetailView(db, access.accessId);
}
