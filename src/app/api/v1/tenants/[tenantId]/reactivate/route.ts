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
 * `:tenantId` est un `users.id`, celui de la PERSONNE (DEC-051). L'opération
 * agit sur son DROIT D'ACCÈS dans l'organisation, jamais sur son identité : une
 * personne locataire sans accès n'a donc rien à suspendre ni à révoquer, et
 * reçoit 409. L'organisation est déduite quand une seule la connaît, et doit
 * être désignée par `organizationId` sinon.
 *
 * Permission `tenant.update`, propriétaire comme gestionnaire, chacun sur son
 * périmètre (DEC-047). Un accès déjà actif, ou révoqué, répond 409.
 */
export async function POST(
  request: Request,
  context: RouteContext<'/api/v1/tenants/[tenantId]/reactivate'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { tenantId } = await context.params;
    const organizationId = new URL(request.url).searchParams.get('organizationId') ?? undefined;

    return dataResponse(
      await reactivateTenant(getDb(), accessContext, tenantId, { organizationId }),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
