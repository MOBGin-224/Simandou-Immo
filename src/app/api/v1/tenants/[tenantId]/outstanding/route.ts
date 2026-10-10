import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { getTenantOutstanding } from '@/modules/receivables';

/**
 * Total dû d'un locataire (API section 18).
 *
 * ```text
 * GET /api/v1/tenants/:tenantId/outstanding
 * ```
 *
 * `:tenantId` est un **`users.id`**, celui de la PERSONNE, comme sur la fiche
 * locataire : le locataire est une identité métier et non un droit d'accès
 * (DEC-051), donc une personne sans compte a elle aussi un total dû, ce qui est
 * précisément le cas du locataire qui n'utilisera jamais l'application.
 *
 * L'autorisation est portée par CHAQUE créance et non par la personne, et c'est
 * la seule réponse juste à une question qui n'en a pas de globale : la même
 * personne peut louer dans deux immeubles, dont un seul relève du gestionnaire
 * qui demande. Écarter en silence ce qu'il ne peut pas lire donnerait un total
 * faux, sur lequel il réclamerait de l'argent ; l'appel échoue donc en 404.
 *
 * Une personne sans aucune créance ouverte répond un total de zéro, mais
 * seulement à qui pouvait poser la question : sinon « zéro » confirmerait
 * l'existence d'une personne hors périmètre (ADR-008).
 *
 * Un locataire peut appeler sa propre adresse, mais `/api/v1/me/outstanding` est
 * la route faite pour lui : il n'a pas à connaître son identifiant.
 *
 * Depuis le Lot 10, le total agrège les DEUX créances du MVP (DEC-005) : chaque
 * élément porte son `kind`, `RENT` ou `CHARGE`, et l'ordre est celui dans lequel
 * un paiement global les soldera (DEC-022). La forme de la réponse n'a pas
 * changé, seules les données s'y sont ajoutées.
 */
export async function GET(
  _request: Request,
  context: RouteContext<'/api/v1/tenants/[tenantId]/outstanding'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { tenantId } = await context.params;

    return dataResponse(await getTenantOutstanding(getDb(), accessContext, tenantId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
