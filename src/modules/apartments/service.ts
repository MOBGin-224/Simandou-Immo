import { z } from 'zod';

import {
  ResourceOutOfScopeError,
  requirePermission,
  type AccessContext,
} from '@/lib/authorization';
import { organizationDefaultCurrency } from '@/modules/organizations';
import { getProperty, type PropertyView } from '@/modules/properties';

import {
  assertModifiable,
  changedFields,
  generateNumbers,
  hasChanges,
  isArchived,
  toApartmentView,
  type ApartmentView,
} from './domain';
import {
  ApartmentBulkConflictError,
  ApartmentNumberAlreadyUsedError,
  ApartmentValidationError,
  AlreadyArchivedApartmentError,
  ArchivedApartmentError,
} from './errors';
import {
  APARTMENT_NUMBER_CONSTRAINT,
  archiveApartmentRow,
  findApartmentById,
  findApartmentByNumber,
  findUsedNumbers,
  insertApartment,
  insertApartments,
  isUniqueViolation,
  listApartmentRows,
  updateApartmentRow,
  type ApartmentInsert,
  type ApartmentsDatabase,
} from './repository';
import {
  createApartmentSchema,
  createApartmentsBulkSchema,
  generateApartmentsSchema,
  listApartmentsQuerySchema,
  updateApartmentSchema,
} from './schemas';

/**
 * Cas d'usage du module Appartements (MVP-ENG-033, MVP-BACKLOG-021).
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
 * Règle métier      archivage, unicité de la référence
 * ↓
 * Persistance
 * ```
 *
 * L'accès passe TOUJOURS par l'immeuble, et par sa façade publique
 * `getProperty` : c'est elle qui vérifie l'existence, le périmètre et la
 * permission `property.read`, et qui rend un immeuble d'une autre organisation
 * indiscernable d'un immeuble inexistant. Un appartement n'est donc jamais
 * atteignable autrement que par un immeuble déjà autorisé, ce qui ferme la voie
 * qu'un contrôle propre au module aurait pu laisser ouverte par distraction.
 */

/** Traduit un échec de schéma en erreur métier lisible par un formulaire. */
function toValidationError(error: z.ZodError): ApartmentValidationError {
  return new ApartmentValidationError(
    z.flattenError(error).fieldErrors as Record<string, string[]>,
  );
}

function parseOrThrow<Schema extends z.ZodType>(schema: Schema, input: unknown): z.output<Schema> {
  const result = schema.safeParse(input);

  if (!result.success) throw toValidationError(result.error);

  return result.data;
}

/**
 * Immeuble accessible, et permission d'appartement vérifiée sur son périmètre.
 *
 * La permission porte sur la ressource {organisation, immeuble} : c'est ce qui
 * borne un gestionnaire à son périmètre, ADR-007 lui refusant toute autorité en
 * dehors.
 */
async function loadPropertyFor(
  db: ApartmentsDatabase,
  context: AccessContext,
  propertyId: string,
  permission: 'apartment.create' | 'apartment.read' | 'apartment.update' | 'apartment.archive',
): Promise<PropertyView> {
  const property = await getProperty(db, context, propertyId);

  requirePermission(context, permission, {
    organizationId: property.organizationId,
    propertyId: property.id,
  });

  return property;
}

/**
 * Appartement accessible, avec son immeuble.
 *
 * L'appartement est lu d'abord, puis son immeuble est vérifié : c'est ce dernier
 * qui porte l'autorisation. Un identifiant qui n'est pas un UUID ne peut
 * désigner aucun logement, et le contrôle est ici plutôt que dans les routes
 * pour deux raisons : la réponse doit être la même que pour un identifiant
 * inconnu, et sans lui PostgreSQL refuserait la conversion, ce qui produirait
 * une erreur interne là où la réponse correcte est « inexistant ».
 */
async function loadAccessibleApartment(
  db: ApartmentsDatabase,
  context: AccessContext,
  apartmentId: string,
  permission: 'apartment.read' | 'apartment.update' | 'apartment.archive',
) {
  if (!z.string().uuid().safeParse(apartmentId).success) throw new ResourceOutOfScopeError();

  const apartment = await findApartmentById(db, apartmentId);

  if (!apartment) throw new ResourceOutOfScopeError();

  const property = await loadPropertyFor(db, context, apartment.propertyId, permission);

  return { apartment, property };
}

/**
 * Valeurs d'insertion, devise résolue.
 *
 * La devise vient de la saisie si elle y figure, sinon de l'organisation
 * (DEC-014). Elle n'est lue qu'en présence d'un montant : sans loyer, il n'y a
 * pas de devise à stocker, et la contrainte de base refuse l'une sans l'autre.
 */
async function toInsertValues(
  db: ApartmentsDatabase,
  property: PropertyView,
  data: z.infer<typeof createApartmentSchema>,
): Promise<ApartmentInsert> {
  const rent = data.referenceRent;
  const currency =
    rent === null
      ? null
      : (rent.currency ?? (await organizationDefaultCurrency(db, property.organizationId)));

  return {
    organizationId: property.organizationId,
    propertyId: property.id,
    number: data.number,
    floor: data.floor,
    type: data.type,
    area: data.area === null ? null : data.area.toFixed(2),
    status: data.status,
    referenceRentAmount: rent === null ? null : rent.amount,
    currency,
  };
}

/**
 * Crée un appartement (MVP-BACKLOG-021, BR-026, parcours 3).
 *
 * `apartment.create` est portée par le propriétaire ET par le gestionnaire sur
 * son périmètre : la matrice des rôles l'accorde aux deux sans réserve, à la
 * différence de la création d'un immeuble (DEC-025).
 *
 * Un immeuble archivé n'accepte plus de nouveau logement : il est sorti de
 * l'exploitation, et y ajouter une structure serait produire une donnée neuve
 * sur un objet retiré (BR-025).
 */
export async function createApartment(
  db: ApartmentsDatabase,
  context: AccessContext,
  propertyId: string,
  input: unknown,
): Promise<ApartmentView> {
  const data = parseOrThrow(createApartmentSchema, input);
  const property = await loadPropertyFor(db, context, propertyId, 'apartment.create');

  assertModifiable({ archivedAt: null }, property);

  // Pré-contrôle de la référence : il permet un message clair AVANT l'écriture.
  // La contrainte de base reste l'arbitre, plus bas, en cas de course.
  const homonym = await findApartmentByNumber(db, property.id, data.number);

  if (homonym) throw new ApartmentNumberAlreadyUsedError(data.number);

  try {
    const apartment = await insertApartment(db, await toInsertValues(db, property, data));

    return toApartmentView(apartment);
  } catch (error) {
    if (isUniqueViolation(error, APARTMENT_NUMBER_CONSTRAINT)) {
      throw new ApartmentNumberAlreadyUsedError(data.number);
    }

    throw error;
  }
}

/**
 * Crée plusieurs appartements en un envoi (API section 12, parcours 3).
 *
 * L'envoi est atomique : soit tout est créé, soit rien ne l'est. Créer les
 * logements recevables et taire les autres laisserait l'utilisateur devant une
 * structure partielle sans savoir laquelle, au moment précis où il construit son
 * immeuble.
 *
 * Seule la référence est demandée. Le reste se complète ensuite, logement par
 * logement : c'est exactement ce que décrit le parcours 3, pour éviter vingt
 * formulaires complets.
 */
export async function createApartmentsBulk(
  db: ApartmentsDatabase,
  context: AccessContext,
  propertyId: string,
  input: unknown,
): Promise<ApartmentView[]> {
  const data = parseOrThrow(createApartmentsBulkSchema, input);
  const property = await loadPropertyFor(db, context, propertyId, 'apartment.create');

  assertModifiable({ archivedAt: null }, property);

  const numbers = data.apartments.map((entry) => entry.number);
  const used = await findUsedNumbers(db, property.id, numbers);

  if (used.length > 0) throw new ApartmentBulkConflictError(used);

  const values: ApartmentInsert[] = numbers.map((number) => ({
    organizationId: property.organizationId,
    propertyId: property.id,
    number,
    floor: null,
    type: null,
    area: null,
    status: 'VACANT',
    referenceRentAmount: null,
    currency: null,
  }));

  try {
    const created = await insertApartments(db, values);

    return created.map(toApartmentView);
  } catch (error) {
    // Une course a inséré l'une des références entre la lecture et l'écriture.
    // L'envoi entier est refusé, la transaction n'ayant rien laissé derrière.
    if (isUniqueViolation(error, APARTMENT_NUMBER_CONSTRAINT)) {
      throw new ApartmentBulkConflictError(
        await findUsedNumbers(db, property.id, numbers).then((rows) =>
          rows.length > 0 ? rows : numbers,
        ),
      );
    }

    throw error;
  }
}

export type ApartmentCollection = {
  apartments: ApartmentView[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
};

/**
 * Liste les appartements d'un immeuble (MVP-BACKLOG-021).
 *
 * Le périmètre est celui de l'immeuble, déjà vérifié : un gestionnaire hors
 * périmètre n'atteint pas la liste, et reçoit le même refus que pour un immeuble
 * inexistant.
 */
export async function listApartments(
  db: ApartmentsDatabase,
  context: AccessContext,
  propertyId: string,
  query: unknown,
): Promise<ApartmentCollection> {
  const parsed = parseOrThrow(listApartmentsQuerySchema, query);
  const property = await loadPropertyFor(db, context, propertyId, 'apartment.read');

  const { rows, total } = await listApartmentRows(db, property.id, parsed);

  return {
    apartments: rows.map(toApartmentView),
    meta: {
      page: parsed.page,
      pageSize: parsed.pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / parsed.pageSize)),
    },
  };
}

/** Consulte un appartement (MVP-BACKLOG-023). */
export async function getApartment(
  db: ApartmentsDatabase,
  context: AccessContext,
  apartmentId: string,
): Promise<ApartmentView> {
  const { apartment } = await loadAccessibleApartment(db, context, apartmentId, 'apartment.read');

  return toApartmentView(apartment);
}

/**
 * Modifie un appartement (MVP-BACKLOG-021).
 *
 * Le gestionnaire en dispose sur son périmètre : `apartment.update` figure dans
 * ses capacités sans réserve.
 *
 * Une modification sans différence réelle n'écrit rien et ne lève pas d'erreur :
 * l'utilisateur qui soumet un formulaire inchangé a obtenu le résultat qu'il
 * voulait, et `updated_at` ne doit pas mentir pour autant.
 */
export async function updateApartment(
  db: ApartmentsDatabase,
  context: AccessContext,
  apartmentId: string,
  input: unknown,
): Promise<ApartmentView> {
  const data = parseOrThrow(updateApartmentSchema, input);
  const { apartment, property } = await loadAccessibleApartment(
    db,
    context,
    apartmentId,
    'apartment.update',
  );

  assertModifiable(apartment, property);

  const changes = changedFields(apartment, data);

  if (!hasChanges(changes)) return toApartmentView(apartment);

  // Un loyer nouvellement renseigné sans devise reçoit celle de l'organisation
  // (DEC-014) : la base refuse un montant sans devise.
  if (changes.referenceRentAmount != null && changes.currency == null) {
    changes.currency = await organizationDefaultCurrency(db, apartment.organizationId);
  }

  if (changes.number !== undefined) {
    const homonym = await findApartmentByNumber(db, apartment.propertyId, changes.number);

    if (homonym && homonym.id !== apartment.id) {
      throw new ApartmentNumberAlreadyUsedError(changes.number);
    }
  }

  try {
    return toApartmentView(await updateApartmentRow(db, apartment.id, changes));
  } catch (error) {
    if (changes.number !== undefined && isUniqueViolation(error, APARTMENT_NUMBER_CONSTRAINT)) {
      throw new ApartmentNumberAlreadyUsedError(changes.number);
    }

    throw error;
  }
}

/**
 * Crée une suite numérotée d'appartements (parcours 3, création rapide).
 *
 * C'est la porte d'entrée de l'écran : l'utilisateur décrit sa numérotation en
 * trois valeurs, « A », « à partir de 1 », « 20 logements », et le système
 * engendre les références puis les crée en un seul envoi atomique.
 *
 * Elle délègue à `createApartmentsBulk` plutôt que d'insérer elle-même : les
 * règles de conflit, d'atomicité et d'autorisation sont ainsi écrites une seule
 * fois, et la route `bulk` de l'API, qui reçoit une liste explicite, emprunte
 * exactement le même chemin.
 */
export async function generateApartments(
  db: ApartmentsDatabase,
  context: AccessContext,
  propertyId: string,
  input: unknown,
): Promise<ApartmentView[]> {
  const data = parseOrThrow(generateApartmentsSchema, input);
  const numbers = generateNumbers(data.prefix ?? '', data.start, data.count);

  return createApartmentsBulk(db, context, propertyId, {
    apartments: numbers.map((number) => ({ number })),
  });
}

/**
 * Archive un appartement (DEC-039, BR-025).
 *
 * Réservé au PROPRIÉTAIRE, confirmé par le fondateur le 28 septembre 2026 :
 * retirer un logement de l'exploitation est un acte patrimonial, au même titre
 * que l'archivage d'un immeuble. Un gestionnaire garde en revanche toute la main
 * sur l'opérationnel de son périmètre.
 *
 * Aucune suppression : le logement sort de l'exploitation, son historique reste
 * lisible, et son statut d'occupation est conservé tel quel (DEC-019, DEC-020).
 * Sa référence reste prise, comme le nom d'un immeuble archivé : libérer « A04 »
 * rendrait deux lignes homonymes indistinguables dans un historique de bail.
 *
 * Un immeuble archivé refuse l'opération avant même de regarder le logement :
 * il est déjà sorti de l'exploitation, et son archivage ne cascade pas sur ses
 * appartements.
 */
export async function archiveApartment(
  db: ApartmentsDatabase,
  context: AccessContext,
  apartmentId: string,
): Promise<ApartmentView> {
  const { apartment, property } = await loadAccessibleApartment(
    db,
    context,
    apartmentId,
    'apartment.archive',
  );

  if (property.archived) throw new ArchivedApartmentError('property-archived');
  if (isArchived(apartment)) throw new AlreadyArchivedApartmentError();

  const archived = await archiveApartmentRow(db, apartment.id);

  // La ligne n'est pas revenue : un autre appel l'a archivée entre la lecture et
  // l'écriture. Le refus est le même que celui du contrôle précédent.
  if (!archived) throw new AlreadyArchivedApartmentError();

  return toApartmentView(archived);
}
