import { and, asc, eq, gt, inArray, isNull, lt, ne, sql, type SQL } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import * as schema from '@/db/schema';
import {
  apartments,
  chargeAllocations,
  charges,
  leases,
  properties,
  userAccess,
  users,
  type Charge,
  type ChargeAllocation,
} from '@/db/schema';
import { propertyScopeCondition, type PropertyScope } from '@/lib/authorization';
import { OPEN_RECEIVABLE_STATUSES, type ReceivableListFilter } from '@/modules/receivables/client';

import type { CalculationBasis } from './allocation';
import type { ChargeListFilter, ChargeType } from './constants';

/**
 * Accès aux données du module Charges (MVP-ENG-035, MVP-ENG-036).
 *
 * Ce module ne décide RIEN. Il ne connaît ni rôle ni permission : le cas d'usage
 * a déjà établi que l'appelant a le droit d'agir, et le dépôt travaille dans ce
 * cadre.
 *
 * Aucune concaténation de SQL (MVP-ENG-037) : tout passe par le constructeur de
 * requêtes de Drizzle. Chaque fonction accepte aussi bien la base qu'une
 * TRANSACTION, ce qui est ici plus qu'un confort : la publication d'une charge
 * est atomique (BR-052), donc toutes ses écritures doivent pouvoir recevoir le
 * même `tx`.
 */

/** Instance Drizzle, quel que soit son pilote : postgres.js ou PGlite. */
export type ChargesDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Périmètre de lecture, tel que le service d'autorisation le produit. */
export type ChargeScope = PropertyScope;

// --- Immeuble et logements concernés ----------------------------------------------

export type ChargePropertyRow = {
  id: string;
  name: string;
  organizationId: string;
  archivedAt: Date | null;
};

/** Immeuble d'une charge, avec ce qui décide s'il peut encore en supporter une. */
export async function findPropertyById(
  db: ChargesDatabase,
  propertyId: string,
): Promise<ChargePropertyRow | undefined> {
  const [row] = await db
    .select({
      id: properties.id,
      name: properties.name,
      organizationId: properties.organizationId,
      archivedAt: properties.archivedAt,
    })
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);

  return row;
}

/**
 * Logement concerné par une répartition, avec son occupation du moment.
 *
 * `leaseId` et `tenantUserId` viennent du bail ACTIF du logement, et sont nuls
 * s'il est vacant : c'est exactement ce que la section 30 demande de figer dans
 * la créance, et ce que l'aperçu doit montrer avant de publier (BR-052).
 */
export type ChargeUnitRow = {
  apartmentId: string;
  number: string;
  leaseId: string | null;
  tenantUserId: string | null;
  tenantName: string | null;
};

/**
 * Logements entre lesquels une charge se répartit (DEC-029, BR-052).
 *
 * **Les logements ACTIFS de l'immeuble, et eux seuls.** Un logement archivé est
 * sorti de l'exploitation (DEC-020) : lui attribuer une part de la facture d'eau
 * créerait une créance que personne ne réclamera jamais, et réduirait d'autant
 * la part des logements réellement desservis. Un logement VACANT, lui, reste
 * dans le parc et porte sa part, que BR-052 attribue alors au logement sans
 * locataire redevable. Un logement en travaux la porte aussi : les travaux sont
 * une information d'exploitation (DEC-050), pas une sortie du parc.
 *
 * Le bail joint est celui dont le statut est `ACTIVE`. L'index partiel
 * `leases_one_active_per_apartment` garantit qu'il n'en existe qu'un par
 * logement, donc cette jointure ne peut pas dupliquer une ligne.
 *
 * L'ordre est celui des RÉFÉRENCES, le même que celui de la répartition : la
 * liste se lit donc comme le calcul se fait.
 */
export async function listAllocatableUnits(
  db: ChargesDatabase,
  propertyId: string,
): Promise<ChargeUnitRow[]> {
  return db
    .select({
      apartmentId: apartments.id,
      number: apartments.number,
      leaseId: leases.id,
      tenantUserId: leases.tenantUserId,
      tenantName: users.fullName,
    })
    .from(apartments)
    .leftJoin(leases, and(eq(leases.apartmentId, apartments.id), eq(leases.status, 'ACTIVE')))
    .leftJoin(users, eq(users.id, leases.tenantUserId))
    .where(and(eq(apartments.propertyId, propertyId), isNull(apartments.archivedAt)))
    .orderBy(asc(apartments.number));
}

// --- Écriture d'une charge --------------------------------------------------------

export type ChargeInsert = {
  organizationId: string;
  propertyId: string;
  type: ChargeType;
  periodStart: string;
  dueDate: string;
  totalAmount: number;
  currency: string;
  allocationMethod: 'EQUAL';
  supplierName: string | null;
  createdBy: string;
};

/** Crée la charge, en brouillon : aucune créance n'est produite (BR-052). */
export async function insertCharge(db: ChargesDatabase, values: ChargeInsert): Promise<Charge> {
  const [row] = await db
    .insert(charges)
    .values({ ...values, status: 'DRAFT' })
    .returning();

  if (!row) throw new Error("La charge n'a pas pu être créée.");

  return row;
}

/**
 * Passe la charge en `PUBLISHED`, et seulement si elle est encore en brouillon.
 *
 * La condition `status = 'DRAFT'` dans le `WHERE` est le VERROU de tout le lot.
 * Elle fait trois choses qu'un contrôle préalable par lecture ne ferait pas :
 *
 *   1. elle sérialise deux publications concurrentes, la seconde attendant le
 *      verrou de ligne puis ne trouvant plus de brouillon ;
 *   2. elle rend donc le refus de republication fiable, ce que l'API section 29
 *      exige « y compris en cas de double-clic ou de requête concurrente » ;
 *   3. elle est prise AVANT l'insertion des créances dans la transaction, si
 *      bien que la seconde requête échoue sans avoir rien écrit.
 *
 * Aucune ligne rendue signifie « la charge n'était pas publiable » : c'est le cas
 * d'usage qui dit laquelle des deux raisons s'applique, en relisant son statut.
 */
export async function publishChargeRow(
  db: ChargesDatabase,
  chargeId: string,
  publishedAt: Date,
): Promise<Charge | undefined> {
  const [row] = await db
    .update(charges)
    .set({ status: 'PUBLISHED', publishedAt, updatedAt: publishedAt })
    .where(and(eq(charges.id, chargeId), eq(charges.status, 'DRAFT')))
    .returning();

  return row;
}

/**
 * Passe la charge en `CANCELLED`, sauf si elle l'est déjà (BR-054).
 *
 * Même technique de condition dans le `WHERE` : une seconde annulation
 * concurrente ne trouve plus rien et échoue proprement, plutôt que d'écraser la
 * date d'annulation et de perdre la trace de la première.
 */
export async function cancelChargeRow(
  db: ChargesDatabase,
  chargeId: string,
  cancelledAt: Date,
): Promise<Charge | undefined> {
  const [row] = await db
    .update(charges)
    .set({ status: 'CANCELLED', cancelledAt, updatedAt: cancelledAt })
    .where(and(eq(charges.id, chargeId), ne(charges.status, 'CANCELLED')))
    .returning();

  return row;
}

// --- Écriture des créances -------------------------------------------------------

export type ChargeAllocationInsert = {
  organizationId: string;
  chargeId: string;
  propertyId: string;
  apartmentId: string;
  leaseId: string | null;
  tenantUserId: string | null;
  periodStart: string;
  dueDate: string;
  amountDue: number;
  balance: number;
  currency: string;
  calculationBasis: CalculationBasis;
};

/**
 * Crée les créances d'une charge, toutes en une requête.
 *
 * AUCUN `ON CONFLICT DO NOTHING`, à la différence de la génération des loyers, et
 * c'est la traduction de la différence de règle : une génération de loyers est
 * idempotente et peut être rejouée (DEC-028), une publication de charge n'est pas
 * rejouable (BR-052). Un conflit sur `UNIQUE (charge_id, apartment_id)` est donc
 * une ERREUR ici, et il doit faire échouer la transaction : il signifie que des
 * créances existaient déjà pour cette charge.
 *
 * Une seule requête quel que soit le nombre de logements : douze insertions
 * feraient douze allers-retours dans une transaction qui tient un verrou de
 * ligne.
 */
export async function insertAllocations(
  db: ChargesDatabase,
  values: readonly ChargeAllocationInsert[],
): Promise<ChargeAllocation[]> {
  if (values.length === 0) return [];

  return db
    .insert(chargeAllocations)
    .values(values.map((value) => ({ ...value, amountPaid: 0, status: 'UNPAID' as const })))
    .returning();
}

/**
 * Annule les créances d'une charge, sans en supprimer aucune (BR-054).
 *
 * Les montants déjà payés et les allocations de paiement sont CONSERVÉS : la
 * section 32 l'exige, « conserve les allocations de paiement déjà réalisées pour
 * analyse ». Une créance annulée sort donc du total dû sans effacer l'argent
 * reçu, et un remboursement éventuel reste une décision humaine, hors MVP
 * (DEC-016).
 *
 * Les créances déjà annulées ne sont pas retouchées : leur date de mise à jour
 * resterait fausse si une seconde annulation la réécrivait.
 */
export async function cancelAllocationsOfCharge(
  db: ChargesDatabase,
  chargeId: string,
  cancelledAt: Date,
): Promise<ChargeAllocation[]> {
  return db
    .update(chargeAllocations)
    .set({ status: 'CANCELLED', updatedAt: cancelledAt })
    .where(and(eq(chargeAllocations.chargeId, chargeId), ne(chargeAllocations.status, 'CANCELLED')))
    .returning();
}

/**
 * Bascule en `OVERDUE` les créances de charge échues qui doivent encore de
 * l'argent (BR-037, job `markOverdueReceivables`).
 *
 * Exactement la même règle que pour les échéances de loyer, et c'est voulu :
 * l'énumération de statut est commune aux deux créances (DEC-015), donc le
 * retard se constate de la même façon. Le job traite les deux tables dans la
 * même exécution, ce que la section 19 décrit comme un seul job de créances.
 *
 * Idempotent : `OVERDUE` ne fait pas partie des statuts visés, donc une seconde
 * exécution le même jour ne trouve plus rien.
 */
export async function markOverdueAllocations(
  db: ChargesDatabase,
  today: string,
): Promise<ChargeAllocation[]> {
  return db
    .update(chargeAllocations)
    .set({ status: 'OVERDUE', updatedAt: new Date() })
    .where(
      and(
        inArray(chargeAllocations.status, ['UNPAID', 'PARTIALLY_PAID']),
        lt(chargeAllocations.dueDate, today),
        gt(chargeAllocations.balance, 0),
      ),
    )
    .returning();
}

// --- Lecture des charges ---------------------------------------------------------

export async function findChargeById(
  db: ChargesDatabase,
  chargeId: string,
): Promise<Charge | undefined> {
  const [row] = await db.select().from(charges).where(eq(charges.id, chargeId)).limit(1);

  return row;
}

export type ChargeFilters = {
  propertyId: string | null;
  /** Période exacte, premier jour du mois. */
  period: string | null;
  type: ChargeType | null;
  status: ChargeListFilter;
};

/**
 * Charges lisibles dans un périmètre, filtrées (API section 30).
 *
 * Le PÉRIMÈTRE est traduit en conditions SQL et non appliqué après lecture : les
 * objets non autorisés ne doivent pas quitter le serveur (API section 67). Une
 * charge porte `property_id` en propre, donc la condition s'écrit sans jointure.
 */
export async function listChargeRows(
  db: ChargesDatabase,
  scopes: readonly ChargeScope[],
  filters: ChargeFilters,
): Promise<Charge[]> {
  if (scopes.length === 0) return [];

  const conditions: (SQL | undefined)[] = [
    propertyScopeCondition(scopes, {
      organizationId: charges.organizationId,
      propertyId: charges.propertyId,
    }),
  ];

  if (filters.status !== 'ALL') conditions.push(eq(charges.status, filters.status));
  if (filters.propertyId) conditions.push(eq(charges.propertyId, filters.propertyId));
  if (filters.period) conditions.push(eq(charges.periodStart, filters.period));
  if (filters.type) conditions.push(eq(charges.type, filters.type));

  return db
    .select()
    .from(charges)
    .where(and(...conditions))
    .orderBy(asc(charges.periodStart), asc(charges.createdAt));
}

/** Immeubles des charges lues, nommés en une requête. */
export async function findPropertiesByIds(
  db: ChargesDatabase,
  propertyIds: readonly string[],
): Promise<{ id: string; name: string }[]> {
  if (propertyIds.length === 0) return [];

  return db
    .select({ id: properties.id, name: properties.name })
    .from(properties)
    .where(inArray(properties.id, [...propertyIds]));
}

/**
 * Compte et argent des créances de chaque charge, en une requête.
 *
 * Trois agrégats par charge : le nombre de parts, la somme répartie et ce qu'il
 * reste à encaisser. Le dernier ne compte que les créances OUVERTES (BR-039),
 * une créance payée ne devant plus rien et une créance annulée n'ayant jamais
 * rien dû.
 *
 * Agrégé par la BASE et non après lecture : une liste de charges afficherait
 * sinon autant de requêtes que de lignes, chacune ramenant toutes les parts d'un
 * immeuble pour n'en faire qu'une somme.
 */
export type ChargeTotalsRow = {
  chargeId: string;
  unitCount: number;
  allocatedAmount: number;
  totalOutstanding: number;
};

export async function findChargeTotals(
  db: ChargesDatabase,
  chargeIds: readonly string[],
): Promise<ChargeTotalsRow[]> {
  if (chargeIds.length === 0) return [];

  const rows = await db
    .select({
      chargeId: chargeAllocations.chargeId,
      unitCount: sql<number>`count(*)::int`,
      allocatedAmount: sql<number>`coalesce(sum(${chargeAllocations.amountDue}), 0)::bigint`,
      totalOutstanding: sql<number>`coalesce(sum(case when ${chargeAllocations.status} in ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE') then ${chargeAllocations.balance} else 0 end), 0)::bigint`,
    })
    .from(chargeAllocations)
    .where(inArray(chargeAllocations.chargeId, [...chargeIds]))
    .groupBy(chargeAllocations.chargeId);

  /*
   * `bigint` revient en chaîne du pilote PostgreSQL, et en nombre de PGlite :
   * les deux sont ramenés à un nombre ici, une fois, plutôt que dans chaque
   * appelant. Les montants du produit tiennent dans un entier sûr (DEC-014).
   */
  return rows.map((row) => ({
    chargeId: row.chargeId,
    unitCount: Number(row.unitCount),
    allocatedAmount: Number(row.allocatedAmount),
    totalOutstanding: Number(row.totalOutstanding),
  }));
}

// --- Lecture des créances de charge ----------------------------------------------

/** Créances d'une charge, dans l'ordre de la répartition. */
export async function listAllocationsOfCharge(
  db: ChargesDatabase,
  chargeId: string,
): Promise<ChargeAllocation[]> {
  return db
    .select()
    .from(chargeAllocations)
    .where(eq(chargeAllocations.chargeId, chargeId))
    .orderBy(asc(chargeAllocations.createdAt));
}

export type ChargeAllocationFilters = {
  propertyId: string | null;
  apartmentId: string | null;
  tenantUserId: string | null;
  chargeId: string | null;
  period: string | null;
  status: ReceivableListFilter;
  /** Date du jour, en date civile : seul `UPCOMING` en a besoin. */
  today: string;
};

function allocationStatusCondition(filters: ChargeAllocationFilters): SQL | undefined {
  if (filters.status === 'ALL') return undefined;

  if (filters.status === 'OUTSTANDING') {
    return inArray(chargeAllocations.status, [...OPEN_RECEIVABLE_STATUSES]);
  }

  /*
   * « À venir » n'est pas une valeur stockée (BR-037) : le filtre reproduit donc
   * sa définition, `UNPAID` et échéance future. Même traduction que sur les
   * loyers, parce que c'est la même règle.
   */
  if (filters.status === 'UPCOMING') {
    return and(
      eq(chargeAllocations.status, 'UNPAID'),
      gt(chargeAllocations.dueDate, filters.today),
    );
  }

  return eq(chargeAllocations.status, filters.status);
}

/** Créances de charge lisibles dans un périmètre, filtrées (API section 26). */
export async function listAllocationRows(
  db: ChargesDatabase,
  scopes: readonly ChargeScope[],
  filters: ChargeAllocationFilters,
): Promise<ChargeAllocation[]> {
  if (scopes.length === 0) return [];

  const conditions: (SQL | undefined)[] = [
    propertyScopeCondition(scopes, {
      organizationId: chargeAllocations.organizationId,
      propertyId: chargeAllocations.propertyId,
    }),
    allocationStatusCondition(filters),
  ];

  if (filters.propertyId) conditions.push(eq(chargeAllocations.propertyId, filters.propertyId));
  if (filters.apartmentId) conditions.push(eq(chargeAllocations.apartmentId, filters.apartmentId));
  if (filters.tenantUserId) {
    conditions.push(eq(chargeAllocations.tenantUserId, filters.tenantUserId));
  }
  if (filters.chargeId) conditions.push(eq(chargeAllocations.chargeId, filters.chargeId));
  if (filters.period) conditions.push(eq(chargeAllocations.periodStart, filters.period));

  return db
    .select()
    .from(chargeAllocations)
    .where(and(...conditions))
    .orderBy(asc(chargeAllocations.dueDate));
}

/**
 * Créances de charge d'une personne, quelle que soit l'organisation.
 *
 * Sert son espace locataire et son total dû : son périmètre est ELLE-MÊME et non
 * un immeuble (BR-021). Une créance de logement vacant ne porte aucune personne
 * et n'apparaît donc jamais ici, ce qui est exactement ce que BR-052 demande.
 */
export async function listAllocationsForTenant(
  db: ChargesDatabase,
  tenantUserId: string,
  options: { openOnly?: boolean } = {},
): Promise<ChargeAllocation[]> {
  const conditions: (SQL | undefined)[] = [eq(chargeAllocations.tenantUserId, tenantUserId)];

  if (options.openOnly) {
    conditions.push(inArray(chargeAllocations.status, [...OPEN_RECEIVABLE_STATUSES]));
  }

  return db
    .select()
    .from(chargeAllocations)
    .where(and(...conditions))
    .orderBy(asc(chargeAllocations.dueDate));
}

/** Charges d'où viennent les créances lues, en une requête. */
export async function findChargesByIds(
  db: ChargesDatabase,
  chargeIds: readonly string[],
): Promise<Charge[]> {
  if (chargeIds.length === 0) return [];

  return db
    .select()
    .from(charges)
    .where(inArray(charges.id, [...chargeIds]));
}

// --- Vues : logements et personnes ------------------------------------------------

export type ApartmentRow = {
  id: string;
  number: string;
  propertyId: string;
  propertyName: string;
};

/**
 * Logements des créances lues, avec le nom de leur immeuble.
 *
 * Une seule requête quel que soit le nombre de créances : sans cela, une
 * répartition sur douze logements ferait douze lectures.
 */
export async function findApartmentsByIds(
  db: ChargesDatabase,
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
 * L'accès est joint en LEFT JOIN et peut rester nul : une personne peut devoir
 * une part de charge sans avoir aucun accès au produit (DEC-051). C'est la
 * différence même entre « occuper un logement » et « utiliser l'application », et
 * l'écran s'en sert pour savoir si le nom mène à une fiche.
 */
export async function findPeopleByIds(
  db: ChargesDatabase,
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
