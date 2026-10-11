import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, collectionResponse } from '@/lib/http/responses';
import { listPayments } from '@/modules/payments';

export async function GET(request: Request): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const url = new URL(request.url);
    const collection = await listPayments(getDb(), context, {
      page: url.searchParams.get('page') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
      apartmentId: url.searchParams.get('apartmentId') ?? undefined,
      tenantId: url.searchParams.get('tenantId') ?? undefined,
    });

    return collectionResponse(collection.payments, collection.meta);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
