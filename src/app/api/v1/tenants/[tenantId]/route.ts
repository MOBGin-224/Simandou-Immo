import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse, readJsonBody } from '@/lib/http/responses';
import { getTenant, updateTenant } from '@/modules/tenants';

/**
 * Locataire unique (API section 15, DEC-046, DEC-048, DEC-051).
 *
 * ```text
 * GET   /api/v1/tenants/:tenantId    consultation
 * PATCH /api/v1/tenants/:tenantId    modification du NOM, et de rien d'autre
 * ```
 *
 * `:tenantId` est un **`users.id`**, celui de la PERSONNE (DEC-051) : le
 * locataire est une identité métier, pas un droit d'accès, et une personne peut
 * être locataire sans avoir aucun compte.
 *
 * La ressource est le couple personne et organisation. Lorsqu'une seule
 * organisation du périmètre de l'appelant connaît cette personne, elle est
 * déduite ; lorsque plusieurs la connaissent, `organizationId` doit la désigner,
 * sans quoi la requête répond 409 : le produit ne devine pas.
 *
 * Une invitation en attente garde son identifiant propre, sous
 * `/tenant-invitations` : c'est là qu'on la renvoie ou qu'on la révoque.
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
  request: Request,
  context: RouteContext<'/api/v1/tenants/[tenantId]'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { tenantId } = await context.params;
    const organizationId = new URL(request.url).searchParams.get('organizationId') ?? undefined;

    return dataResponse(await getTenant(getDb(), accessContext, tenantId, { organizationId }));
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
    const organizationId = organizationFrom(body);

    return dataResponse(
      await updateTenant(getDb(), accessContext, tenantId, body, { organizationId }),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/**
 * Organisation désignée par le corps de la requête, le cas échéant.
 *
 * La ressource locataire est le couple personne et organisation (DEC-051) : une
 * requête qui agit doit pouvoir dire laquelle, et une organisation absente est
 * simplement déduite quand elle ne peut pas être ambiguë.
 */
function organizationFrom(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;

  const value = (body as { organizationId?: unknown }).organizationId;

  return typeof value === 'string' ? value : undefined;
}
