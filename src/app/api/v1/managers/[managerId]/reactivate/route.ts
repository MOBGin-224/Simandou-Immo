import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { reactivateManager } from '@/modules/managers';

/**
 * Réactivation d'un gestionnaire suspendu (DEC-044, MVP-FEAT-021).
 *
 * ```text
 * POST /api/v1/managers/:managerId/reactivate
 * ```
 *
 * Seul un accès SUSPENDU se réactive : un accès révoqué ne se réactive jamais, il
 * revient par la réinvitation (DEC-043). Permission `manager.update`.
 */
export async function POST(
  _request: Request,
  context: RouteContext<'/api/v1/managers/[managerId]/reactivate'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { managerId } = await context.params;

    return dataResponse(await reactivateManager(getDb(), accessContext, managerId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
