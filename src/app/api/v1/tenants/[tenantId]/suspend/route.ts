import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { suspendTenant } from '@/modules/tenants';

/**
 * Suspension de l'accès d'un locataire (DEC-047, API section 15).
 *
 * ```text
 * POST /api/v1/tenants/:tenantId/suspend
 * ```
 *
 * Bloque l'accès au produit à la requête suivante. **Ne termine aucun bail** et
 * ne retire aucun logement : la personne reste le locataire du logement, elle
 * cesse seulement d'utiliser l'application.
 *
 * `:tenantId` est un `users.id`, celui de la PERSONNE (DEC-051). L'opération
 * agit sur son DROIT D'ACCÈS dans l'organisation, jamais sur son identité : une
 * personne locataire sans accès n'a donc rien à suspendre ni à révoquer, et
 * reçoit 409. L'organisation est déduite quand une seule la connaît, et doit
 * être désignée par `organizationId` sinon.
 *
 * Permission `tenant.update`. Le propriétaire ET le gestionnaire la portent,
 * chacun sur son périmètre : c'est une différence assumée avec le gestionnaire,
 * que seul le propriétaire suspend (DEC-025, DEC-047).
 *
 * Un accès déjà suspendu, ou révoqué, répond 409 : un succès sur une suspension
 * sans effet tromperait l'appelant sur l'état réel de l'accès.
 */
export async function POST(
  request: Request,
  context: RouteContext<'/api/v1/tenants/[tenantId]/suspend'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { tenantId } = await context.params;
    const organizationId = new URL(request.url).searchParams.get('organizationId') ?? undefined;

    return dataResponse(await suspendTenant(getDb(), accessContext, tenantId, { organizationId }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
