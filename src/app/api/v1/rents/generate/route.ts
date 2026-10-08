import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, dataResponse, readOptionalJsonBody } from '@/lib/http/responses';
import { generateRents } from '@/modules/rents';

/**
 * Génération manuelle des échéances (API section 18, MVP-BACKLOG-037).
 *
 * ```text
 * POST /api/v1/rents/generate    { period?: "AAAA-MM", propertyId?: uuid }
 * ```
 *
 * **Idempotente, la section l'exige** : « si l'échéance existe déjà, elle ne doit
 * pas être recréée ». La garantie n'est pas tenue par une lecture préalable mais
 * par `UNIQUE (lease_id, period_start)`, seul arbitre fiable si deux appels se
 * croisent. Rejouer l'appel renvoie donc 200 avec zéro créée, et non une erreur :
 * le travail est fait, et c'est l'état demandé qui compte.
 *
 * **200 et non 201**, bien que des lignes puissent naître : la réponse est un
 * COMPTE RENDU de synchronisation, pas une ressource créée, et un appel sans
 * effet en reçoit un identique. Aucun `Location` n'aurait de sens, l'appel
 * pouvant produire cent échéances.
 *
 * Les deux champs sont facultatifs. Sans période, c'est le mois en cours, le seul
 * que le job traite de lui-même (DEC-053). Sans immeuble, c'est tout le périmètre
 * de l'appelant, et un immeuble demandé est INTERSECTÉ avec ce périmètre, jamais
 * substitué.
 *
 * C'est ici, et seulement ici, qu'une période PASSÉE peut être réclamée :
 * rattraper un mois écoulé est une décision humaine, prise mois par mois, et le
 * job planifié ne remonte jamais dans le temps de lui-même.
 *
 * Permission `rent.generate`, propriétaire et gestionnaire. Un locataire ne la
 * porte pas : il ne fait pas naître sa propre dette.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const result = await generateRents(getDb(), context, await readOptionalJsonBody(request));

    return dataResponse(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
