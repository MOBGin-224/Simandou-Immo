import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse } from '@/lib/http/responses';
import {
  generateReceiptPdf,
  getLeaseReceiptById,
  type ReceiptPdfReceivable,
} from '@/modules/receipts';

type FrozenAllocation = { paymentId: string; amount: number };
type FrozenReceivable = {
  kind: 'RENT' | 'CHARGE';
  id: string;
  amountDue: number;
  allocations: FrozenAllocation[];
};
type FrozenContent = { receivables: FrozenReceivable[] };

function isFrozenContent(value: unknown): value is FrozenContent {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { receivables?: unknown }).receivables)
  );
}

/** Génère et renvoie le PDF d'une quittance, selon le périmètre (DEC-058). */
export async function GET(
  _request: Request,
  routeContext: RouteContext<'/api/v1/receipts/[id]/pdf'>,
): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const { id } = await routeContext.params;

    const result = await getLeaseReceiptById(getDb(), id, context);
    const version = result.currentVersion;
    const frozenContent: unknown = version?.frozenContent;

    // Toutes les créances figées appartiennent à la période de la quittance
    // elle-même (DEC-058, 2.2) : `checkEligibility` ne retient jamais une
    // créance d'une autre période.
    const receivables: ReceiptPdfReceivable[] = isFrozenContent(frozenContent)
      ? frozenContent.receivables.map((receivable) => ({
          kind: receivable.kind,
          periodStart: result.receipt.periodStart,
          amountDue: Number(receivable.amountDue),
          amountAllocated: receivable.allocations.reduce(
            (sum, allocation) => sum + Number(allocation.amount),
            0,
          ),
        }))
      : [];

    const periodLabel = new Intl.DateTimeFormat('fr-FR', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(result.receipt.periodStart));

    const pdf = await generateReceiptPdf({
      referenceNumber: result.receipt.referenceNumber,
      publicReference: result.receipt.publicReference,
      version: version?.version ?? 1,
      status: version?.status ?? 'EMISE',
      invalidationReason: version?.invalidationReason ?? null,
      period: periodLabel,
      amount: Number(result.receipt.totalAttested),
      currency: result.receipt.currency,
      tenantName: result.tenantName,
      apartmentName: result.apartmentName,
      propertyName: result.propertyName,
      organizationName: result.organizationName,
      emittedAt: (version?.emittedAt ?? result.receipt.createdAt).toISOString(),
      receivables,
      appUrl: process.env.APP_URL ?? '',
      generatedAt: new Date().toISOString(),
    });

    return new Response(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${result.receipt.referenceNumber}.pdf"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
