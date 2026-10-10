import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { previewCharge } from '@/modules/charges';

/**
 * Aperçu d'une répartition (API section 28, MVP-BACKLOG-053).
 *
 * ```text
 * POST /api/v1/charges/:chargeId/preview
 * ```
 *
 * « Cette opération ne publie rien. » Elle n'écrit RIEN du tout : ni créance, ni
 * statut, ni date. C'est l'étape 6 du parcours 18, celle où le gestionnaire
 * vérifie avant d'engager : le système calcule 300 000 GNF pour chacun des douze
 * appartements, et il le lit avant de publier.
 *
 * **POST et non GET, bien que rien ne soit écrit**, parce que la section le
 * documente ainsi. Le choix se défend : l'aperçu dépend de l'état du parc à
 * l'instant de l'appel, donc il n'est pas cacheable, et un `GET` préchargé par
 * un navigateur afficherait une répartition périmée au moment de publier.
 *
 * La réponse donne les quatre informations que la section demande, le total, le
 * nombre de logements, la part de chacun et l'écart d'arrondi, plus une
 * cinquième dont le produit a besoin : quels logements sont VACANTS, et
 * porteront donc une part sans locataire redevable (BR-052). Sans elle, la part
 * d'un logement vide semblerait perdue.
 *
 * Permission `charge.read` : l'opération ne modifie rien, et interdire de
 * regarder une répartition à qui peut lire la charge n'aurait pas de sens. La
 * publication est gardée séparément, par `charge.publish`.
 */
export async function POST(
  _request: Request,
  context: RouteContext<'/api/v1/charges/[chargeId]/preview'>,
): Promise<Response> {
  try {
    const accessContext = await requireAccessContext();
    const { chargeId } = await context.params;

    return dataResponse(await previewCharge(getDb(), accessContext, chargeId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
