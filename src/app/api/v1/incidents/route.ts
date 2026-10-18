import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import {
  apiErrorResponse,
  collectionResponse,
  dataResponse,
  readJsonBody,
} from '@/lib/http/responses';
import { createIncident, listIncidents, parseListIncidentsQuery } from '@/modules/incidents';

/**
 * Collection des incidents (Lot 13, DEC-059).
 *
 * ```text
 * POST /api/v1/incidents    déclaration
 * GET  /api/v1/incidents    liste selon le périmètre, avec filtres (section 10.1)
 * ```
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const body = await readJsonBody(request);

    const incident = await createIncident(getDb(), body, context);

    return dataResponse(incident, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const url = new URL(request.url);
    const statusValues = url.searchParams.getAll('status');

    const filters = parseListIncidentsQuery({
      page: url.searchParams.get('page') ?? undefined,
      pageSize: url.searchParams.get('pageSize') ?? undefined,
      status: statusValues.length > 0 ? statusValues : undefined,
      priority: url.searchParams.get('priority') ?? undefined,
      category: url.searchParams.get('category') ?? undefined,
      propertyId: url.searchParams.get('propertyId') ?? undefined,
      apartmentId: url.searchParams.get('apartmentId') ?? undefined,
      assignedToUserId: url.searchParams.get('assignedToUserId') ?? undefined,
      toProcess: url.searchParams.get('toProcess') ?? undefined,
    });

    const collection = await listIncidents(getDb(), context, filters);

    return collectionResponse(collection.incidents, collection.meta);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
