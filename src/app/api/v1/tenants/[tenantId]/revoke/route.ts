import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { revokeTenant } from '@/modules/tenants';

/**
 * Révocation de l'accès d'un locataire au produit (DEC-047, API section 15).
 *
 * ```text
 * POST /api/v1/tenants/:tenantId/revoke
 * ```
 *
 * **Révoquer l'accès au produit ne termine AUCUN bail.** Les deux concepts
 * restent distincts : c'est la fin du bail, au Lot 8, qui portera le retrait de
 * l'accès au logement. Ici, la personne cesse seulement d'utiliser
 * l'application, et reste le locataire du logement.
 *
 * Permission `tenant.revoke`, ajoutée au catalogue par DEC-047. Le propriétaire
 * ET le gestionnaire la portent, chacun sur son périmètre. Un locataire ne la
 * porte pas, pas même pour lui-même.
 *
 * L'historique est conservé : rien n'est supprimé, ni la personne, ni sa ligne
 * d'accès. Possible depuis un accès actif comme suspendu ; un accès déjà révoqué
 * répond 409.
 */
export async function POST(
  _request: Request,
  context: RouteContext<'/api/v1/tenants/[tenantId]/revoke'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { tenantId } = await context.params;

    return dataResponse(await revokeTenant(getDb(), accessContext, tenantId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
