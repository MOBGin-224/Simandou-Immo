import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, collectionResponse } from '@/lib/http/responses';
import { listManagers } from '@/modules/managers';

/**
 * Liste des gestionnaires (MVP-FEAT-019, API section 13, DEC-041).
 *
 * ```text
 * GET /api/v1/managers
 * ```
 *
 * Réunit les gestionnaires, de tout statut, et les invitations en attente ou
 * expirées. Chaque élément porte un type : `ACCESS` ou `INVITATION`.
 *
 * Réservée au propriétaire (`manager.read`) : un gestionnaire ou un locataire
 * reçoit 404, comme pour toute ressource de niveau organisation.
 */
export async function GET(): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const collection = await listManagers(getDb(), context);

    return collectionResponse(collection.managers, collection.meta);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
