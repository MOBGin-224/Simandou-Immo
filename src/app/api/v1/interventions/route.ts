import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import {
  apiErrorResponse,
  collectionResponse,
  dataResponse,
  readJsonBody,
} from '@/lib/http/responses';
import {
  createIntervention,
  listInterventions,
  parseListInterventionsQuery,
} from '@/modules/interventions';

/**
 * Collection des interventions (Lot 14, DEC-060).
 *
 * ```text
 * POST /api/v1/interventions    création (section 8.1)
 * GET  /api/v1/interventions    liste selon le périmètre, avec filtres (section 11.1)
 * ```
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const body = await readJsonBody(request);

    const intervention = await createIntervention(getDb(), body, context);

    return dataResponse(intervention, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const url = new URL(request.url);
    const statusValues = url.searchParams.getAll('status');

    const filters = parseListInterventionsQuery({
      page: url.searchParams.get('page') ?? undefined,
      pageSize: url.searchParams.get('pageSize') ?? undefined,
      status: statusValues.length > 0 ? statusValues : undefined,
      propertyId: url.searchParams.get('propertyId') ?? undefined,
      apartmentId: url.searchParams.get('apartmentId') ?? undefined,
      incidentId: url.searchParams.get('incidentId') ?? undefined,
      assignedToUserId: url.searchParams.get('assignedToUserId') ?? undefined,
    });

    const collection = await listInterventions(getDb(), context, filters);

    return collectionResponse(collection.interventions, collection.meta);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
