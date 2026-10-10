import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, collectionResponse } from '@/lib/http/responses';
import { listMyCharges } from '@/modules/charges';

/**
 * Parts de charge de la personne connectée (API section 31, BR-021).
 *
 * ```text
 * GET /api/v1/me/charges
 * ```
 *
 * « Le locataire ne demande jamais la totalité de la charge. » La section le dit,
 * et cette route en est la conséquence : le backend filtre SES créances, sans
 * qu'il ait d'identifiant à fournir, son périmètre étant lui-même et non un
 * immeuble. La facture de l'immeuble, son montant global et la part des autres
 * logements ne lui sont jamais transmis.
 *
 * Chaque élément porte son `explanation`, et c'est une exigence explicite de la
 * section : « permet au locataire de comprendre comment sa part a été calculée,
 * conformément à l'exigence de transparence ». La justification est celle qui a
 * été figée à la publication, donc elle reste vraie même si l'immeuble a changé
 * de nombre de logements depuis.
 *
 * Elle répond aussi à un propriétaire ou à un gestionnaire, qui obtient alors sa
 * propre liste, normalement vide : mieux vaut une liste vide qu'un refus sur une
 * route qui parle de soi.
 */
export async function GET(): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const allocations = await listMyCharges(getDb(), context);

    /*
     * La forme documentée par la section 31, et elle est plus ÉTROITE que la vue
     * interne : ni immeuble, ni logement, ni personne, ni montant total de la
     * facture. Ce qu'un locataire reçoit est sa part, son solde, son statut et
     * l'explication du calcul, et rien de ce qui concerne les autres.
     */
    return collectionResponse(
      allocations.map((allocation) => ({
        id: allocation.id,
        type: allocation.charge.type,
        periodStart: allocation.periodStart,
        dueDate: allocation.dueDate,
        amountDue: allocation.amountDue,
        amountPaid: allocation.amountPaid,
        balance: allocation.balance,
        currency: allocation.currency,
        status: allocation.status,
        displayStatus: allocation.displayStatus,
        explanation: {
          method: allocation.explanation.method,
          totalAmount: allocation.explanation.totalAmount,
          unitCount: allocation.explanation.unitCount,
        },
      })),
      { total: allocations.length },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
