import { randomUUID } from 'node:crypto';
import { getDb } from '@/db/client';
import { clientIpFromHeaders, isRateLimited } from '@/lib/http/rate-limit';
import { logInternalError } from '@/lib/http/errors';
import { getPublicVerification } from '@/modules/payments';
import { getPublicReceiptVerification } from '@/modules/receipts';

/** Reçu de paiement (DEC-057). */
const PAYMENT_REFERENCE_PATTERN = /^R-[0-9A-Za-z]{10}$/;
/** Quittance formelle (DEC-058, 7.4). */
const RECEIPT_REFERENCE_PATTERN = /^Q-[0-9A-Za-z]{10}$/;

export async function GET(
  request: Request,
  routeContext: RouteContext<'/api/v1/public/verify/[publicReference]'>,
): Promise<Response> {
  if (isRateLimited(clientIpFromHeaders(request.headers))) {
    return Response.json({ recognized: false }, { status: 429 });
  }

  try {
    const { publicReference } = await routeContext.params;

    if (PAYMENT_REFERENCE_PATTERN.test(publicReference)) {
      const data = await getPublicVerification(getDb(), publicReference);
      return data
        ? Response.json({ recognized: true, kind: 'payment', data }, { status: 200 })
        : Response.json({ recognized: false }, { status: 200 });
    }

    if (RECEIPT_REFERENCE_PATTERN.test(publicReference)) {
      const data = await getPublicReceiptVerification(getDb(), publicReference);
      return data
        ? Response.json({ recognized: true, kind: 'receipt', data }, { status: 200 })
        : Response.json({ recognized: false }, { status: 200 });
    }

    return Response.json({ recognized: false }, { status: 200 });
  } catch (error) {
    logInternalError(randomUUID(), error);
    return Response.json({ recognized: false }, { status: 200 });
  }
}
