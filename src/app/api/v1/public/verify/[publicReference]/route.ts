import { randomUUID } from 'node:crypto';
import { getDb } from '@/db/client';
import { clientIpFromHeaders, isRateLimited } from '@/lib/http/rate-limit';
import { logInternalError } from '@/lib/http/errors';
import { getPublicVerification } from '@/modules/payments';

const PUBLIC_REFERENCE_PATTERN = /^R-[0-9A-Za-z]{10}$/;

export async function GET(
  request: Request,
  routeContext: RouteContext<'/api/v1/public/verify/[publicReference]'>,
): Promise<Response> {
  if (isRateLimited(clientIpFromHeaders(request.headers))) {
    return Response.json({ recognized: false }, { status: 429 });
  }

  try {
    const { publicReference } = await routeContext.params;
    if (!PUBLIC_REFERENCE_PATTERN.test(publicReference)) {
      return Response.json({ recognized: false }, { status: 200 });
    }

    const data = await getPublicVerification(getDb(), publicReference);
    return data
      ? Response.json({ recognized: true, data }, { status: 200 })
      : Response.json({ recognized: false }, { status: 200 });
  } catch (error) {
    logInternalError(randomUUID(), error);
    return Response.json({ recognized: false }, { status: 200 });
  }
}
