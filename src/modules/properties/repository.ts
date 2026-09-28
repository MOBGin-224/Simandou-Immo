import {
  and,
  asc,
  count,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import * as schema from '@/db/schema';
import { apartments, properties, type Property } from '@/db/schema';
import type { PropertyScope } from '@/lib/authorization';

import { EMPTY_OCCUPANCY, type PropertyOccupancy } from './domain';
import type { ListPropertiesQuery } from './schemas';

/**
 * Accès aux données du module Immeubles (MVP-ENG-035, MVP-ENG-036).
 *
 * Ce module ne décide RIEN. Il ne connaît ni rôle, ni permission : il reçoit du
 * cas d'usage des périmètres déjà calculés par le service d'autorisation et les
 * traduit en conditions SQL. Cette séparation est ce qui garantit qu'aucune
 * requête ne puisse contourner la barrière d'isolation par distraction.
 *
 * Aucune concaténation de SQL (MVP-ENG-037) : tout passe par le constructeur de
 * requêtes de Drizzle, y compris les termes de recherche.
 */

/** Instance Drizzle, quel que soit son pilote : postgres.js ou PGlite. */
export type PropertiesDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * Code SQLSTATE d'une violation de contrainte d'unicité.
 *
 * Le pré-contrôle par lecture ne suffit pas : entre la lecture et l'écriture,
 * une autre requête peut insérer le même nom. La contrainte de base est le seul
 * arbitre fiable, et cette fonction permet de la traduire en erreur métier.
 */
const UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const code = (error as { code?: unknown }).code;
  const message = error instanceof Error ? error.message : '';

  return code === UNIQUE_VIOLATION || message.includes(constraint);
}

export const PROPERTY_NAME_CONSTRAINT = 'properties_org_name_unique';

/**
 * Échappe les caractères génériques d'un motif `LIKE`.
 *
 * Sans cela, une recherche sur « 100 % » ramènerait tous les immeubles, et un
 * souligné remplacerait n'importe quel caractère. Ce n'est pas une faille, mais
 * un résultat incompréhensible pour l'utilisateur.
 */
function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/** Immeuble par identifiant, SANS aucun contrôle d'accès. Réservé au cas d'usage. */
export async function findPropertyById(
  db: PropertiesDatabase,
  propertyId: string,
): Promise<Property | undefined> {
  const [row] = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1);

  return row;
}

/** Immeuble homonyme dans la même organisation, archivé compris. */
export async function findPropertyByName(
  db: PropertiesDatabase,
  organizationId: string,
  name: string,
): Promise<Property | undefined> {
  const [row] = await db
    .select()
    .from(properties)
    .where(and(eq(properties.organizationId, organizationId), eq(properties.name, name)))
    .limit(1);

  return row;
}

export async function insertProperty(
  db: PropertiesDatabase,
  values: {
    organizationId: string;
    name: string;
    address: string | null;
    city: string | null;
    district: string | null;
    description: string | null;
  },
): Promise<Property> {
  const [row] = await db.insert(properties).values(values).returning();

  // `returning()` sur une insertion d'une seule ligne en renvoie exactement une.
  // Le garde est là pour `noUncheckedIndexedAccess`, pas pour un cas réel.
  if (!row) throw new Error("L'insertion de l'immeuble n'a renvoyé aucune ligne.");

  return row;
}

export async function updatePropertyRow(
  db: PropertiesDatabase,
  propertyId: string,
  changes: Partial<Pick<Property, 'name' | 'address' | 'city' | 'district' | 'description'>>,
): Promise<Property> {
  const [row] = await db
    .update(properties)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(properties.id, propertyId))
    .returning();

  if (!row) throw new Error("La modification de l'immeuble n'a renvoyé aucune ligne.");

  return row;
}

/**
 * Archive un immeuble.
 *
 * Aucune suppression physique : `archived_at` est renseigné et l'historique reste
 * intact (BR-025, DEC-020). La condition `archived_at IS NULL` rend l'opération
 * sûre en cas de double soumission concurrente, le cas d'usage ayant déjà refusé
 * le second archivage.
 */
export async function archivePropertyRow(
  db: PropertiesDatabase,
  propertyId: string,
): Promise<Property | undefined> {
  const now = new Date();

  const [row] = await db
    .update(properties)
    .set({ archivedAt: now, updatedAt: now })
    .where(and(eq(properties.id, propertyId), isNull(properties.archivedAt)))
    .returning();

  return row;
}

/**
 * Traduit les périmètres de lecture en une condition SQL.
 *
 * Un périmètre par organisation, réunis par `OR` : un propriétaire couvre son
 * organisation entière, un gestionnaire les seuls immeubles de son périmètre. Le
 * filtrage a donc lieu DANS la requête, et non après lecture (API section 67).
 */
function scopeCondition(scopes: readonly PropertyScope[]): SQL | undefined {
  const conditions = scopes.map((scope) =>
    scope.propertyIds === 'all'
      ? eq(properties.organizationId, scope.organizationId)
      : and(
          eq(properties.organizationId, scope.organizationId),
          inArray(properties.id, [...scope.propertyIds]),
        ),
  );

  return conditions.length === 1 ? conditions[0] : or(...conditions);
}

/** Conditions de filtre et de recherche, indépendantes du périmètre. */
function filterConditions(query: ListPropertiesQuery): SQL[] {
  const conditions: SQL[] = [];

  if (query.filter === 'ACTIVE') conditions.push(isNull(properties.archivedAt));
  if (query.filter === 'ARCHIVED') conditions.push(isNotNull(properties.archivedAt));

  if (query.organizationId !== null) {
    conditions.push(eq(properties.organizationId, query.organizationId));
  }

  if (query.search !== null) {
    const pattern = `%${escapeLikePattern(query.search)}%`;
    const matches = or(
      ilike(properties.name, pattern),
      ilike(properties.city, pattern),
      ilike(properties.district, pattern),
    );

    if (matches) conditions.push(matches);
  }

  return conditions;
}

export type PropertyPage = {
  rows: Property[];
  total: number;
};

/**
 * Page d'immeubles lisibles, triée.
 *
 * Les actifs d'abord, puis les archivés, chaque groupe par nom : c'est l'ordre
 * dans lequel un gestionnaire cherche un immeuble, l'archive n'étant consultée
 * qu'intentionnellement.
 */
export async function listPropertyRows(
  db: PropertiesDatabase,
  scopes: readonly PropertyScope[],
  query: ListPropertiesQuery,
): Promise<PropertyPage> {
  const scope = scopeCondition(scopes);

  // Aucun périmètre lisible : la collection est vide, et aucune requête n'a de
  // raison d'être exécutée.
  if (!scope) return { rows: [], total: 0 };

  const where = and(scope, ...filterConditions(query));

  const [totals] = await db.select({ value: count() }).from(properties).where(where);

  const rows = await db
    .select()
    .from(properties)
    .where(where)
    .orderBy(asc(sql`${properties.archivedAt} is not null`), asc(properties.name))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  return { rows, total: totals?.value ?? 0 };
}

/**
 * Occupation de plusieurs immeubles, en UNE requête.
 *
 * Une requête par carte de la liste serait le défaut classique de cet écran :
 * vingt immeubles produiraient vingt et une requêtes. L'agrégation est donc faite
 * par la base, groupée par immeuble et par statut.
 *
 * Les appartements archivés sont exclus : ils ne font plus partie du parc
 * exploité, et les compter gonflerait artificiellement le nombre de logements.
 */
export async function occupancyByProperty(
  db: PropertiesDatabase,
  propertyIds: readonly string[],
): Promise<Map<string, PropertyOccupancy>> {
  const occupancies = new Map<string, PropertyOccupancy>();

  if (propertyIds.length === 0) return occupancies;

  const rows = await db
    .select({
      propertyId: apartments.propertyId,
      status: apartments.status,
      value: count(),
    })
    .from(apartments)
    .where(and(inArray(apartments.propertyId, [...propertyIds]), isNull(apartments.archivedAt)))
    .groupBy(apartments.propertyId, apartments.status);

  for (const row of rows) {
    const current = occupancies.get(row.propertyId) ?? { ...EMPTY_OCCUPANCY };

    current.apartmentCount += row.value;

    if (row.status === 'OCCUPIED') current.occupiedCount += row.value;
    if (row.status === 'VACANT') current.vacantCount += row.value;
    if (row.status === 'MAINTENANCE') current.maintenanceCount += row.value;

    occupancies.set(row.propertyId, current);
  }

  return occupancies;
}
