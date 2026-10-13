import { getDb } from '@/db/client';
import { getEnv } from '@/lib/env';
import { isAuthorizedInternalJob, internalJobNotFound } from '@/lib/http/internal-job';
import { apiErrorResponse, dataResponse } from '@/lib/http/responses';
import { generateMonthlyReceiptsJob } from '@/modules/receipts';

/**
 * Génération automatique des quittances du mois écoulé (DEC-058, 3.3, job
 * `generateMonthlyReceipts`).
 *
 * ```text
 * POST /internal/jobs/generate-receipts
 * Authorization: Bearer <INTERNAL_JOB_SECRET>
 * ```
 *
 * Même garde que les autres jobs internes (`generate-rents`,
 * `mark-overdue-receivables`) : **non publique**, refus en 404 et jamais en
 * 401 ni 403, pour ne pas confirmer que cette route existe (ADR-008).
 *
 * **Sans appelant, donc sans périmètre** : le job traite toutes les
 * organisations, comme les autres jobs internes.
 *
 * **La période n'est pas un paramètre** : c'est toujours le mois PRÉCÉDENT
 * celui de l'instant d'appel (DEC-058, 3.3), jamais un mois choisi par la
 * plateforme qui déclenche le job.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAuthorizedInternalJob(request, getEnv().INTERNAL_JOB_SECRET)) {
    return internalJobNotFound();
  }

  try {
    const result = await generateMonthlyReceiptsJob(getDb(), { now: new Date() });

    console.info(
      `[job:generateMonthlyReceipts] émises=${result.emitted} ignorées=${result.skipped}`,
    );

    return dataResponse(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
