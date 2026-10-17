import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse, readJsonBody } from '@/lib/http/responses';
import { addComment, getIncident, listComments, parseAddComment } from '@/modules/incidents';

/**
 * Commentaires partagés d'un incident (Lot 13, DEC-059 sections 2.3 et 4.6).
 *
 * ```text
 * GET  /api/v1/incidents/:id/comments    liste, triée du plus ancien au plus récent
 * POST /api/v1/incidents/:id/comments    ajout, par tout utilisateur voyant l'incident
 * ```
 *
 * Pas de pagination (DEC-059, section 2.3) : `dataResponse` porte le tableau
 * complet, sans `meta` de collection.
 *
 * `listComments` du dépôt rend un tableau vide pour un incident hors
 * périmètre, sans lever d'erreur (comportement voulu pour l'historique et les
 * commentaires appelés depuis le SERVICE). La route doit cependant refuser un
 * accès hors périmètre par 404, comme le reste de l'API (DEC-059, section
 * 9.3) : `getIncident`, déjà exporté et inchangé, porte cette vérification
 * avant la lecture des commentaires.
 */
export async function GET(
  _request: Request,
  routeContext: RouteContext<'/api/v1/incidents/[id]/comments'>,
): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const { id } = await routeContext.params;

    await getIncident(getDb(), id, context);

    return dataResponse(await listComments(getDb(), id, context));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  routeContext: RouteContext<'/api/v1/incidents/[id]/comments'>,
): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const { id } = await routeContext.params;
    const { content } = parseAddComment(await readJsonBody(request));

    const comment = await addComment(getDb(), id, content, context);

    return dataResponse(comment, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
