import {
  and,
  asc,
  count as countRows,
  desc,
  eq,
  inArray,
  isNull,
  notInArray,
  or,
  type SQL,
} from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import * as schema from '@/db/schema';
import {
  apartments,
  invitations,
  leases,
  organizations,
  properties,
  userAccess,
  users,
  type Lease,
} from '@/db/schema';

/**
 * Accès aux données du module Contrats (MVP-ENG-035, MVP-ENG-036).
 *
 * Ce module ne décide RIEN. Il ne connaît ni rôle ni permission : le cas d'usage
 * a déjà établi que l'appelant a le droit d'agir, et le dépôt travaille dans ce
 * cadre. Cette séparation est ce qui garantit qu'aucune requête ne contourne la
 * barrière d'isolation par distraction.
 *
 * Aucune concaténation de SQL (MVP-ENG-037) : tout passe par le constructeur de
 * requêtes de Drizzle.
 *
 * Chaque fonction accepte aussi bien la base qu'une TRANSACTION.
 */

/** Instance Drizzle, quel que soit son pilote : postgres.js ou PGlite. */
export type LeasesDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Code SQLSTATE d'une violation de contrainte d'unicité. */
const UNIQUE_VIOLATION = '23505';

export const ACTIVE_PER_APARTMENT_CONSTRAINT = 'leases_one_active_per_apartment';
export const ACTIVE_PER_TENANT_CONSTRAINT = 'leases_one_active_per_tenant_and_organization';

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

// --- Logement visé ----------------------------------------------------------------

export type ApartmentRow = {
  id: string;
  organizationId: string;
  propertyId: string;
  number: string;
  archivedAt: Date | null;
  propertyName: string;
  propertyArchivedAt: Date | null;
  /** Loyer de référence du logement, pour préremplir le formulaire (DEC-014). */
  referenceRentAmount: number | null;
  referenceCurrency: string | null;
};

/**
 * Logement avec son immeuble.
 *
 * L'immeuble est joint parce que son archivage compte autant que celui du
 * logement : archiver un immeuble ne touche pas ses appartements, qui restent
 * individuellement actifs (BR-025).
 */
export async function findApartmentById(
  db: LeasesDatabase,
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
      referenceRentAmount: apartments.referenceRentAmount,
      referenceCurrency: apartments.currency,
    })
    .from(apartments)
    .innerJoin(properties, eq(properties.id, apartments.propertyId))
    .where(eq(apartments.id, apartmentId))
    .limit(1);

  return row;
}

/** Logements de plusieurs baux, pour construire leurs vues en une lecture. */
export async function findApartmentsByIds(
  db: LeasesDatabase,
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
      referenceRentAmount: apartments.referenceRentAmount,
      referenceCurrency: apartments.currency,
    })
    .from(apartments)
    .innerJoin(properties, eq(properties.id, apartments.propertyId))
    .where(inArray(apartments.id, [...apartmentIds]));
}

// --- Locataire visé ---------------------------------------------------------------

export type TenantPersonRow = {
  userId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: 'PENDING_ACTIVATION' | 'ACTIVE' | 'SUSPENDED';
  archivedAt: Date | null;
};

/**
 * Personne à qui un bail peut être attribué, par son identité métier (DEC-051).
 *
 * `users.id` et non `user_access.id` : le bail rattache une PERSONNE à un
 * logement, et cette personne n'a pas forcément d'accès au produit. Chercher un
 * accès ici rendrait impossible le locataire qui n'utilisera jamais
 * l'application, celui-là même que DEC-051 veut représenter.
 *
 * Aucun rôle n'est exigé : c'est le bail qui CRÉE la relation locative, et non
 * un accès préexistant qui l'autoriserait.
 */
export async function findPersonById(
  db: LeasesDatabase,
  userId: string,
): Promise<TenantPersonRow | undefined> {
  const [row] = await db
    .select({
      userId: users.id,
      fullName: users.fullName,
      phone: users.phone,
      email: users.email,
      status: users.status,
      archivedAt: users.archivedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return row;
}

/**
 * Une organisation connaît-elle déjà cette personne ?
 *
 * `users` est une table GLOBALE : une personne y existe sans appartenir à
 * personne. Sans cette vérification, un bailleur pourrait attribuer un bail à un
 * identifiant quelconque et lire en retour le nom et le téléphone d'une personne
 * d'un autre bailleur. L'organisation ne doit donc écrire que sur des personnes
 * dont elle a déjà une trace.
 *
 * Les trois traces possibles sont lues, et aucune n'exige un accès au produit
 * (DEC-051) :
 *
 *   - un `user_access`, quel que soit son statut, même révoqué (DEC-047) ;
 *   - une invitation, quel que soit son sort, même expirée ou révoquée ;
 *   - un bail, quel que soit son statut, même terminé.
 *
 * C'est ce qui laisse exister le locataire sans compte : sa trace est son
 * invitation ou son bail, jamais un droit d'accès.
 */
export async function isPersonKnownToOrganization(
  db: LeasesDatabase,
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const [access, invitation, lease] = await Promise.all([
    db
      .select({ id: userAccess.id })
      .from(userAccess)
      .where(and(eq(userAccess.organizationId, organizationId), eq(userAccess.userId, userId)))
      .limit(1),
    db
      .select({ id: invitations.id })
      .from(invitations)
      .where(
        and(eq(invitations.organizationId, organizationId), eq(invitations.targetUserId, userId)),
      )
      .limit(1),
    db
      .select({ id: leases.id })
      .from(leases)
      .where(and(eq(leases.organizationId, organizationId), eq(leases.tenantUserId, userId)))
      .limit(1),
  ]);

  return access.length > 0 || invitation.length > 0 || lease.length > 0;
}

export type PersonRow = {
  userId: string;
  accessId: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
};

/**
 * Personnes des baux lus, avec leur accès locataire s'il existe.
 *
 * L'accès est joint en LEFT JOIN et peut rester nul : une personne peut être la
 * locataire d'un logement sans avoir aucun accès au produit (BR-020, DEC-046).
 * C'est la différence même entre « occuper un logement » et « utiliser
 * l'application ».
 */
export async function findPeopleByIds(
  db: LeasesDatabase,
  userIds: readonly string[],
  organizationIds: readonly string[],
): Promise<PersonRow[]> {
  if (userIds.length === 0) return [];

  const rows = await db
    .select({
      userId: users.id,
      accessId: userAccess.id,
      organizationId: userAccess.organizationId,
      fullName: users.fullName,
      phone: users.phone,
      email: users.email,
    })
    .from(users)
    .leftJoin(
      userAccess,
      and(
        eq(userAccess.userId, users.id),
        eq(userAccess.role, 'TENANT'),
        organizationIds.length > 0
          ? inArray(userAccess.organizationId, [...organizationIds])
          : undefined,
      ),
    )
    .where(inArray(users.id, [...userIds]));

  const byUser = new Map<string, PersonRow>();

  for (const row of rows) {
    const known = byUser.get(row.userId);

    // Une personne peut avoir un accès dans plusieurs organisations lues : on
    // garde le premier accès trouvé, le lien ne servant qu'à ouvrir sa fiche.
    if (!known || (known.accessId === null && row.accessId !== null)) {
      byUser.set(row.userId, {
        userId: row.userId,
        accessId: row.accessId,
        fullName: row.fullName,
        phone: row.phone,
        email: row.email,
      });
    }
  }

  return [...byUser.values()];
}

// --- Baux ---------------------------------------------------------------------------

export async function findLeaseById(
  db: LeasesDatabase,
  leaseId: string,
): Promise<Lease | undefined> {
  const [row] = await db.select().from(leases).where(eq(leases.id, leaseId)).limit(1);

  return row;
}

export async function findOrganizationName(
  db: LeasesDatabase,
  organizationId: string,
): Promise<string | undefined> {
  const [row] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  return row?.name;
}

/** Bail ACTIF d'un logement, s'il en a un. C'est lui qui porte l'occupation (DEC-050). */
export async function findActiveLeaseForApartment(
  db: LeasesDatabase,
  apartmentId: string,
): Promise<Lease | undefined> {
  const [row] = await db
    .select()
    .from(leases)
    .where(and(eq(leases.apartmentId, apartmentId), eq(leases.status, 'ACTIVE')))
    .limit(1);

  return row;
}

/** Bail ACTIF d'une personne dans une organisation, s'il en a un (DEC-049). */
export async function findActiveLeaseForTenant(
  db: LeasesDatabase,
  organizationId: string,
  tenantUserId: string,
): Promise<Lease | undefined> {
  const [row] = await db
    .select()
    .from(leases)
    .where(
      and(
        eq(leases.organizationId, organizationId),
        eq(leases.tenantUserId, tenantUserId),
        eq(leases.status, 'ACTIVE'),
      ),
    )
    .limit(1);

  return row;
}

/** Baux ACTIFS des personnes indiquées, pour rattacher un locataire à son logement. */
export async function findActiveLeasesForTenants(
  db: LeasesDatabase,
  organizationIds: readonly string[],
  tenantUserIds: readonly string[],
): Promise<Lease[]> {
  if (organizationIds.length === 0 || tenantUserIds.length === 0) return [];

  return db
    .select()
    .from(leases)
    .where(
      and(
        inArray(leases.organizationId, [...organizationIds]),
        inArray(leases.tenantUserId, [...tenantUserIds]),
        eq(leases.status, 'ACTIVE'),
      ),
    );
}

// --- Occupation, telle que les autres modules la lisent (DEC-050) -----------------

/*
 * Ces trois lectures existent pour UNE raison : « occupé » ne doit avoir qu'une
 * seule définition. Depuis le Lot 8b, les modules Appartements et Immeubles
 * n'affichent plus une saisie mais une déduction, et s'ils la recalculaient
 * chacun de leur côté, deux écrans finiraient par ne plus dire la même chose du
 * même logement.
 *
 * Elles ne décident rien et ne vérifient aucune permission : l'appelant a déjà
 * établi son périmètre, et c'est lui qui choisit les logements à interroger.
 */

/** Parmi les logements indiqués, ceux qui portent un bail en cours. */
export async function findOccupiedApartmentIds(
  db: LeasesDatabase,
  apartmentIds: readonly string[],
): Promise<string[]> {
  if (apartmentIds.length === 0) return [];

  const rows = await db
    .selectDistinct({ apartmentId: leases.apartmentId })
    .from(leases)
    .where(and(inArray(leases.apartmentId, [...apartmentIds]), eq(leases.status, 'ACTIVE')));

  return rows.map((row) => row.apartmentId);
}

/**
 * Logements d'un immeuble qui portent un bail en cours.
 *
 * Nécessaire en plus de la précédente parce que le FILTRE d'une liste doit
 * s'appliquer en SQL : filtrer après la pagination donnerait des pages
 * incomplètes, et un total faux.
 */
export async function findOccupiedApartmentIdsInProperty(
  db: LeasesDatabase,
  propertyId: string,
): Promise<string[]> {
  const rows = await db
    .selectDistinct({ apartmentId: leases.apartmentId })
    .from(leases)
    .where(and(eq(leases.propertyId, propertyId), eq(leases.status, 'ACTIVE')));

  return rows.map((row) => row.apartmentId);
}

/**
 * Nombre de logements occupés par immeuble, agrégé par la base.
 *
 * Les compteurs de la liste des immeubles en ont besoin pour vingt immeubles à
 * la fois : une requête par immeuble ferait vingt et une requêtes là où une
 * seule suffit.
 */
export async function countOccupiedByProperty(
  db: LeasesDatabase,
  propertyIds: readonly string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  if (propertyIds.length === 0) return counts;

  /*
   * Jointure sur `apartments` pour exclure les logements ARCHIVÉS : ils ne font
   * plus partie du parc exploité, et les compter gonflerait le taux d'occupation
   * de l'immeuble. Les compteurs de `occupancyByProperty` les excluent déjà.
   */
  const rows = await db
    .select({ propertyId: leases.propertyId, value: countRows() })
    .from(leases)
    .innerJoin(apartments, eq(apartments.id, leases.apartmentId))
    .where(
      and(
        inArray(leases.propertyId, [...propertyIds]),
        eq(leases.status, 'ACTIVE'),
        isNull(apartments.archivedAt),
      ),
    )
    .groupBy(leases.propertyId);

  for (const row of rows) counts.set(row.propertyId, row.value);

  return counts;
}

export type LeaseInsert = {
  organizationId: string;
  propertyId: string;
  apartmentId: string;
  tenantUserId: string;
  startDate: string;
  endDate: string | null;
  rentAmount: number;
  currency: string;
  dueDay: number;
  depositAmount: number;
};

/**
 * Crée un bail ACTIF.
 *
 * Le statut est écrit EXPLICITEMENT plutôt que laissé au défaut de la colonne :
 * le défaut est `DRAFT`, réservé à un lot futur, et un bail du MVP naît actif.
 */
export async function insertLease(db: LeasesDatabase, values: LeaseInsert): Promise<Lease> {
  const [row] = await db
    .insert(leases)
    .values({ ...values, status: 'ACTIVE' })
    .returning();

  if (!row) throw new Error("L'insertion du bail n'a renvoyé aucune ligne.");

  return row;
}

export type LeaseChanges = {
  startDate?: string;
  endDate?: string | null;
  rentAmount?: number;
  currency?: string;
  dueDay?: number;
  depositAmount?: number;
};

/**
 * Modifie un bail, SI et seulement si il est encore modifiable.
 *
 * La condition sur le statut est dans la requête et non dans une lecture
 * préalable : une clôture concurrente doit faire perdre la modification, et non
 * l'inverse. `undefined` signifie que le bail n'était plus modifiable.
 */
export async function updateLeaseRow(
  db: LeasesDatabase,
  leaseId: string,
  changes: LeaseChanges,
  now: Date,
): Promise<Lease | undefined> {
  const [row] = await db
    .update(leases)
    .set({ ...changes, updatedAt: now })
    .where(and(eq(leases.id, leaseId), inArray(leases.status, ['DRAFT', 'ACTIVE'])))
    .returning();

  return row;
}

/**
 * Clôture un bail, SI et seulement si il est encore actif.
 *
 * La date de fin devient la date de clôture : c'est elle qui empêchera la
 * génération d'échéances au-delà, au Lot 9. `terminated_at` enregistre l'instant
 * de la décision, et la contrainte de base interdit l'un sans l'autre.
 */
export async function terminateLeaseRow(
  db: LeasesDatabase,
  leaseId: string,
  values: { endDate: string; reason: string | null; now: Date },
): Promise<Lease | undefined> {
  const [row] = await db
    .update(leases)
    .set({
      status: 'ENDED',
      endDate: values.endDate,
      terminationReason: values.reason,
      terminatedAt: values.now,
      updatedAt: values.now,
    })
    .where(and(eq(leases.id, leaseId), inArray(leases.status, ['DRAFT', 'ACTIVE'])))
    .returning();

  return row;
}

export type LeaseScope = {
  organizationId: string;
  propertyIds: 'all' | readonly string[];
};

export type LeaseFilters = {
  propertyId: string | null;
  apartmentId: string | null;
  tenantUserId: string | null;
  status: 'ALL' | 'DRAFT' | 'ACTIVE' | 'ENDED' | 'CANCELLED';
};

/**
 * Baux lisibles dans un périmètre, filtrés.
 *
 * Le PÉRIMÈTRE est traduit en conditions SQL et non appliqué après lecture : les
 * objets non autorisés ne doivent pas quitter le serveur (API section 67). Un
 * bail porte `property_id` en propre, dénormalisé depuis son logement : la
 * condition s'écrit donc sans jointure, ce qui est exactement la raison d'être de
 * cette dénormalisation (ADR-007).
 */
export async function listLeaseRows(
  db: LeasesDatabase,
  scopes: readonly LeaseScope[],
  filters: LeaseFilters,
): Promise<Lease[]> {
  if (scopes.length === 0) return [];

  const scopeConditions = scopes.map((scope) =>
    scope.propertyIds === 'all'
      ? eq(leases.organizationId, scope.organizationId)
      : and(
          eq(leases.organizationId, scope.organizationId),
          inArray(leases.propertyId, [...scope.propertyIds]),
        ),
  );

  const conditions: (SQL | undefined)[] = [or(...scopeConditions)];

  if (filters.propertyId) conditions.push(eq(leases.propertyId, filters.propertyId));
  if (filters.apartmentId) conditions.push(eq(leases.apartmentId, filters.apartmentId));
  if (filters.tenantUserId) conditions.push(eq(leases.tenantUserId, filters.tenantUserId));
  if (filters.status !== 'ALL') conditions.push(eq(leases.status, filters.status));

  return db
    .select()
    .from(leases)
    .where(and(...conditions))
    .orderBy(desc(leases.startDate), desc(leases.createdAt));
}

/**
 * Baux d'une personne, quels que soient leur statut et leur organisation.
 *
 * Sert l'espace locataire : il montre SON bail, et son périmètre est lui-même,
 * pas un immeuble (BR-021).
 */
export async function listLeasesForTenant(
  db: LeasesDatabase,
  tenantUserId: string,
): Promise<Lease[]> {
  return db
    .select()
    .from(leases)
    .where(eq(leases.tenantUserId, tenantUserId))
    .orderBy(desc(leases.startDate), desc(leases.createdAt));
}

/**
 * Logements du périmètre qui n'ont AUCUN bail actif : ceux qu'on peut louer.
 *
 * Le filtre est une sous-requête `NOT IN` plutôt qu'un calcul après lecture :
 * c'est la base qui sait quels logements sont pris, et le formulaire de création
 * ne doit proposer que ce qui passera la règle BR-028.
 *
 * Le périmètre est traduit comme pour les baux : un propriétaire couvre toute son
 * organisation, et `apartments.organization_id` suffit alors, dénormalisé
 * précisément pour cela (ADR-007) ; un gestionnaire nomme ses immeubles.
 *
 * Les logements archivés et ceux d'un immeuble archivé sont exclus : ils ne
 * peuvent plus recevoir d'opération (BR-025).
 */
export async function listApartmentsWithoutActiveLease(
  db: LeasesDatabase,
  scopes: readonly LeaseScope[],
): Promise<ApartmentRow[]> {
  if (scopes.length === 0) return [];

  const occupied = db
    .select({ apartmentId: leases.apartmentId })
    .from(leases)
    .where(eq(leases.status, 'ACTIVE'));

  const scopeConditions = scopes.map((scope) =>
    scope.propertyIds === 'all'
      ? eq(apartments.organizationId, scope.organizationId)
      : and(
          eq(apartments.organizationId, scope.organizationId),
          inArray(apartments.propertyId, [...scope.propertyIds]),
        ),
  );

  return db
    .select({
      id: apartments.id,
      organizationId: apartments.organizationId,
      propertyId: apartments.propertyId,
      number: apartments.number,
      archivedAt: apartments.archivedAt,
      propertyName: properties.name,
      propertyArchivedAt: properties.archivedAt,
      referenceRentAmount: apartments.referenceRentAmount,
      referenceCurrency: apartments.currency,
    })
    .from(apartments)
    .innerJoin(properties, eq(properties.id, apartments.propertyId))
    .where(
      and(
        or(...scopeConditions),
        isNull(apartments.archivedAt),
        isNull(properties.archivedAt),
        notInArray(apartments.id, occupied),
      ),
    )
    .orderBy(asc(properties.name), asc(apartments.number));
}
