import { getDb } from '@/db/client';
import { getEnv } from '@/lib/env';
import { isAuthorizedInternalJob, internalJobNotFound } from '@/lib/http/internal-job';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { runRentGenerationJob } from '@/modules/rents';

/**
 * Génération automatique des échéances (API section 19, DEC-028, job
 * `generateRentInstallments`).
 *
 * ```text
 * POST /internal/jobs/generate-rents
 * Authorization: Bearer <INTERNAL_JOB_SECRET>
 * ```
 *
 * La section 19 décrit le job en cinq temps, et ils sont tous tenus : chercher
 * les contrats actifs, déterminer les échéances attendues, vérifier si elles
 * existent, créer les absentes, journaliser le résultat. Les quatre premiers
 * appartiennent au service ; le dernier est ici.
 *
 * **Non publique**, et le refus est un 404 : répondre « non autorisé »
 * confirmerait l'adresse à qui cherche la surface interne du produit. Secret
 * absent de l'environnement, et la route refuse tout.
 *
 * **Sans appelant, donc sans périmètre** : le job traite TOUTES les
 * organisations. C'est la raison même pour laquelle cette route ne doit pas être
 * publique, et pourquoi le périmètre n'est pas un paramètre : une plateforme ne
 * doit pas pouvoir restreindre ou élargir ce qu'un job facture.
 *
 * **La période n'est pas un paramètre non plus.** C'est le mois en cours, et lui
 * seul (DEC-053) : accepter une période depuis la plateforme permettrait à une
 * erreur de configuration de créer une dette rétroactive, que personne n'aurait
 * demandée. Un mois écoulé se réclame à la main, par
 * `POST /api/v1/rents/generate`.
 *
 * `POST` et non `GET` : le job écrit. Un `GET` serait déclenché par n'importe
 * quel préchargement ou robot d'indexation.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAuthorizedInternalJob(request, getEnv().INTERNAL_JOB_SECRET)) {
    return internalJobNotFound();
  }

  try {
    const result = await runRentGenerationJob(getDb());

    /*
     * Journalisation EXIGÉE par DEC-028, « chaque exécution est journalisée avec
     * son résultat ». Les trois nombres sont distincts et c'est le but : un job
     * rejoué affiche zéro créée et tout ignoré, ce qui prouve l'idempotence au
     * lieu de laisser croire à un travail refait.
     */
    console.info(
      `[job:generateRentInstallments] période=${result.period} attendues=${result.expected} créées=${result.created} ignorées=${result.skipped}`,
    );

    return dataResponse(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
