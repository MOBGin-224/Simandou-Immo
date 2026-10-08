import { getDb } from '@/db/client';
import { getEnv } from '@/lib/env';
import { isAuthorizedInternalJob, internalJobNotFound } from '@/lib/http/internal-job';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { runOverdueJob } from '@/modules/rents';

/**
 * Passage en retard des créances échues (BR-037, DEC-028, job
 * `markOverdueReceivables`).
 *
 * ```text
 * POST /internal/jobs/mark-overdue-receivables
 * Authorization: Bearer <INTERNAL_JOB_SECRET>
 * ```
 *
 * BR-037 le dit sans détour : « le passage de `UNPAID` ou `PARTIALLY_PAID` vers
 * `OVERDUE` est effectué par un job idempotent, pas au moment de la lecture ».
 * D'où cette route, et d'où l'absence de toute écriture de statut dans les
 * fonctions de lecture du module.
 *
 * Deux conséquences de la règle, tenues par la requête : une créance `PAID` ou
 * `CANCELLED` ne passe JAMAIS en retard, et le solde doit être strictement
 * positif.
 *
 * **Le nom est au pluriel « receivables » et non « rents »**, parce que le job de
 * DEC-028 porte ce nom et qu'il vise les DEUX créances (DEC-015). Au Lot 9 il ne
 * balaie que les loyers, les charges n'existant pas ; le Lot 10 ajoutera leur
 * balayage ICI plutôt que d'ouvrir une seconde route, pour qu'une seule
 * exécution planifiée suffise.
 *
 * Même protection que l'autre job : non publique, refus en 404, fermée si le
 * secret est absent.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAuthorizedInternalJob(request, getEnv().INTERNAL_JOB_SECRET)) {
    return internalJobNotFound();
  }

  try {
    const result = await runOverdueJob(getDb());

    // Journalisation exigée par DEC-028 : une exécution sans effet affiche zéro,
    // ce qui est le cas normal d'un second passage le même jour.
    console.info(
      `[job:markOverdueReceivables] date=${result.today} passées en retard=${result.marked}`,
    );

    return dataResponse(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
