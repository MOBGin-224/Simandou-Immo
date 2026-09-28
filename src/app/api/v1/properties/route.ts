import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import {
  apiErrorResponse,
  collectionResponse,
  dataResponse,
  readJsonBody,
} from '@/lib/http/responses';
import { createProperty, listProperties } from '@/modules/properties';

/**
 * Collection des immeubles (MVP-BACKLOG-017, API section 11).
 *
 * ```text
 * GET  /api/v1/properties    liste, bornée au périmètre de l'utilisateur
 * POST /api/v1/properties    création, propriétaire seul (DEC-025)
 * ```
 *
 * Ces routes ne portent AUCUNE règle : elles lisent la requête, appellent le cas
 * d'usage et traduisent le résultat. L'autorisation, la validation et les règles
 * métier vivent dans le module, de sorte qu'une Server Action emprunte exactement
 * le même chemin (API-001).
 */

/**
 * Paramètre de requête, absent plutôt que nul.
 *
 * `searchParams.get` renvoie `null` pour un paramètre manquant, ce que les
 * valeurs par défaut des schémas ne reconnaissent pas : `page` absente doit valoir
 * 1, pas échouer.
 */
function param(url: URL, name: string): string | undefined {
  return url.searchParams.get(name) ?? undefined;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const url = new URL(request.url);

    const collection = await listProperties(getDb(), context, {
      page: param(url, 'page'),
      pageSize: param(url, 'pageSize'),
      search: param(url, 'search'),
      filter: param(url, 'filter'),
      organizationId: param(url, 'organizationId'),
    });

    return collectionResponse(collection.properties, collection.meta);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const property = await createProperty(getDb(), context, await readJsonBody(request));

    return dataResponse(property, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
