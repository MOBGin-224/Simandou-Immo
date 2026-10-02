import { and, asc, count, desc, eq, gt, inArray, isNull } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import * as schema from '@/db/schema';
import {
  invitationProperties,
  invitations,
  managerPropertyAccess,
  organizations,
  properties,
  userAccess,
  users,
  type Invitation,
  type User,
  type UserAccess,
} from '@/db/schema';

/**
 * Accès aux données du module Gestionnaires (MVP-ENG-035, MVP-ENG-036).
 *
 * Ce module ne décide RIEN. Il ne connaît ni rôle ni permission : le cas d'usage
 * a déjà établi que l'appelant a le droit d'agir sur l'organisation, et le dépôt
 * travaille dans ce cadre. Cette séparation est ce qui garantit qu'aucune requête
 * ne contourne la barrière d'isolation par distraction.
 *
 * Aucune concaténation de SQL (MVP-ENG-037) : tout passe par le constructeur de
 * requêtes de Drizzle.
 *
 * Chaque fonction accepte aussi bien la base qu'une TRANSACTION : une transaction
 * Drizzle expose la même interface. C'est ce qui permet au cas d'usage de
 * composer plusieurs écritures en une seule opération atomique.
 */

/** Instance Drizzle, quel que soit son pilote : postgres.js ou PGlite. */
export type ManagersDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Code SQLSTATE d'une violation de contrainte d'unicité. */
const UNIQUE_VIOLATION = '23505';

export const OPEN_INVITATION_CONSTRAINT = 'invitations_one_open_per_person';

/**
 * Une violation d'unicité, sur la contrainte indiquée.
 *
 * Le pré-contrôle par lecture ne suffit pas : entre la lecture et l'écriture, une
 * autre requête peut insérer la même ligne. La contrainte de base est le seul
 * arbitre fiable, et cette fonction permet de la traduire en erreur métier.
 *
 * Le code SQLSTATE seul ne désigne pas la contrainte. Le nom est donc vérifié
 * aussi, dans le message et dans le champ `constraint_name` : selon le pilote, l'un
 * ou l'autre est présent.
 */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const details = error as { code?: unknown; constraint_name?: unknown; constraint?: unknown };
  const message = error instanceof Error ? error.message : '';
  const cause = (error as { cause?: unknown }).cause;

  if (cause !== undefined && isUniqueViolation(cause, constraint)) return true;

  const named =
    details.constraint_name === constraint ||
    details.constraint === constraint ||
    message.includes(constraint);

  return details.code === UNIQUE_VIOLATION && named;
}

// --- Utilisateurs --------------------------------------------------------------

export async function findUserById(
  db: ManagersDatabase,
  userId: string,
): Promise<User | undefined> {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  return row;
}

export async function findUserByPhone(
  db: ManagersDatabase,
  phone: string,
): Promise<User | undefined> {
  const [row] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);

  return row;
}

export async function findUserByEmail(
  db: ManagersDatabase,
  email: string,
): Promise<User | undefined> {
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  return row;
}

/**
 * Profil préliminaire d'un invité (BR-008, DEC-041).
 *
 * `PENDING_ACTIVATION` : il n'a ni accès ni mot de passe. Le crochet de création
 * de session refuse tout compte qui n'est pas actif, donc ce profil ne permet
 * aucune connexion tant que l'invité n'a pas accepté.
 */
export async function insertPendingUser(
  db: ManagersDatabase,
  values: { fullName: string; phone: string; email: string | null },
): Promise<User> {
  const [row] = await db
    .insert(users)
    .values({
      fullName: values.fullName,
      phone: values.phone,
      email: values.email,
      status: 'PENDING_ACTIVATION',
    })
    .returning();

  if (!row) throw new Error("L'insertion du profil préliminaire n'a renvoyé aucune ligne.");

  return row;
}

/**
 * Met à jour le profil d'un utilisateur qui n'a JAMAIS été activé.
 *
 * La condition sur le statut est dans la requête, pas seulement dans l'appelant :
 * c'est elle qui interdit qu'une invitation réécrive le nom d'une personne dont le
 * compte est actif. Nul n'a pu s'authentifier sur un compte en attente, donc
 * personne ne peut s'étonner de le voir corrigé.
 */
export async function updatePendingUser(
  db: ManagersDatabase,
  userId: string,
  values: { fullName: string; email: string | null },
): Promise<User | undefined> {
  const [row] = await db
    .update(users)
    .set({ fullName: values.fullName, email: values.email, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.status, 'PENDING_ACTIVATION')))
    .returning();

  return row;
}

/** Passe un profil préliminaire à `ACTIVE`, à l'acceptation d'une invitation. */
export async function activateUser(db: ManagersDatabase, userId: string, now: Date): Promise<void> {
  await db
    .update(users)
    .set({ status: 'ACTIVE', updatedAt: now })
    .where(and(eq(users.id, userId), eq(users.status, 'PENDING_ACTIVATION')));
}

// --- Accès et périmètre --------------------------------------------------------

export async function findManagerAccess(
  db: ManagersDatabase,
  userId: string,
  organizationId: string,
): Promise<UserAccess | undefined> {
  const [row] = await db
    .select()
    .from(userAccess)
    .where(
      and(
        eq(userAccess.userId, userId),
        eq(userAccess.organizationId, organizationId),
        eq(userAccess.role, 'MANAGER'),
      ),
    )
    .limit(1);

  return row;
}

/** Vrai si la personne est propriétaire ACTIF de l'organisation. */
export async function isOrganizationOwner(
  db: ManagersDatabase,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: userAccess.id })
    .from(userAccess)
    .where(
      and(
        eq(userAccess.userId, userId),
        eq(userAccess.organizationId, organizationId),
        eq(userAccess.role, 'OWNER'),
        eq(userAccess.status, 'ACTIVE'),
      ),
    )
    .limit(1);

  return row !== undefined;
}

export async function insertManagerAccess(
  db: ManagersDatabase,
  values: { userId: string; organizationId: string },
): Promise<UserAccess> {
  const [row] = await db
    .insert(userAccess)
    .values({
      userId: values.userId,
      organizationId: values.organizationId,
      role: 'MANAGER',
      status: 'ACTIVE',
    })
    .returning();

  if (!row) throw new Error("L'insertion de l'accès n'a renvoyé aucune ligne.");

  return row;
}

/**
 * Réactive la ligne d'accès d'un gestionnaire révoqué (DEC-043).
 *
 * L'unicité `(user_id, organization_id, role)` interdit d'en insérer une seconde :
 * c'est la MÊME ligne qui repasse à `ACTIVE`, son `revoked_at` effacé. Aucune
 * action passée n'est touchée, car elles sont attribuées à l'utilisateur et non à
 * cette ligne. La condition sur `REVOKED` empêche de « réactiver » un accès actif
 * ou suspendu par ce chemin.
 */
export async function reactivateRevokedAccess(
  db: ManagersDatabase,
  accessId: string,
  now: Date,
): Promise<UserAccess | undefined> {
  const [row] = await db
    .update(userAccess)
    .set({ status: 'ACTIVE', revokedAt: null, updatedAt: now })
    .where(and(eq(userAccess.id, accessId), eq(userAccess.status, 'REVOKED')))
    .returning();

  return row;
}

/**
 * Attribue des immeubles à un accès.
 *
 * L'unicité `(user_access_id, property_id)` couvre AUSSI les lignes révoquées :
 * attribuer de nouveau un immeuble retiré auparavant ne peut pas en insérer une
 * seconde. La ligne existante est donc réactivée, par `ON CONFLICT`. Les lignes
 * qui ne sont pas dans la liste ne sont PAS touchées : un immeuble révoqué que la
 * nouvelle invitation n'attribue pas reste révoqué (DEC-043).
 */
export async function grantProperties(
  db: ManagersDatabase,
  accessId: string,
  propertyIds: readonly string[],
): Promise<void> {
  if (propertyIds.length === 0) return;

  await db
    .insert(managerPropertyAccess)
    .values(
      propertyIds.map((propertyId) => ({
        userAccessId: accessId,
        propertyId,
        accessLevel: 'MANAGE' as const,
      })),
    )
    .onConflictDoUpdate({
      target: [managerPropertyAccess.userAccessId, managerPropertyAccess.propertyId],
      set: { revokedAt: null },
    });
}

// --- Immeubles et organisations -------------------------------------------------

export type PropertyRow = {
  id: string;
  organizationId: string;
  name: string;
  archivedAt: Date | null;
};

export async function findPropertiesByIds(
  db: ManagersDatabase,
  propertyIds: readonly string[],
): Promise<PropertyRow[]> {
  if (propertyIds.length === 0) return [];

  return db
    .select({
      id: properties.id,
      organizationId: properties.organizationId,
      name: properties.name,
      archivedAt: properties.archivedAt,
    })
    .from(properties)
    .where(inArray(properties.id, [...propertyIds]));
}

export async function findOrganizationName(
  db: ManagersDatabase,
  organizationId: string,
): Promise<string | undefined> {
  const [row] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  return row?.name;
}

// --- Invitations ---------------------------------------------------------------

export async function findInvitationById(
  db: ManagersDatabase,
  invitationId: string,
): Promise<Invitation | undefined> {
  const [row] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.id, invitationId))
    .limit(1);

  return row;
}

/** Invitation par hachage de jeton. Le jeton lui-même n'arrive JAMAIS jusqu'ici. */
export async function findInvitationByTokenHash(
  db: ManagersDatabase,
  tokenHash: string,
): Promise<Invitation | undefined> {
  const [row] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.tokenHash, tokenHash))
    .limit(1);

  return row;
}

/** Invitation de gestionnaire encore OUVERTE EN BASE pour une personne, expirée ou non. */
export async function findStoredOpenInvitation(
  db: ManagersDatabase,
  organizationId: string,
  userId: string,
): Promise<Invitation | undefined> {
  const [row] = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, organizationId),
        eq(invitations.targetUserId, userId),
        eq(invitations.role, 'MANAGER'),
        inArray(invitations.status, ['PENDING', 'SENT']),
      ),
    )
    .limit(1);

  return row;
}

export type InvitationInsert = {
  organizationId: string;
  invitedBy: string;
  targetUserId: string;
  contact: string;
  tokenHash: string;
  issuedAt: Date;
  expiresAt: Date;
};

export async function insertManagerInvitation(
  db: ManagersDatabase,
  values: InvitationInsert,
): Promise<Invitation> {
  const [row] = await db
    .insert(invitations)
    .values({
      organizationId: values.organizationId,
      invitedBy: values.invitedBy,
      targetUserId: values.targetUserId,
      role: 'MANAGER',
      contact: values.contact,
      tokenHash: values.tokenHash,
      status: 'PENDING',
      issuedAt: values.issuedAt,
      expiresAt: values.expiresAt,
    })
    .returning();

  if (!row) throw new Error("L'insertion de l'invitation n'a renvoyé aucune ligne.");

  return row;
}

export async function insertInvitationProperties(
  db: ManagersDatabase,
  invitationId: string,
  propertyIds: readonly string[],
): Promise<void> {
  if (propertyIds.length === 0) return;

  await db
    .insert(invitationProperties)
    .values(propertyIds.map((propertyId) => ({ invitationId, propertyId })));
}

/** Clôt une invitation périmée que l'on remplace, pour libérer l'index d'unicité partiel. */
export async function markInvitationExpired(
  db: ManagersDatabase,
  invitationId: string,
  now: Date,
): Promise<void> {
  await db
    .update(invitations)
    .set({ status: 'EXPIRED', updatedAt: now })
    .where(and(eq(invitations.id, invitationId), inArray(invitations.status, ['PENDING', 'SENT'])));
}

/**
 * Régénère le jeton d'une invitation, dans la MÊME ligne (DEC-041).
 *
 * Même identifiant, ancien hachage remplacé : l'ancien lien cesse de fonctionner à
 * l'instant où cette écriture est validée. La condition sur le statut protège une
 * invitation acceptée ou révoquée entre la lecture et l'écriture.
 */
export async function rotateInvitationToken(
  db: ManagersDatabase,
  invitationId: string,
  values: { tokenHash: string; issuedAt: Date; expiresAt: Date },
): Promise<Invitation | undefined> {
  const [row] = await db
    .update(invitations)
    .set({
      tokenHash: values.tokenHash,
      status: 'PENDING',
      issuedAt: values.issuedAt,
      expiresAt: values.expiresAt,
      updatedAt: values.issuedAt,
    })
    .where(and(eq(invitations.id, invitationId), inArray(invitations.status, ['PENDING', 'SENT'])))
    .returning();

  return row;
}

/** Révoque une invitation qui n'a pas été acceptée. */
export async function revokeInvitationRow(
  db: ManagersDatabase,
  invitationId: string,
  now: Date,
): Promise<Invitation | undefined> {
  const [row] = await db
    .update(invitations)
    .set({ status: 'REVOKED', revokedAt: now, updatedAt: now })
    .where(
      and(
        eq(invitations.id, invitationId),
        inArray(invitations.status, ['PENDING', 'SENT', 'EXPIRED']),
      ),
    )
    .returning();

  return row;
}

/**
 * Réclame une invitation pour l'accepter, de façon ATOMIQUE (DEC-041, DEC-045).
 *
 * Une seule instruction vérifie ET consomme : ouverte, non expirée. Deux
 * acceptations simultanées du même lien se retrouvent face à la même ligne : la
 * seconde attend la validation de la première, relit la condition, ne trouve plus
 * de ligne ouverte, et obtient `undefined`. Contrôler l'état dans une lecture
 * puis écrire dans une autre laisserait passer les deux.
 *
 * La borne `expires_at > now` est celle de `effectiveInvitationStatus` : aucun
 * intervalle ne sépare le contrôle de l'expiration de l'usage du lien.
 */
export async function claimInvitation(
  db: ManagersDatabase,
  invitationId: string,
  now: Date,
): Promise<Invitation | undefined> {
  const [row] = await db
    .update(invitations)
    .set({ status: 'ACCEPTED', acceptedAt: now, updatedAt: now })
    .where(
      and(
        eq(invitations.id, invitationId),
        inArray(invitations.status, ['PENDING', 'SENT']),
        gt(invitations.expiresAt, now),
      ),
    )
    .returning();

  return row;
}

export type InvitationPropertyRow = {
  invitationId: string;
  id: string;
  organizationId: string;
  name: string;
  archivedAt: Date | null;
};

/** Immeubles attribués par des invitations, avec leur nom et leur état d'archivage. */
export async function listInvitationProperties(
  db: ManagersDatabase,
  invitationIds: readonly string[],
): Promise<InvitationPropertyRow[]> {
  if (invitationIds.length === 0) return [];

  return db
    .select({
      invitationId: invitationProperties.invitationId,
      id: properties.id,
      organizationId: properties.organizationId,
      name: properties.name,
      archivedAt: properties.archivedAt,
    })
    .from(invitationProperties)
    .innerJoin(properties, eq(properties.id, invitationProperties.propertyId))
    .where(inArray(invitationProperties.invitationId, [...invitationIds]))
    .orderBy(asc(properties.name));
}

// --- Liste des gestionnaires ----------------------------------------------------

export type ManagerAccessRow = {
  accessId: string;
  organizationId: string;
  organizationName: string;
  userId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: UserAccess['status'];
};

export async function listManagerAccessRows(
  db: ManagersDatabase,
  organizationIds: readonly string[],
): Promise<ManagerAccessRow[]> {
  if (organizationIds.length === 0) return [];

  return db
    .select({
      accessId: userAccess.id,
      organizationId: userAccess.organizationId,
      organizationName: organizations.name,
      userId: users.id,
      fullName: users.fullName,
      phone: users.phone,
      email: users.email,
      status: userAccess.status,
    })
    .from(userAccess)
    .innerJoin(users, eq(users.id, userAccess.userId))
    .innerJoin(organizations, eq(organizations.id, userAccess.organizationId))
    .where(
      and(eq(userAccess.role, 'MANAGER'), inArray(userAccess.organizationId, [...organizationIds])),
    );
}

export type ScopeRow = {
  accessId: string;
  id: string;
  name: string;
  archivedAt: Date | null;
};

/** Immeubles ACTUELLEMENT accessibles aux accès donnés : les lignes révoquées sont exclues. */
export async function listActiveScopes(
  db: ManagersDatabase,
  accessIds: readonly string[],
): Promise<ScopeRow[]> {
  if (accessIds.length === 0) return [];

  return db
    .select({
      accessId: managerPropertyAccess.userAccessId,
      id: properties.id,
      name: properties.name,
      archivedAt: properties.archivedAt,
    })
    .from(managerPropertyAccess)
    .innerJoin(properties, eq(properties.id, managerPropertyAccess.propertyId))
    .where(
      and(
        inArray(managerPropertyAccess.userAccessId, [...accessIds]),
        isNull(managerPropertyAccess.revokedAt),
      ),
    )
    .orderBy(asc(properties.name));
}

export type PendingInvitationRow = {
  invitationId: string;
  organizationId: string;
  organizationName: string;
  userId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: Invitation['status'];
  issuedAt: Date;
  expiresAt: Date;
};

/** Invitations de gestionnaire ouvertes EN BASE, expirées ou non : l'expiration se dérive à la lecture. */
export async function listPendingInvitationRows(
  db: ManagersDatabase,
  organizationIds: readonly string[],
): Promise<PendingInvitationRow[]> {
  if (organizationIds.length === 0) return [];

  return db
    .select({
      invitationId: invitations.id,
      organizationId: invitations.organizationId,
      organizationName: organizations.name,
      userId: users.id,
      fullName: users.fullName,
      phone: users.phone,
      email: users.email,
      status: invitations.status,
      issuedAt: invitations.issuedAt,
      expiresAt: invitations.expiresAt,
    })
    .from(invitations)
    .innerJoin(users, eq(users.id, invitations.targetUserId))
    .innerJoin(organizations, eq(organizations.id, invitations.organizationId))
    .where(
      and(
        eq(invitations.role, 'MANAGER'),
        inArray(invitations.status, ['PENDING', 'SENT']),
        inArray(invitations.organizationId, [...organizationIds]),
      ),
    )
    .orderBy(desc(invitations.issuedAt));
}

export type AcceptedInvitationRow = {
  userId: string;
  organizationId: string;
  issuedAt: Date;
  acceptedAt: Date;
};

/** Invitations acceptées, pour dater l'invitation et l'activation d'un gestionnaire. */
export async function listAcceptedInvitationRows(
  db: ManagersDatabase,
  organizationIds: readonly string[],
): Promise<AcceptedInvitationRow[]> {
  if (organizationIds.length === 0) return [];

  const rows = await db
    .select({
      userId: invitations.targetUserId,
      organizationId: invitations.organizationId,
      issuedAt: invitations.issuedAt,
      acceptedAt: invitations.acceptedAt,
    })
    .from(invitations)
    .where(
      and(
        eq(invitations.role, 'MANAGER'),
        eq(invitations.status, 'ACCEPTED'),
        inArray(invitations.organizationId, [...organizationIds]),
      ),
    );

  return rows.flatMap((row) =>
    row.userId !== null && row.acceptedAt !== null
      ? [
          {
            userId: row.userId,
            organizationId: row.organizationId,
            issuedAt: row.issuedAt,
            acceptedAt: row.acceptedAt,
          },
        ]
      : [],
  );
}

// --- Vie d'un accès : fiche, périmètre, suspension, révocation (DEC-044) ---------------

export type ManagerAccessDetailRow = {
  accessId: string;
  organizationId: string;
  organizationName: string;
  userId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: UserAccess['status'];
  updatedAt: Date;
  revokedAt: Date | null;
};

/**
 * Accès de GESTIONNAIRE par identifiant, SANS aucun contrôle d'accès.
 *
 * Le rôle est dans la requête : l'identifiant d'un accès de propriétaire, ou de
 * locataire, ne désigne pas un gestionnaire et doit se comporter comme inconnu.
 */
export async function findManagerAccessById(
  db: ManagersDatabase,
  accessId: string,
): Promise<ManagerAccessDetailRow | undefined> {
  const [row] = await db
    .select({
      accessId: userAccess.id,
      organizationId: userAccess.organizationId,
      organizationName: organizations.name,
      userId: users.id,
      fullName: users.fullName,
      phone: users.phone,
      email: users.email,
      status: userAccess.status,
      updatedAt: userAccess.updatedAt,
      revokedAt: userAccess.revokedAt,
    })
    .from(userAccess)
    .innerJoin(users, eq(users.id, userAccess.userId))
    .innerJoin(organizations, eq(organizations.id, userAccess.organizationId))
    .where(and(eq(userAccess.id, accessId), eq(userAccess.role, 'MANAGER')))
    .limit(1);

  return row;
}

/**
 * Fait passer un accès d'un statut à un autre, SI et seulement si il est encore dans
 * l'un des statuts de départ.
 *
 * La condition est dans la requête et non dans une lecture préalable : deux
 * opérations simultanées sur le même accès, une suspension et une révocation par
 * exemple, se retrouvent face à la même ligne, et la seconde relit la condition.
 * `undefined` signifie que l'accès n'était plus dans l'état attendu.
 *
 * `revoked_at` suit le statut : posé à la révocation, effacé sinon. Le loader du
 * contexte d'accès exige les deux conditions, `ACTIVE` ET non révoqué.
 */
export async function transitionAccess(
  db: ManagersDatabase,
  accessId: string,
  from: readonly UserAccess['status'][],
  to: UserAccess['status'],
  now: Date,
): Promise<UserAccess | undefined> {
  const [row] = await db
    .update(userAccess)
    .set({ status: to, revokedAt: to === 'REVOKED' ? now : null, updatedAt: now })
    .where(
      and(
        eq(userAccess.id, accessId),
        eq(userAccess.role, 'MANAGER'),
        inArray(userAccess.status, [...from]),
      ),
    )
    .returning();

  return row;
}

/**
 * Révoque des immeubles du périmètre : la ligne reste, `revoked_at` est posé.
 *
 * Jamais de suppression : l'historique de ce qu'un gestionnaire a pu voir se conserve
 * (DEC-013). Seules les lignes encore actives sont touchées, pour ne pas écraser la
 * date d'une révocation plus ancienne.
 */
export async function revokeScopes(
  db: ManagersDatabase,
  accessId: string,
  propertyIds: readonly string[],
  now: Date,
): Promise<void> {
  if (propertyIds.length === 0) return;

  await db
    .update(managerPropertyAccess)
    .set({ revokedAt: now })
    .where(
      and(
        eq(managerPropertyAccess.userAccessId, accessId),
        inArray(managerPropertyAccess.propertyId, [...propertyIds]),
        isNull(managerPropertyAccess.revokedAt),
      ),
    );
}

/** Révoque TOUT le périmètre encore actif d'un accès, avec lui (BR-019). */
export async function revokeAllScopes(
  db: ManagersDatabase,
  accessId: string,
  now: Date,
): Promise<void> {
  await db
    .update(managerPropertyAccess)
    .set({ revokedAt: now })
    .where(
      and(
        eq(managerPropertyAccess.userAccessId, accessId),
        isNull(managerPropertyAccess.revokedAt),
      ),
    );
}

/** Nombre d'accès ACTIFS d'une personne, toutes organisations et tous rôles confondus. */
export async function countActiveAccesses(db: ManagersDatabase, userId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(userAccess)
    .where(
      and(
        eq(userAccess.userId, userId),
        eq(userAccess.status, 'ACTIVE'),
        isNull(userAccess.revokedAt),
      ),
    );

  return row?.total ?? 0;
}

/** Dernière invitation de gestionnaire acceptée par une personne, pour dater son accès. */
export async function findLatestAcceptedInvitation(
  db: ManagersDatabase,
  organizationId: string,
  userId: string,
): Promise<{ issuedAt: Date; acceptedAt: Date } | undefined> {
  const [row] = await db
    .select({ issuedAt: invitations.issuedAt, acceptedAt: invitations.acceptedAt })
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, organizationId),
        eq(invitations.targetUserId, userId),
        eq(invitations.role, 'MANAGER'),
        eq(invitations.status, 'ACCEPTED'),
      ),
    )
    .orderBy(desc(invitations.acceptedAt))
    .limit(1);

  return row && row.acceptedAt !== null
    ? { issuedAt: row.issuedAt, acceptedAt: row.acceptedAt }
    : undefined;
}
