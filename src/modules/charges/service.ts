import { z } from 'zod';

import type { Charge, ChargeAllocation } from '@/db/schema';
import {
  ResourceOutOfScopeError,
  readablePropertyScopes,
  requirePermission,
  type AccessContext,
  type Permission,
} from '@/lib/authorization';
import { organizationDefaultCurrency } from '@/modules/organizations';
import {
  displayStatusOf,
  isOpen,
  today,
  type ClockOptions,
  type ReceivableStatus,
} from '@/modules/receivables/client';

import {
  allocateEqually,
  assertAllocationBalances,
  summarizeAllocation,
  type AllocationShare,
  type CalculationBasis,
} from './allocation';
import type { ChargeType } from './constants';
import {
  compareChargeItems,
  isCancellable,
  isPublishable,
  type ChargeAllocationView,
  type ChargeApartmentRef,
  type ChargeListItem,
  type ChargePreview,
  type ChargePropertyRef,
  type ChargeTenantRef,
  type ChargeView,
} from './domain';
import { ChargeNoUnitError, ChargeStateError, ChargeValidationError } from './errors';
import {
  cancelAllocationsOfCharge,
  cancelChargeRow,
  findApartmentsByIds,
  findChargeById,
  findChargeTotals,
  findChargesByIds,
  findPeopleByIds,
  findPropertiesByIds,
  findPropertyById,
  insertAllocations,
  insertCharge,
  listAllocatableUnits,
  listAllocationRows,
  listAllocationsForTenant,
  listAllocationsOfCharge,
  listChargeRows,
  markOverdueAllocations,
  publishChargeRow,
  type ApartmentRow,
  type ChargeAllocationInsert,
  type ChargeScope,
  type ChargesDatabase,
} from './repository';
import {
  createChargeInputSchema,
  listChargeAllocationsQuerySchema,
  listChargesQuerySchema,
} from './schemas';

/**
 * Cas d'usage du module Charges (MVP-BACKLOG-051 à 054, API sections 27 à 31).
 *
 * Chaque fonction suit l'ordre imposé par API-001, sans exception :
 *
 * ```text
 * Authentification  déjà faite, le contexte d'accès la présuppose
 * ↓
 * Validation        schéma Zod, ici et non chez l'appelant
 * ↓
 * Périmètre         immeuble et permission, par le point de décision unique
 * ↓
 * Règle métier      état de la charge, logements concernés, invariant de somme
 * ↓
 * Persistance       transaction atomique, contrainte d'unicité en arbitre
 * ```
 *
 * **Ce qu'est une charge, et ce qu'elle n'est pas.** Une charge est un montant
 * global qui appartient à l'immeuble (BR-049). Elle ne doit rien à personne.
 * C'est sa PUBLICATION qui crée des créances payables, une par logement
 * concerné, et cette créance est distincte de l'échéance de loyer : c'est la
 * décision verrouillée DEC-005, et c'est la raison pour laquelle ce lot passe
 * avant les paiements, le moteur d'allocation devant connaître les deux types de
 * créance d'emblée.
 *
 * **Trois gestes, et trois seulement** : créer, publier, annuler. Il n'existe
 * aucune MODIFICATION d'une charge, et c'est une décision de ce lot. BR-053
 * interdit la correction silencieuse d'une charge publiée, l'API des sections 27
 * à 30 ne définit aucune route de mise à jour, et le backlog n'en demande
 * aucune : une charge fausse s'annule et se recrée, ce qui laisse les deux dans
 * l'historique (BR-054) au lieu de réécrire un montant déjà annoncé à des
 * locataires.
 *
 * **La publication n'est pas rejouable**, à la différence de la génération des
 * loyers. C'est la différence de nature entre les deux créances : un loyer naît
 * d'un contrat et se régénère sans risque (DEC-028), une répartition est un acte
 * unique, et la rejouer doublerait la facture. L'API section 29 exige donc un
 * `CONFLICT`, « y compris en cas de double-clic ou de requête concurrente ».
 *
 * **`amount_paid` et `balance` sont intouchés ici.** Ils sont dérivés des
 * allocations de paiements confirmés (section 21), qui arrivent au Lot 11. Au
 * Lot 10, une créance de charge naît à zéro payé et son solde vaut sa part.
 *
 * Aucune fonction ne reçoit ni `Request`, ni `FormData`, ni composant : ce module
 * est testable contre une vraie base sans monter de serveur.
 */

/** Réglages d'un appel : instant courant, pour la testabilité des dates. */
export type ChargeServiceOptions = ClockOptions;

function parseOrThrow<Schema extends z.ZodType>(schema: Schema, input: unknown): z.output<Schema> {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new ChargeValidationError(
      z.flattenError(result.error).fieldErrors as Record<string, string[]>,
    );
  }

  return result.data;
}

/**
 * Un identifiant qui n'est pas un UUID ne désigne rien.
 *
 * Sans ce contrôle, PostgreSQL refuserait la conversion et produirait une erreur
 * interne, là où la réponse correcte est « inexistant » : un identifiant mal
 * formé, inconnu ou hors périmètre doivent rester indiscernables (ADR-008).
 */
function requireUuid(value: string): string {
  if (!z.uuid().safeParse(value).success) throw new ResourceOutOfScopeError();

  return value;
}

function apartmentRefOf(row: ApartmentRow): ChargeApartmentRef {
  return {
    id: row.id,
    number: row.number,
    propertyId: row.propertyId,
    propertyName: row.propertyName,
  };
}

// --- Vues ---------------------------------------------------------------------------

type ChargeTotals = { unitCount: number; totalOutstanding: number };

function toListItem(
  row: Charge,
  property: ChargePropertyRef,
  totals: ChargeTotals,
): ChargeListItem {
  return {
    id: row.id,
    organizationId: row.organizationId,
    property,
    type: row.type as ChargeType,
    periodStart: row.periodStart,
    dueDate: row.dueDate,
    totalAmount: row.totalAmount,
    currency: row.currency,
    allocationMethod: row.allocationMethod,
    status: row.status,
    supplierName: row.supplierName,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    unitCount: totals.unitCount,
    totalOutstanding: totals.totalOutstanding,
  };
}

/**
 * Construit les vues de plusieurs charges en DEUX lectures, quel que soit leur
 * nombre : les immeubles, puis les agrégats de leurs créances.
 *
 * Une lecture par charge aurait suffi à l'écrire, et aurait fait deux requêtes
 * par ligne affichée.
 */
async function toListItems(
  db: ChargesDatabase,
  rows: readonly Charge[],
): Promise<ChargeListItem[]> {
  if (rows.length === 0) return [];

  const properties = new Map(
    (await findPropertiesByIds(db, [...new Set(rows.map((row) => row.propertyId))])).map(
      (property) => [property.id, property],
    ),
  );

  const totals = new Map(
    (
      await findChargeTotals(
        db,
        rows.map((row) => row.id),
      )
    ).map((total) => [
      total.chargeId,
      { unitCount: total.unitCount, totalOutstanding: total.totalOutstanding },
    ]),
  );

  return rows
    .flatMap((row) => {
      const property = properties.get(row.propertyId);

      // La clé étrangère est en `restrict` : une charge sans immeuble est
      // impossible. On n'invente pas de ligne vide pour autant.
      if (!property) return [];

      return [
        {
          item: toListItem(
            row,
            property,
            totals.get(row.id) ?? { unitCount: 0, totalOutstanding: 0 },
          ),
          /*
           * La date de création décide de l'ordre à période égale, sans figurer
           * dans la vue : deux factures d'eau du même mois sont indiscernables
           * pour le lecteur, et l'ordre doit pourtant être total.
           */
          createdAt: row.createdAt.toISOString(),
        },
      ];
    })
    .sort((a, b) =>
      compareChargeItems(
        { periodStart: a.item.periodStart, createdAt: a.createdAt },
        { periodStart: b.item.periodStart, createdAt: b.createdAt },
      ),
    )
    .map((entry) => entry.item);
}

/**
 * Construit les vues de plusieurs créances de charge en TROIS lectures : les
 * charges d'origine, les logements, puis les personnes.
 *
 * Les personnes sont lues pour les seules créances qui en portent une : une
 * répartition sur un immeuble à moitié vide ne doit pas interroger la table des
 * utilisateurs pour des créances sans redevable (BR-052).
 */
async function toAllocationViews(
  db: ChargesDatabase,
  rows: readonly ChargeAllocation[],
  day: string,
): Promise<ChargeAllocationView[]> {
  if (rows.length === 0) return [];

  const charges = new Map(
    (await findChargesByIds(db, [...new Set(rows.map((row) => row.chargeId))])).map((charge) => [
      charge.id,
      charge,
    ]),
  );

  const apartments = new Map(
    (await findApartmentsByIds(db, [...new Set(rows.map((row) => row.apartmentId))])).map((row) => [
      row.id,
      apartmentRefOf(row),
    ]),
  );

  const tenantIds = [
    ...new Set(rows.map((row) => row.tenantUserId).filter((id): id is string => id !== null)),
  ];

  const people = new Map(
    (await findPeopleByIds(db, tenantIds, [...new Set(rows.map((row) => row.organizationId))])).map(
      (row) => [row.userId, row],
    ),
  );

  return rows.flatMap((row) => {
    const charge = charges.get(row.chargeId);
    const apartment = apartments.get(row.apartmentId);

    if (!charge || !apartment) return [];

    const person = row.tenantUserId === null ? null : people.get(row.tenantUserId);
    const tenant: ChargeTenantRef | null = person
      ? {
          userId: person.userId,
          accessId: person.accessId,
          fullName: person.fullName,
          phone: person.phone,
        }
      : null;

    const status = row.status as ReceivableStatus;

    return [
      {
        id: row.id,
        organizationId: row.organizationId,
        chargeId: row.chargeId,
        charge: {
          type: charge.type as ChargeType,
          status: charge.status,
          supplierName: charge.supplierName,
          totalAmount: charge.totalAmount,
        },
        apartment,
        tenant,
        leaseId: row.leaseId,
        periodStart: row.periodStart,
        dueDate: row.dueDate,
        amountDue: row.amountDue,
        amountPaid: row.amountPaid,
        balance: row.balance,
        currency: row.currency,
        status,
        displayStatus: displayStatusOf({ status, dueDate: row.dueDate }, day),
        explanation: row.calculationBasis as CalculationBasis,
        createdAt: row.createdAt.toISOString(),
      } satisfies ChargeAllocationView,
    ];
  });
}

/** Charge complète, avec ses parts : ce que la fiche affiche. */
async function toChargeView(db: ChargesDatabase, row: Charge, day: string): Promise<ChargeView> {
  const [item] = await toListItems(db, [row]);

  if (!item) throw new ResourceOutOfScopeError();

  const allocations = await toAllocationViews(db, await listAllocationsOfCharge(db, row.id), day);

  return {
    ...item,
    allocations,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// --- Lecture ------------------------------------------------------------------------

/**
 * Charge une charge que l'appelant a le droit de lire, ou refuse.
 *
 * Le refus est « inexistant » et jamais « interdit » : un identifiant inconnu et
 * un identifiant hors périmètre doivent rester indiscernables (ADR-007,
 * ADR-008).
 *
 * Aucun `ownerUserId` n'est transmis, à la différence d'une échéance de loyer :
 * une charge appartient à l'IMMEUBLE et non à une personne, donc un locataire
 * n'en atteint aucune. Il consulte SA PART, qui est une créance, par
 * `/api/v1/me/charges` et par son espace.
 */
async function loadReadableCharge(
  db: ChargesDatabase,
  context: AccessContext,
  chargeId: string,
  permission: Permission,
): Promise<Charge> {
  const row = await findChargeById(db, requireUuid(chargeId));

  if (!row) throw new ResourceOutOfScopeError();

  requirePermission(context, permission, {
    organizationId: row.organizationId,
    propertyId: row.propertyId,
  });

  return row;
}

/** Consulte une charge et sa répartition (API section 27, MVP-BACKLOG-054). */
export async function getCharge(
  db: ChargesDatabase,
  context: AccessContext,
  chargeId: string,
  options: ChargeServiceOptions = {},
): Promise<ChargeView> {
  const row = await loadReadableCharge(db, context, chargeId, 'charge.read');

  return toChargeView(db, row, today(options));
}

export type ChargeCollection = {
  charges: ChargeListItem[];
  meta: { total: number; page: number; pageSize: number };
  /**
   * Somme des soldes restant à encaisser sur le résultat filtré (BR-039).
   *
   * Calculée côté serveur, et sur l'ensemble du filtre et non sur la page
   * affichée : un total qui ne compterait que les lignes visibles annoncerait
   * une dette fausse.
   */
  totalOutstanding: number;
  /** Devise de ce total, ou `null` si le résultat est vide. */
  currency: string | null;
};

/**
 * Liste les charges lisibles (API section 30, MVP-BACKLOG-054).
 *
 * Le périmètre est traduit en conditions SQL par le dépôt : aucune charge d'une
 * autre organisation, ni d'un immeuble hors périmètre, ne quitte le serveur
 * (API section 67).
 *
 * Un appelant sans aucun périmètre lisible obtient « inexistant ». C'est le cas
 * d'un LOCATAIRE : il porte `charge.read`, mais pour ses propres créances, son
 * rattachement étant lui-même et non un immeuble (BR-021). C'est la même
 * frontière que pour les loyers et les baux.
 */
export async function listCharges(
  db: ChargesDatabase,
  context: AccessContext,
  input: unknown = {},
): Promise<ChargeCollection> {
  const query = parseOrThrow(listChargesQuerySchema, input);
  const scopes = readablePropertyScopes(context, 'charge.read');

  if (scopes.length === 0) throw new ResourceOutOfScopeError();

  const rows = await listChargeRows(db, scopes as readonly ChargeScope[], {
    propertyId: query.propertyId ?? null,
    period: query.period ?? null,
    type: query.type ?? null,
    status: query.status,
  });

  const items = await toListItems(db, rows);
  const start = (query.page - 1) * query.pageSize;

  return {
    charges: items.slice(start, start + query.pageSize),
    meta: { total: items.length, page: query.page, pageSize: query.pageSize },
    totalOutstanding: items.reduce((sum, item) => sum + item.totalOutstanding, 0),
    currency: items[0]?.currency ?? null,
  };
}

export type ChargeAllocationCollection = {
  allocations: ChargeAllocationView[];
  meta: { total: number; page: number; pageSize: number };
  totalOutstanding: number;
  currency: string | null;
};

/**
 * Liste les créances de charge lisibles (API section 26).
 *
 * Le pendant exact de `GET /api/v1/rents` pour la seconde créance du MVP : mêmes
 * filtres de statut, même traduction du périmètre, même refus pour qui n'a aucun
 * immeuble lisible.
 *
 * Les créances d'un logement VACANT y figurent, et c'est l'un des points de la
 * décision : elles restent visibles du propriétaire et du gestionnaire, qui
 * doivent savoir quelle part de la facture reste à leur charge (BR-052).
 */
export async function listChargeAllocations(
  db: ChargesDatabase,
  context: AccessContext,
  input: unknown = {},
  options: ChargeServiceOptions = {},
): Promise<ChargeAllocationCollection> {
  const query = parseOrThrow(listChargeAllocationsQuerySchema, input);
  const scopes = readablePropertyScopes(context, 'charge.read');

  if (scopes.length === 0) throw new ResourceOutOfScopeError();

  const day = today(options);

  const rows = await listAllocationRows(db, scopes as readonly ChargeScope[], {
    propertyId: query.propertyId ?? null,
    apartmentId: query.apartmentId ?? null,
    tenantUserId: query.tenantId ?? null,
    chargeId: query.chargeId ?? null,
    period: query.period ?? null,
    status: query.status,
    today: day,
  });

  const items = await toAllocationViews(db, rows, day);
  const open = items.filter((item) => isOpen(item.status));
  const start = (query.page - 1) * query.pageSize;

  return {
    allocations: items.slice(start, start + query.pageSize),
    meta: { total: items.length, page: query.page, pageSize: query.pageSize },
    totalOutstanding: open.reduce((sum, item) => sum + item.balance, 0),
    currency: open[0]?.currency ?? items[0]?.currency ?? null,
  };
}

/**
 * Créances de charge de la personne connectée (API section 31, BR-021).
 *
 * « Le locataire ne demande jamais la totalité de la charge » : la section le
 * dit, et c'est le sens de cette fonction. Aucun périmètre d'immeuble
 * n'intervient, elle est son propre périmètre, et le filtre porte sur la
 * personne redevable figée à la publication.
 *
 * Chaque créance porte son `explanation`, ce que la section 31 exige
 * explicitement : le locataire doit pouvoir comprendre comment sa part a été
 * calculée sans avoir à le demander.
 */
export async function listMyCharges(
  db: ChargesDatabase,
  context: AccessContext,
  options: ChargeServiceOptions = {},
): Promise<ChargeAllocationView[]> {
  const day = today(options);

  return toAllocationViews(db, await listAllocationsForTenant(db, context.userId), day);
}

/**
 * Créances de charge OUVERTES d'une personne, pour le total dû (DEC-005).
 *
 * Exposée au module Créances, qui agrège les deux types en un seul total
 * (BR-055). Elle ne décide d'AUCUNE autorisation : c'est l'agrégateur qui
 * vérifie, créance par créance, que l'appelant a le droit de la lire, parce que
 * la même personne peut louer dans deux immeubles dont un seul relève du
 * gestionnaire qui pose la question.
 */
export async function openChargeReceivablesForTenant(
  db: ChargesDatabase,
  tenantUserId: string,
  options: ChargeServiceOptions = {},
): Promise<ChargeAllocationView[]> {
  const rows = await listAllocationsForTenant(db, requireUuid(tenantUserId), { openOnly: true });

  return toAllocationViews(db, rows, today(options));
}

// --- Création -----------------------------------------------------------------------

/**
 * Enregistre une charge, en BROUILLON (MVP-BACKLOG-051, API section 27).
 *
 * « La charge est créée en statut `DRAFT`. Elle ne crée aucune créance et n'est
 * visible d'aucun locataire tant qu'elle n'est pas publiée. » La section le dit,
 * et c'est l'étape qui rend l'aperçu possible : le gestionnaire vérifie la
 * répartition avant qu'elle n'engage qui que ce soit (parcours 18, étapes 5
 * à 7).
 *
 * L'immeuble est lu AVANT la vérification de permission, et son organisation
 * vient de lui : la recevoir de l'appelant permettrait d'enregistrer une charge
 * dans l'organisation d'un autre bailleur. Un immeuble inconnu ou hors périmètre
 * donne « inexistant », sans se distinguer l'un de l'autre.
 *
 * Un immeuble ARCHIVÉ est refusé : il est sorti de l'exploitation (DEC-020), et
 * lui refacturer une charge nouvelle reviendrait à créer des créances sur un
 * parc qu'on a cessé d'exploiter. L'historique de ses charges passées reste
 * consultable.
 */
export async function createCharge(
  db: ChargesDatabase,
  context: AccessContext,
  input: unknown,
  options: ChargeServiceOptions = {},
): Promise<ChargeView> {
  const data = parseOrThrow(createChargeInputSchema, input);
  const property = await findPropertyById(db, requireUuid(data.propertyId));

  if (!property) throw new ResourceOutOfScopeError();

  requirePermission(context, 'charge.create', {
    organizationId: property.organizationId,
    propertyId: property.id,
  });

  if (property.archivedAt !== null) throw new ChargeStateError('property-archived');

  const row = await insertCharge(db, {
    organizationId: property.organizationId,
    propertyId: property.id,
    type: data.type,
    periodStart: data.periodStart,
    dueDate: data.dueDate,
    totalAmount: data.totalAmount,
    // Devise de l'organisation quand elle n'est pas précisée (DEC-014), comme
    // pour le loyer de référence d'un appartement.
    currency: data.currency ?? (await organizationDefaultCurrency(db, property.organizationId)),
    allocationMethod: data.allocationMethod,
    supplierName: data.supplierName,
    createdBy: context.userId,
  });

  return toChargeView(db, row, today(options));
}

// --- Répartition --------------------------------------------------------------------

/**
 * Logements concernés et parts calculées, pour une charge donnée.
 *
 * Partagé par l'aperçu et par la publication, et c'est le point essentiel : les
 * deux doivent produire EXACTEMENT le même résultat, sans quoi l'aperçu
 * annoncerait une répartition que la publication ne tiendrait pas. Un seul
 * chemin de calcul rend la divergence impossible.
 */
async function computeShares(
  db: ChargesDatabase,
  charge: Charge,
  propertyName: string,
): Promise<{ units: Awaited<ReturnType<typeof listAllocatableUnits>>; shares: AllocationShare[] }> {
  const units = await listAllocatableUnits(db, charge.propertyId);

  if (units.length === 0) throw new ChargeNoUnitError(propertyName);

  const shares = allocateEqually(charge.totalAmount, units);

  assertAllocationBalances(charge.totalAmount, shares);

  return { units, shares };
}

/**
 * Prévisualise la répartition d'une charge (MVP-BACKLOG-053, API section 28).
 *
 * « Cette opération ne publie rien. » Elle n'écrit donc rien du tout : aucune
 * créance, aucun statut, aucune date. Elle répond aux quatre questions de la
 * section, et à une cinquième que le produit a besoin de poser : quels logements
 * sont vacants, et porteront donc une part sans locataire redevable (BR-052).
 *
 * Elle reste calculée à la DEMANDE et jamais mémorisée : le nombre de logements
 * d'un immeuble peut changer entre deux aperçus, et c'est précisément ce que le
 * gestionnaire doit voir. Seule la publication figera le calcul, dans
 * `calculation_basis`.
 *
 * Permission `charge.read` et non `charge.publish` : l'opération ne modifie
 * rien, et interdire de regarder une répartition à qui peut lire la charge
 * n'aurait pas de sens. La publication, elle, est gardée séparément.
 */
export async function previewCharge(
  db: ChargesDatabase,
  context: AccessContext,
  chargeId: string,
): Promise<ChargePreview> {
  const charge = await loadReadableCharge(db, context, chargeId, 'charge.read');
  const property = await findPropertyById(db, charge.propertyId);

  if (!property) throw new ResourceOutOfScopeError();

  const { units, shares } = await computeShares(db, charge, property.name);
  const byApartment = new Map(units.map((unit) => [unit.apartmentId, unit]));

  return {
    chargeId: charge.id,
    property: { id: property.id, name: property.name },
    type: charge.type as ChargeType,
    periodStart: charge.periodStart,
    dueDate: charge.dueDate,
    currency: charge.currency,
    summary: summarizeAllocation(charge.totalAmount, shares),
    shares: shares.map((share) => {
      const unit = byApartment.get(share.apartmentId);

      return {
        apartmentId: share.apartmentId,
        number: share.number,
        amountDue: share.amountDue,
        occupied: unit?.tenantUserId !== null && unit?.tenantUserId !== undefined,
        tenantName: unit?.tenantName ?? null,
      };
    }),
  };
}

export type ChargePublicationResult = {
  charge: ChargeView;
  /** Créances créées par cette publication, une par logement concerné. */
  created: number;
};

/**
 * Publie une charge et crée ses créances (MVP-BACKLOG-052, API section 29,
 * Database Schema section 32).
 *
 * **Le cœur du lot, et une transaction ATOMIQUE** : soit toutes les créances
 * sont créées, soit aucune (BR-052). La section 32 décrit huit temps ; les six
 * qui appartiennent au MVP sont tenus ici, dans cet ordre :
 *
 * ```text
 * BEGIN
 *   1. verrouiller la charge en la passant DRAFT -> PUBLISHED
 *   2. lire les logements concernés, calculer les parts
 *   3. vérifier l'invariant somme(parts) = total
 *   4. créer une créance par logement, UNPAID, à zéro payé
 * COMMIT
 * ```
 *
 * Les deux temps restants, la notification des locataires et la journalisation
 * d'audit, appartiennent aux lots 17 et 20 : aucune table ne les porte encore, et
 * les inventer ici produirait du code que rien ne lit.
 *
 * **Pourquoi le verrou d'abord.** Le passage en `PUBLISHED` est conditionné à
 * `status = 'DRAFT'` dans le `WHERE`, et il est pris AVANT le calcul : deux
 * requêtes concurrentes se sérialisent donc sur le verrou de ligne, et la
 * seconde ne trouve plus de brouillon. Elle échoue sans avoir rien écrit, ce qui
 * est exactement le `CONFLICT` que la section 29 exige en cas de double-clic. La
 * contrainte `UNIQUE (charge_id, apartment_id)` reste le dernier arbitre si une
 * publication parvenait malgré tout à s'exécuter deux fois.
 *
 * **Ce que la publication FIGE.** Le bail actif et la personne redevable de
 * chaque logement, et la justification du calcul. Aucun des trois n'est recalculé
 * ensuite (section 30) : la part de la facture de septembre est due par qui
 * occupait le logement à la répartition, et l'arrivée d'un nouveau locataire ne
 * lui transmet pas une dette qui n'est pas la sienne.
 */
export async function publishCharge(
  db: ChargesDatabase,
  context: AccessContext,
  chargeId: string,
  options: ChargeServiceOptions = {},
): Promise<ChargePublicationResult> {
  const charge = await loadReadableCharge(db, context, chargeId, 'charge.publish');

  /*
   * Pré-contrôle hors transaction, pour le MESSAGE seulement.
   *
   * Il distingue « déjà publiée » de « annulée », ce que l'absence de ligne mise
   * à jour ne dirait pas. Il ne garantit rien : c'est la condition dans le
   * `WHERE`, plus bas, qui arbitre une course.
   */
  if (!isPublishable(charge)) {
    throw new ChargeStateError(
      charge.status === 'PUBLISHED' ? 'already-published' : 'already-cancelled',
    );
  }

  const property = await findPropertyById(db, charge.propertyId);

  if (!property) throw new ResourceOutOfScopeError();

  const publishedAt = options.now ?? new Date();

  const created = await db.transaction(async (tx) => {
    const locked = await publishChargeRow(tx, charge.id, publishedAt);

    /*
     * Aucune ligne : une autre requête a publié ou annulé la charge entre notre
     * lecture et ce verrou. La transaction est abandonnée avant toute écriture de
     * créance, et l'appelant reçoit un conflit (API section 29).
     */
    if (!locked) {
      const current = await findChargeById(tx, charge.id);

      throw new ChargeStateError(
        current?.status === 'CANCELLED' ? 'already-cancelled' : 'already-published',
      );
    }

    const { units, shares } = await computeShares(tx, locked, property.name);
    const byApartment = new Map(units.map((unit) => [unit.apartmentId, unit]));

    const values: ChargeAllocationInsert[] = shares.map((share) => {
      const unit = byApartment.get(share.apartmentId);

      return {
        organizationId: locked.organizationId,
        chargeId: locked.id,
        propertyId: locked.propertyId,
        apartmentId: share.apartmentId,
        /*
         * Bail et personne du bail ACTIF, ou `null` pour un logement vacant
         * (BR-052). Les deux vont ensemble, et une contrainte de base le vérifie.
         */
        leaseId: unit?.leaseId ?? null,
        tenantUserId: unit?.tenantUserId ?? null,
        periodStart: locked.periodStart,
        dueDate: locked.dueDate,
        amountDue: share.amountDue,
        // Rien n'est encore payé, donc le solde vaut la part (section 21).
        balance: share.amountDue,
        currency: locked.currency,
        calculationBasis: share.basis,
      };
    });

    return insertAllocations(tx, values);
  });

  const row = await findChargeById(db, charge.id);

  if (!row) throw new ResourceOutOfScopeError();

  return {
    charge: await toChargeView(db, row, today(options)),
    created: created.length,
  };
}

/**
 * Annule une charge et éteint ses créances (BR-054, API section 29,
 * « Annulation »).
 *
 * « Passe la charge en `CANCELLED` et ses créances en `CANCELLED`, sans supprimer
 * ni les créances, ni les allocations de paiement déjà réalisées. » Rien n'est
 * donc effacé : une créance annulée sort du total dû (BR-039) en laissant
 * visible l'argent déjà reçu, et un remboursement reste une décision humaine,
 * hors MVP (DEC-016).
 *
 * **Annuler un BROUILLON est aussi la façon de corriger une erreur de saisie.**
 * Il n'existe aucune modification de charge dans ce lot, par décision : BR-053
 * interdit la correction silencieuse, l'API n'offre pas de route de mise à jour,
 * et une charge annulée puis recréée laisse les deux versions dans l'historique,
 * ce qu'une réécriture ferait disparaître.
 *
 * **Aucune permission `charge.cancel` n'existe**, et aucune n'est inventée : le
 * catalogue est exhaustif pour le MVP (DEC-025, Lot 3), et une permission ne
 * crée jamais une fonctionnalité. L'annulation relève donc de `charge.publish`,
 * la permission qui gouverne l'existence des créances : qui peut les faire naître
 * peut les éteindre.
 *
 * La RAISON de l'annulation que BR-054 mentionne n'est pas stockée : la section
 * 28 ne donne aucune colonne pour la porter, et en ajouter une qu'aucun écran ne
 * remplit n'enregistrerait rien. Ce que la règle exige est conservé : la charge
 * initiale, l'utilisateur qui l'a créée, et la date d'annulation. La raison
 * rejoindra le journal d'audit (Lot 20), qui est sa place.
 */
export async function cancelCharge(
  db: ChargesDatabase,
  context: AccessContext,
  chargeId: string,
  options: ChargeServiceOptions = {},
): Promise<ChargeView> {
  const charge = await loadReadableCharge(db, context, chargeId, 'charge.publish');

  if (!isCancellable(charge)) throw new ChargeStateError('already-cancelled');

  const cancelledAt = options.now ?? new Date();

  await db.transaction(async (tx) => {
    const cancelled = await cancelChargeRow(tx, charge.id, cancelledAt);

    // Course perdue : une autre requête vient d'annuler la charge. Son annulation
    // vaut la nôtre, et la nôtre ne doit pas réécrire sa date.
    if (!cancelled) throw new ChargeStateError('already-cancelled');

    /*
     * Les créances suivent la charge, dans la MÊME transaction : une charge
     * annulée dont les créances resteraient dues réclamerait de l'argent au nom
     * d'une facture retirée. Un brouillon n'en a aucune, et la mise à jour ne
     * touche alors rien.
     */
    await cancelAllocationsOfCharge(tx, charge.id, cancelledAt);
  });

  const row = await findChargeById(db, charge.id);

  if (!row) throw new ResourceOutOfScopeError();

  return toChargeView(db, row, today(options));
}

export type ChargeOverdueResult = {
  /** Date civile du jour retenue pour la comparaison. */
  today: string;
  /** Créances de charge passées en `OVERDUE` par cet appel. */
  marked: number;
};

/**
 * Bascule les créances de charge échues en `OVERDUE` (BR-037, job
 * `markOverdueReceivables`).
 *
 * La moitié « charges » du job des créances, la moitié « loyers » appartenant au
 * module Loyers. Les deux sont appelées par le même job, le retard se constatant
 * de la même façon sur les deux créances (DEC-015).
 *
 * Le passage est le fait d'un JOB et jamais d'une lecture, la règle le dit
 * explicitement. Idempotent : la seconde exécution ne trouve plus rien,
 * `OVERDUE` n'étant pas un statut visé.
 */
export async function runChargeOverdueJob(
  db: ChargesDatabase,
  options: ChargeServiceOptions = {},
): Promise<ChargeOverdueResult> {
  const day = today(options);
  const marked = await markOverdueAllocations(db, day);

  return { today: day, marked: marked.length };
}
