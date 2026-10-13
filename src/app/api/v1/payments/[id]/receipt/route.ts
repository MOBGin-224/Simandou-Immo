import { getDb } from '@/db/client';
import { requireAccessContext } from '@/lib/authorization';
import { apiErrorResponse } from '@/lib/http/responses';
import { getPaymentReceiptPdf } from '@/modules/payments';

/** Génère et renvoie le PDF de reçu d'un paiement confirmé ou annulé (DEC-057). */
export async function GET(
  _request: Request,
  routeContext: RouteContext<'/api/v1/payments/[id]/receipt'>,
): Promise<Response> {
  try {
    const context = await requireAccessContext();
    const { id } = await routeContext.params;

    const { pdf, payment } = await getPaymentReceiptPdf(
      getDb(),
      id,
      context,
      process.env.APP_URL ?? '',
    );

    return new Response(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${payment.referenceNumber}.pdf"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
