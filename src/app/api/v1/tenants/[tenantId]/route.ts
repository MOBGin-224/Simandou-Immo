import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse, readJsonBody } from '@/lib/http/responses';
import { getTenant, updateTenant } from '@/modules/tenants';

/**
 * Locataire unique (API section 15, DEC-046 et DEC-048).
 *
 * ```text
 * GET   /api/v1/tenants/:tenantId    consultation
 * PATCH /api/v1/tenants/:tenantId    modification du NOM, et de rien d'autre
 * ```
 *
 * `:tenantId` est un `user_access.id`, celui d'un ACCÈS de locataire. Une
 * invitation en attente n'a pas d'accès : elle a son identifiant propre, sous
 * `/tenant-invitations` (DEC-041, DEC-046).
 *
 * Le `PATCH` ne touche que le nom, et seul le locataire peut modifier le sien
 * (DEC-048) : le téléphone et l'email exigeraient une vérification qu'aucun canal
 * ne permet au MVP (SEC-049, SEC-050), et le nom vit dans `users`, donc il
 * appartient à la personne. Un propriétaire qui essaie reçoit 403 ; pour corriger
 * une saisie, il révoque puis réinvite.
 *
 * Aucun DELETE : la suppression physique n'est pas une opération du produit
 * (API section 65). Retirer l'accès se fait par `/revoke`, et cela ne termine
 * aucun bail (DEC-047).
 *
 * Un identifiant inconnu, mal formé, hors périmètre, ou qui désigne un accès de
 * propriétaire ou de gestionnaire, répond la MÊME réponse 404 (ADR-007).
 */
export async function GET(
  _request: Request,
  context: RouteContext<'/api/v1/tenants/[tenantId]'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { tenantId } = await context.params;

    return dataResponse(await getTenant(getDb(), accessContext, tenantId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<'/api/v1/tenants/[tenantId]'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { tenantId } = await context.params;
    const body = await readJsonBody(request);

    return dataResponse(await updateTenant(getDb(), accessContext, tenantId, body));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
