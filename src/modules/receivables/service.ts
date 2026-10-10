import { z } from 'zod';

import type * as schema from '@/db/schema';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import {
  ResourceOutOfScopeError,
  readablePropertyScopes,
  requirePermission,
  type AccessContext,
} from '@/lib/authorization';
import { formatMonth } from '@/lib/ui/format';
import {
  describeCharge,
  openChargeReceivablesForTenant,
  runChargeOverdueJob,
  type ChargeAllocationView,
} from '@/modules/charges';
import {
  describePeriod,
  openRentReceivablesForTenant,
  runOverdueJob,
  type RentView,
} from '@/modules/rents';

import {
  compareOutstanding,
  today,
  type ClockOptions,
  type OutstandingReceivable,
  type OutstandingSummary,
} from './domain';

/**
 * Cas d'usage communs aux DEUX créances du MVP (DEC-005, DEC-022, BR-039,
 * BR-055).
 *
 * **Pourquoi ce module, et pas le module Loyers.** Le total dû d'une personne est
 * la somme des soldes de ses créances ouvertes, « loyers et charges confondus »
 * (BR-039), et le produit lui présente un montant GLOBAL tout en conservant les
 * composantes séparées (BR-055, BR-056). La question ne relève donc d'aucun des
 * deux modules : le Lot 9 l'avait écrite dans Loyers faute de second type de
 * créance, et le Lot 10 la déplace ici plutôt que de faire dépendre les loyers
 * des charges.
 *
 * Le job de retard suit le même raisonnement : `markOverdueReceivables` est UN
 * job qui traite les deux tables (API section 19), parce que le retard se
 * constate de la même façon sur les deux (DEC-015).
 *
 * Ce module ne lit aucune table lui-même. Il appelle les surfaces publiques des
 * modules Loyers et Charges, qui gardent chacun la connaissance de ses données :
 * ce qui est commun ici est la RÈGLE, pas l'accès.
 */

/** Instance Drizzle, quel que soit son pilote : postgres.js ou PGlite. */
export type ReceivablesDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Réglages d'un appel : instant courant, pour la testabilité des dates. */
export type ReceivableServiceOptions = ClockOptions;

/**
 * Créance, sa provenance et ce qui autorise sa lecture.
 *
 * L'autorisation est portée par CHAQUE créance, donc chacune doit dire de quel
 * immeuble elle vient : c'est la seule information que l'agrégateur ajoute aux
 * vues des deux modules.
 */
type Candidate = {
  organizationId: string;
  propertyId: string;
  ownerUserId: string | null;
  permission: 'rent.read' | 'charge.read';
  currency: string;
  createdAt: string;
  receivable: OutstandingReceivable;
};

function fromRent(view: RentView): Candidate {
  return {
    organizationId: view.organizationId,
    propertyId: view.apartment.propertyId,
    ownerUserId: view.tenant.userId,
    permission: 'rent.read',
    currency: view.currency,
    createdAt: view.createdAt,
    receivable: {
      kind: 'RENT',
      id: view.id,
      /*
       * Libellé composé par le SERVEUR, « Loyer septembre 2026 » (API section
       * 18). C'est l'exception assumée à la règle qui laisse le formatage au
       * frontend : ce champ est repris tel quel dans un rappel comme dans une
       * quittance, où il doit être identique à celui de l'écran.
       */
      label: describePeriod(view.periodStart, formatMonth),
      periodStart: view.periodStart,
      dueDate: view.dueDate,
      amountDue: view.amountDue,
      amountPaid: view.amountPaid,
      balance: view.balance,
      status: view.status,
    },
  };
}

function fromCharge(view: ChargeAllocationView): Candidate {
  return {
    organizationId: view.organizationId,
    propertyId: view.apartment.propertyId,
    ownerUserId: view.tenant?.userId ?? null,
    permission: 'charge.read',
    currency: view.currency,
    createdAt: view.createdAt,
    receivable: {
      kind: 'CHARGE',
      id: view.id,
      /* « Eau septembre 2026 », tel que la section 18 l'écrit. */
      label: describeCharge({ type: view.charge.type, periodStart: view.periodStart }, formatMonth),
      periodStart: view.periodStart,
      dueDate: view.dueDate,
      amountDue: view.amountDue,
      amountPaid: view.amountPaid,
      balance: view.balance,
      status: view.status,
    },
  };
}

/**
 * Total dû d'une personne, loyers et charges confondus (API section 18, BR-039,
 * BR-055).
 *
 * Quatre choix tenus ici.
 *
 * Le total est la somme des soldes des créances OUVERTES, et d'elles seules :
 * une créance payée ne doit plus rien, une créance annulée n'a jamais rien dû.
 *
 * Il est calculé par le SERVEUR, la section le dit : « le frontend ne le
 * recompose jamais ». Un total recomposé par l'écran divergerait dès qu'une
 * créance serait paginée ou filtrée, et c'est le montant qu'une personne lit
 * avant de payer.
 *
 * Il agrège les DEUX types de créance, depuis le Lot 10 : c'est l'exemple même
 * de DEC-005, « loyer 2 500 000 plus charge eau 300 000 égale 2 800 000 dû ».
 *
 * Et les créances sont rendues dans l'ORDRE D'ALLOCATION de DEC-022, échéance
 * croissante puis loyer avant charge : c'est l'ordre dans lequel un paiement
 * global les soldera au Lot 11, donc le seul ordre d'affichage qui ne mentira
 * pas sur ce qu'un versement règle.
 */
export async function getTenantOutstanding(
  db: ReceivablesDatabase,
  context: AccessContext,
  tenantUserId: string,
  options: ReceivableServiceOptions = {},
): Promise<OutstandingSummary> {
  // Même garde que sur la fiche locataire : un identifiant mal formé est
  // « inexistant » et non une erreur interne.
  if (!z.uuid().safeParse(tenantUserId).success) throw new ResourceOutOfScopeError();

  const [rents, charges] = await Promise.all([
    openRentReceivablesForTenant(db, tenantUserId, options),
    openChargeReceivablesForTenant(db, tenantUserId, options),
  ]);

  const candidates = [...rents.map(fromRent), ...charges.map(fromCharge)];

  /*
   * Autorisation portée par CHAQUE créance, et non par la personne.
   *
   * C'est la seule façon de répondre juste à une question qui n'a pas de réponse
   * globale : un gestionnaire peut être habilité sur l'immeuble d'une créance et
   * pas sur celui d'une autre, la même personne pouvant louer dans deux
   * immeubles. Écarter silencieusement ce qu'il ne peut pas lire donnerait un
   * total faux ; refuser l'ensemble lui cacherait ce qu'il a le droit de voir.
   * On lève donc dès la première créance hors périmètre.
   *
   * La permission dépend du TYPE de créance, les deux étant distinctes au
   * catalogue : `rent.read` et `charge.read`. Les trois rôles portent les deux,
   * mais rien ne garantit que ce sera toujours le cas, et un total dû ne doit pas
   * s'autoriser d'une permission qui ne le couvre pas.
   */
  for (const candidate of candidates) {
    requirePermission(context, candidate.permission, {
      organizationId: candidate.organizationId,
      propertyId: candidate.propertyId,
      ownerUserId: candidate.ownerUserId ?? undefined,
    });
  }

  /*
   * Aucune créance ouverte, et la personne n'est donc pas nommée par une
   * créance : il reste à vérifier que l'appelant pouvait poser la question. Sans
   * cela, « total dû : zéro » confirmerait l'existence d'une personne à qui
   * l'appelant n'a pas accès (ADR-008). Son propre total lui est toujours
   * ouvert.
   */
  if (candidates.length === 0 && tenantUserId !== context.userId) {
    const readable = [
      ...readablePropertyScopes(context, 'rent.read'),
      ...readablePropertyScopes(context, 'charge.read'),
    ];

    if (readable.length === 0) throw new ResourceOutOfScopeError();
  }

  const ordered = candidates.sort((a, b) =>
    compareOutstanding(
      { dueDate: a.receivable.dueDate, kind: a.receivable.kind, createdAt: a.createdAt },
      { dueDate: b.receivable.dueDate, kind: b.receivable.kind, createdAt: b.createdAt },
    ),
  );

  return {
    /*
     * Une seule devise au MVP, le franc guinéen (DEC-014) : additionner des
     * soldes est donc licite. La devise transmise est celle des créances, et
     * `GNF` par défaut quand il n'y en a aucune, plutôt que `null` : la section
     * 18 donne une devise dans tous les cas, et un écran qui afficherait « 0 »
     * sans unité se lirait mal.
     */
    currency: ordered[0]?.currency ?? 'GNF',
    totalOutstanding: ordered.reduce((sum, entry) => sum + entry.receivable.balance, 0),
    receivables: ordered.map((entry) => entry.receivable),
  };
}

/** Total dû de la personne connectée (`GET /api/v1/me/outstanding`). */
export async function getMyOutstanding(
  db: ReceivablesDatabase,
  context: AccessContext,
  options: ReceivableServiceOptions = {},
): Promise<OutstandingSummary> {
  return getTenantOutstanding(db, context, context.userId, options);
}

export type OverdueReceivablesResult = {
  /** Date civile du jour retenue pour la comparaison. */
  today: string;
  /** Échéances de loyer passées en `OVERDUE`. */
  rents: number;
  /** Créances de charge passées en `OVERDUE`. */
  charges: number;
  /** Total des deux, ce que le job journalise. */
  marked: number;
};

/**
 * Bascule toutes les créances échues en `OVERDUE` (BR-037, job
 * `markOverdueReceivables`).
 *
 * UN seul job pour les deux types, comme son nom l'indique dans la section 19 :
 * les créances de loyer et de charge partagent le cycle de statut (DEC-015),
 * donc le retard se constate de la même façon, et deux jobs distincts
 * finiraient par appliquer deux règles.
 *
 * Le passage est le fait d'un JOB et jamais d'une lecture, la règle le dit
 * explicitement : sans cela, deux écrans ouverts à une minute d'intervalle
 * écriraient deux fois, et un rapport nocturne ne verrait jamais le retard.
 *
 * Les deux moitiés sont comptées séparément dans le résultat, et le journal les
 * affiche : un retard qui n'apparaîtrait que sur un seul des deux types signale
 * un défaut, et un total unique l'aurait caché.
 */
export async function runOverdueReceivablesJob(
  db: ReceivablesDatabase,
  options: ReceivableServiceOptions = {},
): Promise<OverdueReceivablesResult> {
  const day = today(options);

  const rents = await runOverdueJob(db, options);
  const charges = await runChargeOverdueJob(db, options);

  return {
    today: day,
    rents: rents.marked,
    charges: charges.marked,
    marked: rents.marked + charges.marked,
  };
}
