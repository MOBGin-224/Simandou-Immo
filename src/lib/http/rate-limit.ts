const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const requestsByIp = new Map<string, RateLimitEntry>();

/**
 * Limitation en mémoire prévue pour un déploiement mono-instance ; utiliser un
 * store externe partagé si l'application passe à plusieurs instances.
 */
export function isRateLimited(ip: string, now = Date.now()): boolean {
  for (const [knownIp, entry] of requestsByIp) {
    if (entry.resetAt <= now) requestsByIp.delete(knownIp);
  }

  const entry = requestsByIp.get(ip);
  if (!entry || entry.resetAt <= now) {
    requestsByIp.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  if (entry.count >= MAX_REQUESTS) return true;

  entry.count += 1;
  return false;
}

export function clientIpFromHeaders(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwardedFor || headers.get('x-real-ip') || 'unknown';
}
