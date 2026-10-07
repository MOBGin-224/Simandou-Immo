import { and, count, desc, eq, gt, inArray, isNull } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import * as schema from '@/db/schema';
import {
  apartments,
  invitations,
  organizations,
  properties,
  userAccess,
  users,
  type Invitation,
  type User,
  type UserAccess,
} from '@/db/schema';

/**
 * Accès aux données du module Locataires (MVP-ENG-035, MVP-ENG-036).
 *
 * Ce module ne décide RIEN. Il ne connaît ni rôle d'appelant ni permission : le
 * cas d'usage a déjà établi que l'appelant a le droit d'agir, et le dépôt
 * travaille dans ce cadre. Cette séparation est ce qui garantit qu'aucune requête
 * ne contourne la barrière d'isolation par distraction.
 *
 * Aucune concaténation de SQL (MVP-ENG-037) : tout passe par le constructeur de
 * requêtes de Drizzle.
 *
 * Chaque fonction accepte aussi bien la base qu'une TRANSACTION : une transaction
 * Drizzle expose la même interface. C'est ce qui permet au cas d'usage de
 * composer plusieurs écritures en une seule opération atomique.
 *
 * `role = 'TENANT'` figure dans CHAQUE requête qui touche un accès ou une
 * invitation. Sans cette condition, l'identifiant d'un accès de gestionnaire
 * désignerait un locataire, et les deux modules se marcheraient dessus.
 */

/** Instance Drizzle, quel que soit son pilote : postgres.js ou PGlite. */
export type TenantsDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

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
 * aussi, dans le message et dans le champ `constraint_name` : selon le pilote,
 * l'un ou l'autre est présent.
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

export async function findUserById(db: TenantsDatabase, userId: string): Promise<User | undefined> {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  return row;
}

export async function findUserByPhone(
  db: TenantsDatabase,
  phone: string,
): Promise<User | undefined> {
  const [row] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);

  return row;
}

export async function findUserByEmail(
  db: TenantsDatabase,
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
  db: TenantsDatabase,
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
 * c'est elle qui interdit qu'une invitation réécrive le nom d'une personne dont
 * le compte est actif. Nul n'a pu s'authentifier sur un compte en attente, donc
 * personne ne peut s'étonner de le voir corrigé.
 */
export async function updatePendingUser(
  db: TenantsDatabase,
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

/**
 * Change le NOM d'un utilisateur, et rien d'autre (DEC-048).
 *
 * Ni téléphone, ni email : ils exigeraient une vérification qu'aucun canal ne
 * permet au MVP (SEC-049, SEC-050), et le téléphone est de surcroît l'identifiant
 * de connexion. La requête ne les mentionne donc pas du tout, plutôt que de s'en
 * remettre à l'appelant pour ne pas les passer.
 */
export async function updateUserFullName(
  db: TenantsDatabase,
  userId: string,
  fullName: string,
  now: Date,
): Promise<User | undefined> {
  const [row] = await db
    .update(users)
    .set({ fullName, updatedAt: now })
    .where(eq(users.id, userId))
    .returning();

  return row;
}

/** Active un compte en attente : il peut désormais ouvrir une session. */
export async function activateUser(db: TenantsDatabase, userId: string, now: Date): Promise<void> {
  await db
    .update(users)
    .set({ status: 'ACTIVE', updatedAt: now })
    .where(and(eq(users.id, userId), eq(users.status, 'PENDING_ACTIVATION')));
}

// --- Accès locataire ------------------------------------------------------------

export async function findTenantAccess(
  db: TenantsDatabase,
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
        eq(userAccess.role, 'TENANT'),
      ),
    )
    .limit(1);

  return row;
}

/** Vrai si la personne est propriétaire ACTIF de l'organisation. */
export async function isOrganizationOwner(
  db: TenantsDatabase,
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

/**
 * Crée l'accès locataire d'une personne dans une organisation.
 *
 * **Aucune ligne de périmètre d'immeubles n'accompagne cet accès** (DEC-046) :
 * `manager_property_access` appartient au gestionnaire, et un locataire
 * n'atteint aucun immeuble. Son rattachement au logement passe par l'invitation
 * acceptée au Lot 7, et par son bail au Lot 8.
 */
export async function insertTenantAccess(
  db: TenantsDatabase,
  values: { userId: string; organizationId: string },
): Promise<UserAccess> {
  const [row] = await db
    .insert(userAccess)
    .values({
      userId: values.userId,
      organizationId: values.organizationId,
      role: 'TENANT',
      status: 'ACTIVE',
    })
    .returning();

  if (!row) throw new Error("L'insertion de l'accès locataire n'a renvoyé aucune ligne.");

  return row;
}

/**
 * Réactive la ligne d'accès d'un locataire révoqué, à la réinvitation (DEC-043).
 *
 * L'unicité `(user_id, organization_id, role)` interdit d'en insérer une
 * seconde : c'est la MÊME ligne qui repasse à `ACTIVE`, son `revoked_at` effacé.
 * La condition sur `REVOKED` empêche de « réactiver » un accès actif ou suspendu
 * par ce chemin.
 */
export async function reactivateRevokedAccess(
  db: TenantsDatabase,
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
 * Fait passer un accès locataire d'un statut à un autre, SI et seulement si il
 * est encore dans l'un des statuts de départ.
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
  db: TenantsDatabase,
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
        eq(userAccess.role, 'TENANT'),
        inArray(userAccess.status, [...from]),
      ),
    )
    .returning();

  return row;
}

/** Nombre d'accès ACTIFS d'une personne, toutes organisations et tous rôles confondus. */
export async function countActiveAccesses(db: TenantsDatabase, userId: string): Promise<number> {
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

// --- Logements et organisations --------------------------------------------------

export type ApartmentRow = {
  id: string;
  organizationId: string;
  propertyId: string;
  number: string;
  archivedAt: Date | null;
  propertyName: string;
  propertyArchivedAt: Date | null;
};

/**
 * Logement avec son immeuble, pour décider s'il peut recevoir une invitation.
 *
 * L'immeuble est joint parce que son archivage compte autant que celui du
 * logement : archiver un immeuble ne touche pas ses appartements, qui restent
 * individuellement actifs (BR-025). Le cas d'usage a besoin des deux états.
 */
export async function findApartmentById(
  db: TenantsDatabase,
  apartmentId: string,
): Promise<ApartmentRow | undefined> {
  const [row] = await db
    .select({
      id: apartments.id,
      organizationId: apartments.organizationId,
      propertyId: apartments.propertyId,
      number: apartments.number,
      archivedAt: apartments.archivedAt,
      propertyName: properties.name,
      propertyArchivedAt: properties.archivedAt,
    })
    .from(apartments)
    .innerJoin(properties, eq(properties.id, apartments.propertyId))
    .where(eq(apartments.id, apartmentId))
    .limit(1);

  return row;
}

/** Logements désignés par des invitations, pour construire leur vue. */
export async function findApartmentsByIds(
  db: TenantsDatabase,
  apartmentIds: readonly string[],
): Promise<ApartmentRow[]> {
  if (apartmentIds.length === 0) return [];

  return db
    .select({
      id: apartments.id,
      organizationId: apartments.organizationId,
      propertyId: apartments.propertyId,
      number: apartments.number,
      archivedAt: apartments.archivedAt,
      propertyName: properties.name,
      propertyArchivedAt: properties.archivedAt,
    })
    .from(apartments)
    .innerJoin(properties, eq(properties.id, apartments.propertyId))
    .where(inArray(apartments.id, [...apartmentIds]));
}

export async function findOrganizationName(
  db: TenantsDatabase,
  organizationId: string,
): Promise<string | undefined> {
  const [row] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  return row?.name;
}

// --- Invitations de locataire -----------------------------------------------------

export async function findInvitationById(
  db: TenantsDatabase,
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
  db: TenantsDatabase,
  tokenHash: string,
): Promise<Invitation | undefined> {
  const [row] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.tokenHash, tokenHash))
    .limit(1);

  return row;
}

/** Invitation de locataire encore OUVERTE EN BASE pour une personne, expirée ou non. */
export async function findStoredOpenInvitation(
  db: TenantsDatabase,
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
        eq(invitations.role, 'TENANT'),
        inArray(invitations.status, ['PENDING', 'SENT']),
      ),
    )
    .limit(1);

  return row;
}

export type TenantInvitationInsert = {
  organizationId: string;
  invitedBy: string;
  targetUserId: string;
  propertyId: string;
  apartmentId: string;
  contact: string;
  tokenHash: string;
  issuedAt: Date;
  expiresAt: Date;
};

/**
 * Crée l'invitation d'un locataire, avec son CONTEXTE LOCATIF (BR-014, DEC-041).
 *
 * `property_id` et `apartment_id` sont renseignés ici et nuls pour un
 * gestionnaire : ces deux colonnes existent depuis la migration des invitations
 * précisément pour le locataire. Aucune migration n'est donc nécessaire au Lot 7.
 *
 * L'immeuble est écrit en plus du logement, bien qu'il s'en déduise : le contrôle
 * d'accès a besoin de l'immeuble SANS jointure (ADR-007), comme toutes les tables
 * métier qui dénormalisent `property_id`.
 */
export async function insertTenantInvitation(
  db: TenantsDatabase,
  values: TenantInvitationInsert,
): Promise<Invitation> {
  const [row] = await db
    .insert(invitations)
    .values({
      organizationId: values.organizationId,
      invitedBy: values.invitedBy,
      targetUserId: values.targetUserId,
      role: 'TENANT',
      propertyId: values.propertyId,
      apartmentId: values.apartmentId,
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

/** Clôt une invitation périmée que l'on remplace, pour libérer l'index d'unicité partiel. */
export async function markInvitationExpired(
  db: TenantsDatabase,
  invitationId: string,
  now: Date,
): Promise<void> {
  await db
    .update(invitations)
    .set({ status: 'EXPIRED', updatedAt: now })
    .where(and(eq(invitations.id, invitationId), inArray(invitations.status, ['PENDING', 'SENT'])));
}

/**
 * Régénère le jeton d'une invitation, dans la MÊME ligne (DEC-045).
 *
 * Même identifiant, ancien hachage remplacé : l'ancien lien cesse de fonctionner
 * à l'instant où cette écriture est validée. La condition sur le statut protège
 * une invitation acceptée ou révoquée entre la lecture et l'écriture.
 */
export async function rotateInvitationToken(
  db: TenantsDatabase,
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
  db: TenantsDatabase,
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
  db: TenantsDatabase,
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

/**
 * Dernière invitation de locataire acceptée par une personne dans une
 * organisation.
 *
 * C'est elle qui porte le LOGEMENT d'un locataire actif au Lot 7 : son accès
 * n'en conserve aucun, et le bail qui le portera n'arrive qu'au Lot 8 (DEC-046).
 */
export async function findLatestAcceptedInvitation(
  db: TenantsDatabase,
  organizationId: string,
  userId: string,
): Promise<{ issuedAt: Date; acceptedAt: Date; apartmentId: string | null } | undefined> {
  const [row] = await db
    .select({
      issuedAt: invitations.issuedAt,
      acceptedAt: invitations.acceptedAt,
      apartmentId: invitations.apartmentId,
    })
    .from(invitations)
    .where(
      and(
        eq(invitations.organizationId, organizationId),
        eq(invitations.targetUserId, userId),
        eq(invitations.role, 'TENANT'),
        eq(invitations.status, 'ACCEPTED'),
      ),
    )
    .orderBy(desc(invitations.acceptedAt))
    .limit(1);

  return row && row.acceptedAt !== null
    ? { issuedAt: row.issuedAt, acceptedAt: row.acceptedAt, apartmentId: row.apartmentId }
    : undefined;
}

// --- Fiche et liste ---------------------------------------------------------------

export type TenantAccessRow = {
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
 * Accès locataire par son identifiant, avec l'identité et l'organisation.
 *
 * Le rôle est dans la requête : l'identifiant d'un accès de propriétaire, ou de
 * gestionnaire, ne désigne pas un locataire et doit se comporter comme inconnu
 * (ADR-007).
 */
export async function findTenantAccessById(
  db: TenantsDatabase,
  accessId: string,
): Promise<TenantAccessRow | undefined> {
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
    .where(and(eq(userAccess.id, accessId), eq(userAccess.role, 'TENANT')))
    .limit(1);

  return row;
}

/** Accès locataires des organisations indiquées, de tout statut. */
export async function listTenantAccessRows(
  db: TenantsDatabase,
  organizationIds: readonly string[],
): Promise<TenantAccessRow[]> {
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
      updatedAt: userAccess.updatedAt,
      revokedAt: userAccess.revokedAt,
    })
    .from(userAccess)
    .innerJoin(users, eq(users.id, userAccess.userId))
    .innerJoin(organizations, eq(organizations.id, userAccess.organizationId))
    .where(
      and(eq(userAccess.role, 'TENANT'), inArray(userAccess.organizationId, [...organizationIds])),
    );
}

export type PendingTenantInvitationRow = {
  invitationId: string;
  organizationId: string;
  organizationName: string;
  userId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: Invitation['status'];
  apartmentId: string | null;
  propertyId: string | null;
  issuedAt: Date;
  expiresAt: Date;
};

/** Invitations de locataire ouvertes EN BASE, expirées ou non : l'expiration se dérive à la lecture. */
export async function listPendingInvitationRows(
  db: TenantsDatabase,
  organizationIds: readonly string[],
): Promise<PendingTenantInvitationRow[]> {
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
      apartmentId: invitations.apartmentId,
      propertyId: invitations.propertyId,
      issuedAt: invitations.issuedAt,
      expiresAt: invitations.expiresAt,
    })
    .from(invitations)
    .innerJoin(users, eq(users.id, invitations.targetUserId))
    .innerJoin(organizations, eq(organizations.id, invitations.organizationId))
    .where(
      and(
        eq(invitations.role, 'TENANT'),
        inArray(invitations.status, ['PENDING', 'SENT']),
        inArray(invitations.organizationId, [...organizationIds]),
      ),
    )
    .orderBy(desc(invitations.issuedAt));
}

export type AcceptedTenantInvitationRow = {
  userId: string;
  organizationId: string;
  apartmentId: string | null;
  issuedAt: Date;
  acceptedAt: Date;
};

/** Invitations acceptées : elles datent l'accès et portent son logement au Lot 7. */
export async function listAcceptedInvitationRows(
  db: TenantsDatabase,
  organizationIds: readonly string[],
): Promise<AcceptedTenantInvitationRow[]> {
  if (organizationIds.length === 0) return [];

  const rows = await db
    .select({
      userId: invitations.targetUserId,
      organizationId: invitations.organizationId,
      apartmentId: invitations.apartmentId,
      issuedAt: invitations.issuedAt,
      acceptedAt: invitations.acceptedAt,
    })
    .from(invitations)
    .where(
      and(
        eq(invitations.role, 'TENANT'),
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
            apartmentId: row.apartmentId,
            issuedAt: row.issuedAt,
            acceptedAt: row.acceptedAt,
          },
        ]
      : [],
  );
}
