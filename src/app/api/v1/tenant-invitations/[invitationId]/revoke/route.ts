import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { revokeTenantInvitation } from '@/modules/tenants';

/**
 * Révocation d'une invitation de locataire (SEC-INV-005, API section 16).
 *
 * ```text
 * POST /api/v1/tenant-invitations/:invitationId/revoke
 * ```
 *
 * Le lien devient inutilisable aussitôt, et aucun compte n'est supprimé. C'est
 * aussi le moyen prévu de corriger un numéro ou un email mal saisi (DEC-048) :
 * révoquer, puis réinviter.
 *
 * Une invitation déjà acceptée ne se révoque pas : c'est alors l'ACCÈS du
 * locataire qu'il faut révoquer, sous `/tenants/:id/revoke`, ce qui est une autre
 * opération. Et ni l'une ni l'autre ne termine un bail (DEC-047).
 *
 * Permission `tenant.invite`. Une invitation acceptée ou déjà révoquée répond 409.
 */
export async function POST(
  _request: Request,
  context: RouteContext<'/api/v1/tenant-invitations/[invitationId]/revoke'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { invitationId } = await context.params;

    return dataResponse(await revokeTenantInvitation(getDb(), accessContext, invitationId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
