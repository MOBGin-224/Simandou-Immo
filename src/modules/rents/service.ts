import { z } from 'zod';

import type { RentInstallment } from '@/db/schema';
import {
  ResourceOutOfScopeError,
  readablePropertyScopes,
  requirePermission,
  type AccessContext,
  type Permission,
} from '@/lib/authorization';
import { today } from '@/modules/receivables/client';

import { RENT_GENERATION_MAX_INSTALLMENTS, type ReceivableStatus } from './constants';
import {
  compareRentItems,
  displayStatusOf,
  isOpen,
  type RentApartmentRef,
  type RentListItem,
  type RentTenantRef,
  type RentView,
} from './domain';
import { RentGenerationLimitError, RentValidationError } from './errors';
import { dueDateFor, leaseCoversPeriod, periodEndOf, periodOf } from './period';
import {
  findApartmentsByIds,
  findInstallmentById,
  findPeopleByIds,
  insertMissingInstallments,
  listBillableLeases,
  listInstallmentRows,
  listInstallmentsForTenant,
  markOverdueInstallments,
  type ApartmentRow,
  type RentInstallmentInsert,
  type RentsDatabase,
  type RentScope,
} from './repository';
import { generateRentsSchema, listRentsQuerySchema } from './schemas';

/**
 * Cas d'usage du module Loyers (MVP-BACKLOG-036 à 039, API sections 18 et 19).
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
 * Règle métier      recouvrement du bail, montant du contrat, date rabattue
 * ↓
 * Persistance       la contrainte d'unicité porte l'idempotence
 * ```
 *
 * **Ce qu'est une échéance.** La créance de loyer d'une période, née d'un bail
 * actif (BR-034). Elle n'est pas saisie : elle est GÉNÉRÉE, et le seul chemin
 * d'écriture du produit passe par `generateRents`. Il n'existe donc ni création
 * manuelle, ni modification de montant : les deux reviendraient à écrire une
 * dette à la main, alors que le contrat la détermine (BR-036).
 *
 * **Trois règles de calendrier, et elles sont toutes dans `period.ts`** : la
 * période en cours seulement, aucun prorata, date d'échéance rabattue sur le
 * dernier jour du mois (DEC-053). Ce fichier les applique, il ne les redéfinit
 * pas.
 *
 * **Le statut n'est jamais écrit à la lecture.** Une échéance naît `UNPAID`, et
 * le passage à `OVERDUE` est le fait d'un job idempotent (BR-037). « À venir »
 * n'est pas un statut du tout : c'est une dérivation d'affichage, calculée par
 * `displayStatusOf` et transmise à côté du statut réel.
 *
 * **`amount_paid` et `balance` sont intouchés ici.** Ils sont dérivés des
 * allocations de paiements confirmés (Database Schema section 21), qui arrivent
 * au Lot 11. Au Lot 9, une échéance naît à zéro payé et son solde vaut le montant
 * dû.
 *
 * Aucune fonction ne reçoit ni `Request`, ni `FormData`, ni composant : ce module
 * est testable contre une vraie base sans monter de serveur.
 */

/**
 * Réglages d'un appel, tous facultatifs.
 *
 * Existent pour la TESTABILITÉ, et ici plus qu'ailleurs : tout ce lot est une
 * affaire de dates. Fixer l'instant courant permet d'éprouver un retard, un
 * mois court ou une année bissextile sans attendre le jour dit.
 */
export type RentServiceOptions = {
  now?: Date;
};

/**
 * Date civile du jour : une seule définition pour les deux créances.
 *
 * Elle vit dans le module Créances depuis le Lot 10 et est réexportée ici sous
 * son nom d'origine. Deux lectures séparées de la date du jour se
 * contrediraient au passage de minuit, et c'est cette date qui décide de « À
 * venir » comme du retard (BR-037).
 */
export { today };

function parseOrThrow<Schema extends z.ZodType>(schema: Schema, input: unknown): z.output<Schema> {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new RentValidationError(
      z.flattenError(result.error).fieldErrors as Record<string, string[]>,
    );
  }

  return result.data;
}

function apartmentRefOf(row: ApartmentRow): RentApartmentRef {
  return {
    id: row.id,
    number: row.number,
    propertyId: row.propertyId,
    propertyName: row.propertyName,
  };
}

// --- Vues ---------------------------------------------------------------------------

type ViewParts = {
  apartment: RentApartmentRef;
  tenant: RentTenantRef;
  today: string;
};

function toView(row: RentInstallment, parts: ViewParts): RentView {
  const status = row.status as ReceivableStatus;

  return {
    id: row.id,
    organizationId: row.organizationId,
    leaseId: row.leaseId,
    apartment: parts.apartment,
    tenant: parts.tenant,
    periodStart: row.periodStart,
    dueDate: row.dueDate,
    amountDue: row.amountDue,
    amountPaid: row.amountPaid,
    balance: row.balance,
    currency: row.currency,
    status,
    displayStatus: displayStatusOf({ status, dueDate: row.dueDate }, parts.today),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Construit les vues de plusieurs échéances en DEUX lectures, quel que soit leur
 * nombre : les logements, puis les personnes.
 *
 * Une lecture par échéance aurait suffi à l'écrire, et aurait fait deux requêtes
 * par ligne affichée.
 */
async function toViews(
  db: RentsDatabase,
  rows: readonly RentInstallment[],
  day: string,
): Promise<RentView[]> {
  if (rows.length === 0) return [];

  const apartments = new Map(
    (await findApartmentsByIds(db, [...new Set(rows.map((row) => row.apartmentId))])).map((row) => [
      row.id,
      apartmentRefOf(row),
    ]),
  );

  const people = new Map(
    (
      await findPeopleByIds(
        db,
        [...new Set(rows.map((row) => row.tenantUserId))],
        [...new Set(rows.map((row) => row.organizationId))],
      )
    ).map((row) => [row.userId, row]),
  );

  return rows.flatMap((row) => {
    const apartment = apartments.get(row.apartmentId);
    const tenant = people.get(row.tenantUserId);

    // Les clés étrangères sont en `restrict` : une échéance sans logement ni
    // personne est impossible. On n'invente pas de ligne vide pour autant.
    if (!apartment || !tenant) return [];

    return [toView(row, { apartment, tenant, today: day })];
  });
}

function toListItems(views: readonly RentView[]): RentListItem[] {
  return views
    .map(({ createdAt: _createdAt, updatedAt: _updatedAt, ...item }) => item)
    .sort(compareRentItems);
}

// --- Lecture ------------------------------------------------------------------------

/**
 * Charge une échéance que l'appelant a le droit de lire, ou refuse.
 *
 * Le refus est « inexistant » et jamais « interdit » : un identifiant inconnu et
 * un identifiant hors périmètre doivent rester indiscernables (ADR-007,
 * ADR-008).
 *
 * `ownerUserId` porte la personne redevable, ce qui est exactement ce dont un
 * locataire a besoin : il a `rent.read` et lit SA créance, sans être rattaché à
 * aucun immeuble (BR-021).
 */
async function loadReadableInstallment(
  db: RentsDatabase,
  context: AccessContext,
  installmentId: string,
  permission: Permission,
): Promise<RentInstallment> {
  // Un identifiant qui n'est pas un UUID ne peut désigner aucune échéance. Sans
  // ce contrôle PostgreSQL refuserait la conversion et produirait une erreur
  // interne, là où la réponse correcte est « inexistant ».
  if (!z.uuid().safeParse(installmentId).success) throw new ResourceOutOfScopeError();

  const row = await findInstallmentById(db, installmentId);

  if (!row) throw new ResourceOutOfScopeError();

  requirePermission(context, permission, {
    organizationId: row.organizationId,
    propertyId: row.propertyId,
    ownerUserId: row.tenantUserId,
  });

  return row;
}

/** Consulte une échéance (API section 18). */
export async function getRent(
  db: RentsDatabase,
  context: AccessContext,
  installmentId: string,
  options: RentServiceOptions = {},
): Promise<RentView> {
  const row = await loadReadableInstallment(db, context, installmentId, 'rent.read');
  const [view] = await toViews(db, [row], today(options));

  // `toViews` n'écarte une ligne que si son logement ou sa personne a disparu,
  // ce que les clés étrangères en `restrict` rendent impossible.
  if (!view) throw new ResourceOutOfScopeError();

  return view;
}

export type RentCollection = {
  rents: RentListItem[];
  meta: { total: number; page: number; pageSize: number };
  /**
   * Somme des soldes des créances OUVERTES du résultat filtré (BR-039).
   *
   * Calculée côté serveur, et sur l'ensemble du filtre et non sur la page
   * affichée : un total qui ne compterait que les vingt lignes visibles
   * annoncerait une dette fausse. L'écran l'affiche tel quel.
   */
  totalOutstanding: number;
  /** Devise de ce total, ou `null` si le résultat n'a aucune créance ouverte. */
  currency: string | null;
};

/**
 * Liste les échéances lisibles (MVP-BACKLOG-039).
 *
 * Le périmètre est traduit en conditions SQL par le dépôt : aucune échéance
 * d'une autre organisation, ni d'un immeuble hors périmètre, ne quitte le serveur
 * (API section 67).
 *
 * Un appelant sans aucun périmètre lisible obtient « inexistant ». C'est le cas
 * d'un locataire : il consulte SES loyers par son espace, pas par cette liste,
 * parce que son rattachement est lui-même et non un immeuble (BR-021). C'est la
 * même frontière que pour les baux.
 */
export async function listRents(
  db: RentsDatabase,
  context: AccessContext,
  input: unknown = {},
  options: RentServiceOptions = {},
): Promise<RentCollection> {
  const query = parseOrThrow(listRentsQuerySchema, input);
  const scopes = readablePropertyScopes(context, 'rent.read');

  if (scopes.length === 0) throw new ResourceOutOfScopeError();

  const day = today(options);

  const rows = await listInstallmentRows(db, scopes as readonly RentScope[], {
    propertyId: query.propertyId ?? null,
    apartmentId: query.apartmentId ?? null,
    tenantUserId: query.tenantId ?? null,
    leaseId: query.leaseId ?? null,
    period: query.period ?? null,
    status: query.status,
    today: day,
  });

  const items = toListItems(await toViews(db, rows, day));
  const open = items.filter((item) => isOpen(item.status));
  const start = (query.page - 1) * query.pageSize;

  return {
    rents: items.slice(start, start + query.pageSize),
    meta: { total: items.length, page: query.page, pageSize: query.pageSize },
    totalOutstanding: open.reduce((sum, item) => sum + item.balance, 0),
    currency: open[0]?.currency ?? items[0]?.currency ?? null,
  };
}

/**
 * Échéances de la personne connectée, la plus urgente d'abord (BR-021).
 *
 * Son espace locataire montre SES loyers. Aucun périmètre d'immeuble
 * n'intervient : elle est son propre périmètre, et c'est pour cela qu'elle porte
 * `rent.read` sans porter aucun droit de gestion.
 */
export async function listMyRents(
  db: RentsDatabase,
  context: AccessContext,
  options: RentServiceOptions = {},
): Promise<RentListItem[]> {
  const day = today(options);
  const rows = await listInstallmentsForTenant(db, context.userId);

  return toListItems(await toViews(db, rows, day));
}

// --- Créances ouvertes d'une personne ------------------------------------------------

/**
 * Échéances de loyer OUVERTES d'une personne, pour le total dû (BR-039).
 *
 * Exposée au module Créances, qui agrège les deux types de créance en un seul
 * total depuis le Lot 10 (DEC-005, BR-055). Elle ne décide d'AUCUNE
 * autorisation : c'est l'agrégateur qui vérifie, créance par créance, que
 * l'appelant a le droit de la lire, parce que la même personne peut louer dans
 * deux immeubles dont un seul relève du gestionnaire qui pose la question.
 *
 * Le total dû et son libellé de créance vivaient ici au Lot 9, faute de seconde
 * créance : « loyers et charges confondus » étant la règle, ils ont rejoint
 * `modules/receivables`, et ce module ne fournit plus que SA moitié.
 */
export async function openRentReceivablesForTenant(
  db: RentsDatabase,
  tenantUserId: string,
  options: RentServiceOptions = {},
): Promise<RentView[]> {
  const rows = await listInstallmentsForTenant(db, tenantUserId, { openOnly: true });

  return toViews(db, rows, today(options));
}

// --- Génération ---------------------------------------------------------------------

export type RentGenerationResult = {
  /** Période traitée, premier jour du mois. */
  period: string;
  /** Baux actifs recouvrant la période, donc attendus. */
  expected: number;
  /** Échéances réellement créées par cet appel. */
  created: number;
  /** Échéances déjà présentes, donc non recréées : l'idempotence à l'œuvre. */
  skipped: number;
};

/**
 * Compose les échéances attendues d'une période, depuis les baux actifs.
 *
 * Pure, et c'est volontaire : le calcul qui décide d'une dette ne doit pas
 * dépendre d'une base pour être vérifié. La fonction applique les trois règles
 * de DEC-053 et rien d'autre, le filtre de recouvrement étant déjà appliqué par
 * la requête et revérifié ici, pour que les deux ne puissent pas diverger sans
 * qu'un test le voie.
 */
export function plannedInstallments(
  leases: readonly {
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
  }[],
  period: string,
): RentInstallmentInsert[] {
  return leases
    .filter((lease) => leaseCoversPeriod(lease, period))
    .map((lease) => ({
      organizationId: lease.organizationId,
      leaseId: lease.id,
      propertyId: lease.propertyId,
      apartmentId: lease.apartmentId,
      tenantUserId: lease.tenantUserId,
      periodStart: period,
      dueDate: dueDateFor(period, lease.dueDay),
      // Aucun prorata (DEC-053 règle 2) : le montant est celui du contrat.
      amountDue: lease.rentAmount,
      // Rien n'est encore payé, donc le solde vaut le montant dû (section 21).
      balance: lease.rentAmount,
      currency: lease.currency,
    }));
}

/**
 * Génère les échéances d'une période (MVP-BACKLOG-037, API section 18).
 *
 * Le cœur du lot, et il tient en cinq mouvements : lire les baux actifs qui
 * recouvrent la période, composer les échéances attendues, refuser un volume
 * aberrant, insérer en ignorant ce qui existe déjà, rendre compte.
 *
 * **Idempotente**, comme DEC-028 l'exige, et par la base : `UNIQUE (lease_id,
 * period_start)` avec `ON CONFLICT DO NOTHING`. Rejouer l'appel ne crée rien et
 * ne lève rien ; le compte d'ignorées le dit.
 *
 * **La période par défaut est le mois en cours** (DEC-053 règle 1). Une période
 * passée doit être demandée explicitement : c'est la seule façon de réclamer un
 * mois écoulé, et elle reste une décision humaine.
 *
 * `scopes` à `null` est réservé au job planifié, qui n'a pas d'appelant et
 * traite toutes les organisations. Le chemin public passe toujours par la
 * permission `rent.generate` et par le périmètre de l'appelant.
 */
async function generateForScopes(
  db: RentsDatabase,
  scopes: readonly RentScope[] | null,
  period: string,
): Promise<RentGenerationResult> {
  const billable = await listBillableLeases(db, scopes, {
    start: period,
    end: periodEndOf(period),
  });

  const planned = plannedInstallments(billable, period);

  if (planned.length > RENT_GENERATION_MAX_INSTALLMENTS) {
    throw new RentGenerationLimitError(planned.length, RENT_GENERATION_MAX_INSTALLMENTS);
  }

  const created = await insertMissingInstallments(db, planned);

  return {
    period,
    expected: planned.length,
    created: created.length,
    skipped: planned.length - created.length,
  };
}

/** Génération manuelle, dans le périmètre de l'appelant (API section 18). */
export async function generateRents(
  db: RentsDatabase,
  context: AccessContext,
  input: unknown = {},
  options: RentServiceOptions = {},
): Promise<RentGenerationResult> {
  const command = parseOrThrow(generateRentsSchema, input);
  const scopes = readablePropertyScopes(context, 'rent.generate');

  if (scopes.length === 0) throw new ResourceOutOfScopeError();

  /*
   * Un immeuble demandé est INTERSECTÉ avec le périmètre, jamais substitué : le
   * recevoir et s'en servir tel quel permettrait de générer chez un autre
   * bailleur. Un immeuble hors périmètre ne donne aucun périmètre, donc aucune
   * échéance, et ne se distingue pas d'un immeuble sans bail (ADR-008).
   */
  const narrowed: RentScope[] = command.propertyId
    ? (scopes as readonly RentScope[])
        .filter(
          (scope) =>
            scope.propertyIds === 'all' || scope.propertyIds.includes(command.propertyId as string),
        )
        .map((scope) => ({
          organizationId: scope.organizationId,
          propertyIds: [command.propertyId as string],
        }))
    : (scopes as RentScope[]);

  return generateForScopes(db, narrowed, command.period ?? periodOf(today(options)));
}

/**
 * Génération par le job planifié (API section 19, job
 * `generateRentInstallments`).
 *
 * Sans appelant et sans périmètre : la plateforme la déclenche, et elle traite
 * TOUTES les organisations. C'est la raison pour laquelle la route qui l'appelle
 * ne doit pas être publique (DEC-028), et le secret interne est vérifié par la
 * route, pas ici.
 *
 * La période est celle du mois en cours, sans aucun rattrapage : c'est la règle 1
 * de DEC-053, et elle n'est pas surchargeable depuis la plateforme, qui ne doit
 * pas pouvoir créer de dette rétroactive par une erreur de paramètre.
 */
export async function runRentGenerationJob(
  db: RentsDatabase,
  options: RentServiceOptions = {},
): Promise<RentGenerationResult> {
  return generateForScopes(db, null, periodOf(today(options)));
}

export type OverdueJobResult = {
  /** Date civile du jour retenue pour la comparaison. */
  today: string;
  /** Échéances passées en `OVERDUE` par cet appel. */
  marked: number;
};

/**
 * Bascule les créances échues en `OVERDUE` (BR-037, job
 * `markOverdueReceivables`).
 *
 * Le passage est le fait d'un JOB et jamais d'une lecture, la règle le dit
 * explicitement : sans cela, deux écrans ouverts à une minute d'intervalle
 * écriraient deux fois, et un rapport nocturne ne verrait jamais le retard.
 *
 * Idempotent : la seconde exécution ne trouve plus rien, `OVERDUE` n'étant pas
 * un statut visé.
 */
export async function runOverdueJob(
  db: RentsDatabase,
  options: RentServiceOptions = {},
): Promise<OverdueJobResult> {
  const day = today(options);
  const marked = await markOverdueInstallments(db, day);

  return { today: day, marked: marked.length };
}
