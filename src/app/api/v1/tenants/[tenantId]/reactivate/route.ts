import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { reactivateTenant } from '@/modules/tenants';

/**
 * Réactivation de l'accès d'un locataire suspendu (DEC-047, API section 15).
 *
 * ```text
 * POST /api/v1/tenants/:tenantId/reactivate
 * ```
 *
 * Seul un accès SUSPENDU se réactive. Un accès révoqué ne se réactive jamais :
 * c'est la réinvitation qui le fait revenir (DEC-043).
 *
 * Permission `tenant.update`, propriétaire comme gestionnaire, chacun sur son
 * périmètre (DEC-047). Un accès déjà actif, ou révoqué, répond 409.
 */
export async function POST(
  _request: Request,
  context: RouteContext<'/api/v1/tenants/[tenantId]/reactivate'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { tenantId } = await context.params;

    return dataResponse(await reactivateTenant(getDb(), accessContext, tenantId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
