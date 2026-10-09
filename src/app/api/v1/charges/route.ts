import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import {
  apiErrorResponse,
  collectionResponse,
  dataResponse,
  readJsonBody,
} from '@/lib/http/responses';
import { createCharge, listCharges } from '@/modules/charges';

/**
 * Charges communes (API sections 27 et 30, MVP-BACKLOG-051 et 054).
 *
 * ```text
 * GET  /api/v1/charges    liste du périmètre, filtrable
 * POST /api/v1/charges    enregistre une charge, en BROUILLON
 * ```
 *
 * **Une charge créée ne doit rien à personne**, et c'est le point que la section
 * 27 insiste à écrire : « elle ne crée aucune créance et n'est visible d'aucun
 * locataire tant qu'elle n'est pas publiée ». La création et la publication sont
 * donc deux appels distincts, et c'est ce qui rend l'aperçu possible : le
 * gestionnaire vérifie la répartition avant qu'elle n'engage quiconque (parcours
 * 18).
 *
 * **Aucun PATCH, aucun DELETE, ici comme sur la fiche.** Une charge fausse
 * s'annule et se recrée : BR-053 interdit la correction silencieuse, et l'API
 * des sections 27 à 30 ne définit aucune route de mise à jour. L'historique
 * garde alors les deux versions, ce qu'une réécriture ferait disparaître.
 *
 * Les quatre filtres de la section 30 sont servis. `period` s'écrit `AAAA-MM`,
 * un mois, comme pour les loyers : c'est ainsi qu'une personne désigne la
 * facture d'eau de septembre.
 *
 * `meta` porte le reste à encaisser sur le résultat filtré, calculé côté
 * serveur sur l'ENSEMBLE du filtre et non sur la page : une somme des lignes
 * visibles annoncerait une dette fausse dès la deuxième page.
 *
 * Permissions `charge.read` et `charge.create`, propriétaire comme
 * gestionnaire, chacun sur son périmètre. Un locataire porte `charge.read`, mais
 * pour SES créances : la liste des charges de l'immeuble lui répond 404, son
 * rattachement étant lui-même et non un immeuble (BR-021). Il consulte sa part
 * par `/api/v1/me/charges`.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const url = new URL(request.url);

    const collection = await listCharges(getDb(), context, {
      page: url.searchParams.get('page') ?? undefined,
      pageSize: url.searchParams.get('pageSize') ?? undefined,
      propertyId: url.searchParams.get('propertyId'),
      period: url.searchParams.get('period'),
      type: url.searchParams.get('type'),
      status: url.searchParams.get('status') ?? undefined,
    });

    return collectionResponse(collection.charges, {
      ...collection.meta,
      totalOutstanding: collection.totalOutstanding,
      currency: collection.currency,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/**
 * Enregistre une charge en brouillon (API section 27).
 *
 * **201**, à la différence de la génération des loyers : une ressource est bien
 * créée ici, et elle a une adresse. La publication, elle, répondra 200, étant un
 * changement d'état et non une création.
 *
 * `allocationMethod` n'accepte que `EQUAL` (DEC-029), et le refus des deux
 * autres méthodes est explicite : les accepter en les traitant comme `EQUAL`
 * produirait des créances fausses sous un nom juste.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const charge = await createCharge(getDb(), context, await readJsonBody(request));

    return dataResponse(charge, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
