import { and, asc, eq, gt, inArray, lt, or, sql, type SQL } from 'drizzle-orm';
import type { PgColumn, PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import * as schema from '@/db/schema';
import {
  apartments,
  leases,
  properties,
  rentInstallments,
  userAccess,
  users,
  type RentInstallment,
} from '@/db/schema';

import { OPEN_RECEIVABLE_STATUSES, type ReceivableStatus } from './constants';

/**
 * Accès aux données du module Loyers (MVP-ENG-035, MVP-ENG-036).
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
export type RentsDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

// --- Baux à facturer --------------------------------------------------------------

/**
 * Bail actif tel que la génération le lit : juste ce qu'il faut pour écrire une
 * échéance, et rien de plus.
 */
export type BillableLeaseRow = {
  id: string;
  organizationId: string;
  propertyId: string;
  apartmentId: string;
  tenantUserId: string;
  startDate: string;
  endDate: string | null;
  rentAmount: number;
  currency: string;
  dueDay: number;
};

export type RentScope = {
  organizationId: string;
  propertyIds: 'all' | readonly string[];
};

/**
 * Traduit un ensemble de périmètres en condition SQL, sur la colonne donnée.
 *
 * Écrit une fois et appliqué aux baux comme aux échéances : les deux tables
 * portent `organization_id` et `property_id` en propre, dénormalisés
 * précisément pour que le périmètre s'écrive sans jointure (ADR-007). Deux
 * traductions séparées auraient fini par diverger, et une divergence ici est une
 * fuite entre organisations.
 */
function scopeCondition(
  scopes: readonly RentScope[],
  columns: { organizationId: PgColumn; propertyId: PgColumn },
): SQL | undefined {
  return or(
    ...scopes.map((scope) =>
      scope.propertyIds === 'all'
        ? eq(columns.organizationId, scope.organizationId)
        : and(
            eq(columns.organizationId, scope.organizationId),
            inArray(columns.propertyId, [...scope.propertyIds]),
          ),
    ),
  );
}

/**
 * Baux ACTIFS qui recouvrent la période, dans le périmètre demandé (BR-034).
 *
 * Le recouvrement est calculé par la BASE et non après lecture : un parc de
 * plusieurs centaines de baux n'a pas à traverser le réseau pour qu'on en écarte
 * la moitié. La règle est celle de `leaseCoversPeriod`, et les deux doivent dire
 * la même chose, ce que les tests de génération vérifient.
 *
 * `scopes` à `null` signifie TOUTES les organisations : c'est le cas du job
 * planifié, qui n'a pas d'appelant et donc pas de périmètre (DEC-028). Aucune
 * route publique ne peut produire ce cas.
 */
export async function listBillableLeases(
  db: RentsDatabase,
  scopes: readonly RentScope[] | null,
  period: { start: string; end: string },
): Promise<BillableLeaseRow[]> {
  if (scopes !== null && scopes.length === 0) return [];

  const conditions: (SQL | undefined)[] = [
    eq(leases.status, 'ACTIVE'),
    // Le bail a commencé avant la fin de la période.
    sql`${leases.startDate} <= ${period.end}`,
    // Et il n'était pas déjà terminé quand elle a commencé.
    or(sql`${leases.endDate} IS NULL`, sql`${leases.endDate} >= ${period.start}`),
  ];

  if (scopes !== null) {
    conditions.push(
      scopeCondition(scopes, {
        organizationId: leases.organizationId,
        propertyId: leases.propertyId,
      }),
    );
  }

  return db
    .select({
      id: leases.id,
      organizationId: leases.organizationId,
      propertyId: leases.propertyId,
      apartmentId: leases.apartmentId,
      tenantUserId: leases.tenantUserId,
      startDate: leases.startDate,
      endDate: leases.endDate,
      rentAmount: leases.rentAmount,
      currency: leases.currency,
      dueDay: leases.dueDay,
    })
    .from(leases)
    .where(and(...conditions))
    .orderBy(asc(leases.createdAt));
}

// --- Écriture des échéances -------------------------------------------------------

export type RentInstallmentInsert = {
  organizationId: string;
  leaseId: string;
  propertyId: string;
  apartmentId: string;
  tenantUserId: string;
  periodStart: string;
  dueDate: string;
  amountDue: number;
  balance: number;
  currency: string;
};

/**
 * Crée les échéances absentes, et IGNORE celles qui existent déjà.
 *
 * `ON CONFLICT DO NOTHING` sur `UNIQUE (lease_id, period_start)` : c'est là, et
 * nulle part ailleurs, que l'idempotence exigée par DEC-028 est obtenue. Un
 * pré-contrôle par lecture ne suffirait pas, deux exécutions simultanées du job
 * passeraient chacune, et le bailleur verrait la dette en double.
 *
 * Les lignes RÉELLEMENT insérées sont renvoyées, et elles seules : c'est ce qui
 * permet au job de journaliser « créées » et « ignorées » séparément, comme la
 * décision l'exige, au lieu d'annoncer un travail qu'il n'a pas fait.
 *
 * Une seule requête quel que soit le nombre d'échéances : une insertion par bail
 * ferait une requête par logement loué.
 */
export async function insertMissingInstallments(
  db: RentsDatabase,
  values: readonly RentInstallmentInsert[],
): Promise<RentInstallment[]> {
  if (values.length === 0) return [];

  return db
    .insert(rentInstallments)
    .values(values.map((value) => ({ ...value, amountPaid: 0, status: 'UNPAID' as const })))
    .onConflictDoNothing({
      target: [rentInstallments.leaseId, rentInstallments.periodStart],
    })
    .returning();
}

/**
 * Bascule en `OVERDUE` les créances échues qui doivent encore de l'argent
 * (BR-037, job `markOverdueReceivables`).
 *
 * Écrit par un JOB et jamais à la lecture, la règle le dit explicitement. Deux
 * conséquences tenues ici : une créance `PAID` ou `CANCELLED` n'est jamais
 * touchée, et le solde doit être strictement positif, ce qui écarte une ligne
 * soldée dont le statut n'aurait pas encore été rafraîchi.
 *
 * Idempotent : une seconde exécution le même jour ne trouve plus rien à mettre à
 * jour, puisque `OVERDUE` ne fait pas partie des statuts visés.
 */
export async function markOverdueInstallments(
  db: RentsDatabase,
  today: string,
): Promise<RentInstallment[]> {
  return db
    .update(rentInstallments)
    .set({ status: 'OVERDUE', updatedAt: new Date() })
    .where(
      and(
        inArray(rentInstallments.status, ['UNPAID', 'PARTIALLY_PAID']),
        lt(rentInstallments.dueDate, today),
        gt(rentInstallments.balance, 0),
      ),
    )
    .returning();
}

// --- Lecture des échéances --------------------------------------------------------

export async function findInstallmentById(
  db: RentsDatabase,
  installmentId: string,
): Promise<RentInstallment | undefined> {
  const [row] = await db
    .select()
    .from(rentInstallments)
    .where(eq(rentInstallments.id, installmentId))
    .limit(1);

  return row;
}

/**
 * Filtres de la liste, déjà normalisés par le schéma.
 *
 * `status` porte aussi bien un statut brut qu'un composite : la traduction en
 * conditions est faite ici, une seule fois, parce que `OUTSTANDING` et
 * `UPCOMING` ne sont pas des valeurs de colonne et ne peuvent donc pas être
 * comparés directement.
 */
export type RentFilters = {
  propertyId: string | null;
  apartmentId: string | null;
  tenantUserId: string | null;
  leaseId: string | null;
  /** Période exacte, premier jour du mois. */
  period: string | null;
  status: 'ALL' | 'OUTSTANDING' | 'UPCOMING' | ReceivableStatus;
  /** Date du jour, en date civile : seul `UPCOMING` en a besoin. */
  today: string;
};

function statusCondition(filters: RentFilters): SQL | undefined {
  if (filters.status === 'ALL') return undefined;

  if (filters.status === 'OUTSTANDING') {
    return inArray(rentInstallments.status, [...OPEN_RECEIVABLE_STATUSES]);
  }

  /*
   * « À venir » n'est pas une valeur stockée (BR-037) : le filtre reproduit donc
   * sa définition, `UNPAID` et échéance future. La comparaison porte sur la
   * colonne `date` et sur une date civile, sans objet `Date` d'aucun côté, donc
   * aucun fuseau n'intervient.
   */
  if (filters.status === 'UPCOMING') {
    return and(eq(rentInstallments.status, 'UNPAID'), gt(rentInstallments.dueDate, filters.today));
  }

  return eq(rentInstallments.status, filters.status);
}

/**
 * Échéances lisibles dans un périmètre, filtrées.
 *
 * Le PÉRIMÈTRE est traduit en conditions SQL et non appliqué après lecture : les
 * objets non autorisés ne doivent pas quitter le serveur (API section 67). Une
 * échéance porte `property_id` en propre, dénormalisé depuis son bail : la
 * condition s'écrit donc sans jointure (ADR-007).
 */
export async function listInstallmentRows(
  db: RentsDatabase,
  scopes: readonly RentScope[],
  filters: RentFilters,
): Promise<RentInstallment[]> {
  if (scopes.length === 0) return [];

  const conditions: (SQL | undefined)[] = [
    scopeCondition(scopes, {
      organizationId: rentInstallments.organizationId,
      propertyId: rentInstallments.propertyId,
    }),
    statusCondition(filters),
  ];

  if (filters.propertyId) conditions.push(eq(rentInstallments.propertyId, filters.propertyId));
  if (filters.apartmentId) conditions.push(eq(rentInstallments.apartmentId, filters.apartmentId));
  if (filters.tenantUserId) {
    conditions.push(eq(rentInstallments.tenantUserId, filters.tenantUserId));
  }
  if (filters.leaseId) conditions.push(eq(rentInstallments.leaseId, filters.leaseId));
  if (filters.period) conditions.push(eq(rentInstallments.periodStart, filters.period));

  return db
    .select()
    .from(rentInstallments)
    .where(and(...conditions))
    .orderBy(asc(rentInstallments.dueDate));
}

/**
 * Échéances d'une personne, quelle que soit l'organisation.
 *
 * Sert son espace locataire et son total dû : son périmètre est ELLE-MÊME et non
 * un immeuble (BR-021). Aucun périmètre d'immeuble n'intervient donc, et c'est
 * le cas d'usage qui vérifie que l'appelant a le droit de lire cette personne.
 */
export async function listInstallmentsForTenant(
  db: RentsDatabase,
  tenantUserId: string,
  options: { openOnly?: boolean } = {},
): Promise<RentInstallment[]> {
  const conditions: (SQL | undefined)[] = [eq(rentInstallments.tenantUserId, tenantUserId)];

  if (options.openOnly) {
    conditions.push(inArray(rentInstallments.status, [...OPEN_RECEIVABLE_STATUSES]));
  }

  return db
    .select()
    .from(rentInstallments)
    .where(and(...conditions))
    .orderBy(asc(rentInstallments.dueDate));
}

// --- Vues : logements et personnes ------------------------------------------------

export type ApartmentRow = {
  id: string;
  number: string;
  propertyId: string;
  propertyName: string;
};

/**
 * Logements des échéances lues, avec le nom de leur immeuble.
 *
 * Une seule requête quel que soit le nombre d'échéances : sans cela, une liste
 * de vingt lignes ferait vingt lectures de logement.
 */
export async function findApartmentsByIds(
  db: RentsDatabase,
  apartmentIds: readonly string[],
): Promise<ApartmentRow[]> {
  if (apartmentIds.length === 0) return [];

  return db
    .select({
      id: apartments.id,
      number: apartments.number,
      propertyId: apartments.propertyId,
      propertyName: properties.name,
    })
    .from(apartments)
    .innerJoin(properties, eq(properties.id, apartments.propertyId))
    .where(inArray(apartments.id, [...apartmentIds]));
}

export type PersonRow = {
  userId: string;
  accessId: string | null;
  fullName: string;
  phone: string | null;
};

/**
 * Personnes redevables, avec leur accès locataire s'il existe.
 *
 * L'accès est joint en LEFT JOIN et peut rester nul : une personne peut devoir un
 * loyer sans avoir aucun accès au produit (DEC-051). C'est la différence même
 * entre « occuper un logement » et « utiliser l'application », et l'écran s'en
 * sert pour savoir si le nom mène à une fiche.
 */
export async function findPeopleByIds(
  db: RentsDatabase,
  userIds: readonly string[],
  organizationIds: readonly string[],
): Promise<PersonRow[]> {
  if (userIds.length === 0) return [];

  const rows = await db
    .select({
      userId: users.id,
      accessId: userAccess.id,
      fullName: users.fullName,
      phone: users.phone,
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
      byUser.set(row.userId, row);
    }
  }

  return [...byUser.values()];
}
