import { and, asc, count, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import * as schema from '@/db/schema';
import { apartments, type Apartment } from '@/db/schema';

import type { ApartmentChanges } from './domain';
import type { ListApartmentsQuery } from './schemas';

/**
 * Accès aux données du module Appartements (MVP-ENG-035, MVP-ENG-036).
 *
 * Ce module ne décide RIEN. Il ne connaît ni rôle, ni permission : le cas
 * d'usage a déjà établi que l'immeuble est accessible, et le dépôt travaille
 * dans ce cadre. Cette séparation est ce qui garantit qu'aucune requête ne
 * puisse contourner la barrière d'isolation par distraction.
 *
 * Aucune concaténation de SQL (MVP-ENG-037) : tout passe par le constructeur de
 * requêtes de Drizzle, y compris les termes de recherche.
 */

/** Instance Drizzle, quel que soit son pilote : postgres.js ou PGlite. */
export type ApartmentsDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * Code SQLSTATE d'une violation de contrainte d'unicité.
 *
 * Le pré-contrôle par lecture ne suffit pas : entre la lecture et l'écriture,
 * une autre requête peut insérer la même référence. La contrainte de base est le
 * seul arbitre fiable, et cette fonction permet de la traduire en erreur métier.
 */
const UNIQUE_VIOLATION = '23505';

export const APARTMENT_NUMBER_CONSTRAINT = 'apartments_property_number_unique';

export function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const code = (error as { code?: unknown }).code;
  const message = error instanceof Error ? error.message : '';

  return code === UNIQUE_VIOLATION || message.includes(constraint);
}

/**
 * Échappe les caractères génériques d'un motif `LIKE`.
 *
 * Sans cela, une recherche sur « 100 % » ramènerait tout le parc, et un souligné
 * remplacerait n'importe quel caractère. Ce n'est pas une faille, mais un
 * résultat incompréhensible pour l'utilisateur.
 */
function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/** Appartement par identifiant, SANS aucun contrôle d'accès. Réservé au cas d'usage. */
export async function findApartmentById(
  db: ApartmentsDatabase,
  apartmentId: string,
): Promise<Apartment | undefined> {
  const [row] = await db.select().from(apartments).where(eq(apartments.id, apartmentId)).limit(1);

  return row;
}

/** Appartement homonyme dans le même immeuble, archivé compris. */
export async function findApartmentByNumber(
  db: ApartmentsDatabase,
  propertyId: string,
  number: string,
): Promise<Apartment | undefined> {
  const [row] = await db
    .select()
    .from(apartments)
    .where(and(eq(apartments.propertyId, propertyId), eq(apartments.number, number)))
    .limit(1);

  return row;
}

/**
 * Références déjà utilisées parmi celles proposées, en UNE requête.
 *
 * La création groupée doit pouvoir refuser l'envoi entier en nommant les
 * références fautives : les chercher une par une coûterait autant de requêtes
 * que de logements proposés.
 */
export async function findUsedNumbers(
  db: ApartmentsDatabase,
  propertyId: string,
  numbers: readonly string[],
): Promise<string[]> {
  if (numbers.length === 0) return [];

  const rows = await db
    .select({ number: apartments.number })
    .from(apartments)
    .where(and(eq(apartments.propertyId, propertyId), inArray(apartments.number, [...numbers])));

  return rows.map((row) => row.number);
}

/** Valeurs d'insertion d'un appartement, telles que la base les attend. */
export type ApartmentInsert = {
  organizationId: string;
  propertyId: string;
  number: string;
  floor: number | null;
  type: string | null;
  /** Chaîne décimale : `numeric` ne s'écrit pas depuis un flottant sans arrondi. */
  area: string | null;
  status: 'VACANT' | 'OCCUPIED' | 'MAINTENANCE';
  referenceRentAmount: number | null;
  currency: string | null;
};

export async function insertApartment(
  db: ApartmentsDatabase,
  values: ApartmentInsert,
): Promise<Apartment> {
  const [row] = await db.insert(apartments).values(values).returning();

  // `returning()` sur une insertion d'une seule ligne en renvoie exactement une.
  // Le garde est là pour `noUncheckedIndexedAccess`, pas pour un cas réel.
  if (!row) throw new Error("L'insertion de l'appartement n'a renvoyé aucune ligne.");

  return row;
}

/**
 * Insère plusieurs appartements en UNE instruction.
 *
 * Une seule instruction donc une seule transaction implicite : soit tout
 * l'envoi est créé, soit rien ne l'est. C'est ce que la création groupée doit
 * garantir, sans quoi un échec au quinzième logement laisserait une structure à
 * moitié construite.
 */
export async function insertApartments(
  db: ApartmentsDatabase,
  values: readonly ApartmentInsert[],
): Promise<Apartment[]> {
  if (values.length === 0) return [];

  return db
    .insert(apartments)
    .values([...values])
    .returning();
}

export async function updateApartmentRow(
  db: ApartmentsDatabase,
  apartmentId: string,
  changes: ApartmentChanges,
): Promise<Apartment> {
  const [row] = await db
    .update(apartments)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(apartments.id, apartmentId))
    .returning();

  if (!row) throw new Error("La modification de l'appartement n'a renvoyé aucune ligne.");

  return row;
}

/** Conditions de filtre et de recherche, dans un immeuble donné. */
function filterConditions(propertyId: string, query: ListApartmentsQuery): SQL[] {
  const conditions: SQL[] = [eq(apartments.propertyId, propertyId)];

  if (!query.includeArchived) conditions.push(isNull(apartments.archivedAt));
  if (query.status !== 'ALL') conditions.push(eq(apartments.status, query.status));

  if (query.search !== null) {
    const pattern = `%${escapeLikePattern(query.search)}%`;
    const matches = or(ilike(apartments.number, pattern), ilike(apartments.type, pattern));

    if (matches) conditions.push(matches);
  }

  return conditions;
}

export type ApartmentPage = {
  rows: Apartment[];
  total: number;
};

/**
 * Page d'appartements d'un immeuble, triée.
 *
 * Les actifs d'abord, puis par RÉFÉRENCE seule. L'archive ne se consulte
 * qu'intentionnellement, et la référence est ce qui ordonne un parc : c'est
 * précisément ce que la numérotation « A01, A02, A03 » du parcours 3 encode, et
 * ce à quoi sert le remplissage par des zéros de `generateNumbers`.
 *
 * Un tri par étage a été essayé et retiré après l'avoir vu à l'écran. L'étage
 * est facultatif, et les logements qui n'en portent pas se plaçaient au niveau
 * du rez-de-chaussée : une série « B01 à B12 » créée sans étage venait
 * s'intercaler entre « A01 » et « A02 ». Trier sur une donnée souvent absente
 * disperse les séries au lieu de les ranger. L'étage reste affiché sur chaque
 * carte, où il renseigne sans désordonner.
 *
 * Le tri est TEXTUEL. « A10 » suit donc « A09 » à condition que la largeur soit
 * constante, seule convention que la création groupée produit.
 */
export async function listApartmentRows(
  db: ApartmentsDatabase,
  propertyId: string,
  query: ListApartmentsQuery,
): Promise<ApartmentPage> {
  const where = and(...filterConditions(propertyId, query));

  const [totals] = await db.select({ value: count() }).from(apartments).where(where);

  const rows = await db
    .select()
    .from(apartments)
    .where(where)
    .orderBy(asc(sql`${apartments.archivedAt} is not null`), asc(apartments.number))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  return { rows, total: totals?.value ?? 0 };
}

/**
 * Archive un appartement (DEC-039).
 *
 * Aucune suppression physique : `archived_at` est renseigné et l'historique
 * reste intact (BR-025, DEC-020). Le statut d'occupation n'est PAS touché : il
 * reste la dernière information vraie sur le logement, et l'effacer perdrait ce
 * que l'archive est censée préserver.
 *
 * La condition `archived_at IS NULL` rend l'opération sûre en cas de double
 * soumission concurrente, le cas d'usage ayant déjà refusé le second archivage.
 */
export async function archiveApartmentRow(
  db: ApartmentsDatabase,
  apartmentId: string,
): Promise<Apartment | undefined> {
  const now = new Date();

  const [row] = await db
    .update(apartments)
    .set({ archivedAt: now, updatedAt: now })
    .where(and(eq(apartments.id, apartmentId), isNull(apartments.archivedAt)))
    .returning();

  return row;
}
