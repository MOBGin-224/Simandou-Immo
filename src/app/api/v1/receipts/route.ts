import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse, collectionResponse } from '@/lib/http/responses';
import { listLeaseReceipts, parseLeaseReceiptListQuery } from '@/modules/receipts';

/** Liste paginée des quittances selon le périmètre (DEC-058). */
export async function GET(request: Request): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const url = new URL(request.url);

    const filters = parseLeaseReceiptListQuery({
      page: url.searchParams.get('page') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
      propertyId: url.searchParams.get('propertyId') ?? undefined,
      tenantId: url.searchParams.get('tenantId') ?? undefined,
      period: url.searchParams.get('period') ?? undefined,
    });

    const collection = await listLeaseReceipts(getDb(), context, filters);

    return collectionResponse(collection.receipts, collection.meta);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
