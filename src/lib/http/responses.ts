import { logInternalError, toApiError, type ApiErrorCode } from './errors';

/**
 * Enveloppes de réponse de l'API (API sections 5 et 6).
 *
 * Une seule forme pour les succès, une seule pour les erreurs. C'est ce qui
 * permet au frontend de traiter toutes les routes de la même façon, et c'est
 * l'exigence API-002.
 *
 * ```json
 * { "data": { }, "meta": { } }
 * { "error": { "code": "", "message": "", "details": { } } }
 * ```
 *
 * Aucune route n'écrit ces objets à la main : la moindre variation de forme
 * casserait le contrat côté client.
 */

export type ApiMeta = Record<string, unknown>;

/** Réponse de succès portant une ressource. */
export function dataResponse(data: unknown, init?: { status?: number; meta?: ApiMeta }): Response {
  return Response.json({ data, meta: init?.meta ?? {} }, { status: init?.status ?? 200 });
}

/** Réponse de succès portant une collection et sa pagination. */
export function collectionResponse(data: unknown[], meta: ApiMeta): Response {
  return Response.json({ data, meta }, { status: 200 });
}

/** Réponse d'erreur explicite. */
export function errorResponse(
  code: ApiErrorCode,
  message: string,
  init?: { status?: number; details?: Record<string, unknown> },
): Response {
  return Response.json(
    { error: { code, message, ...(init?.details ? { details: init.details } : {}) } },
    { status: init?.status ?? 400 },
  );
}

/**
 * Traduit une erreur levée par un cas d'usage en réponse.
 *
 * C'est le point de sortie unique des routes : tout `catch` le rejoint, donc
 * aucune route ne peut divulguer une trace par distraction. Une erreur interne y
 * est journalisée avec sa référence AVANT d'être renvoyée sans détail.
 */
export function apiErrorResponse(error: unknown): Response {
  const shape = toApiError(error);

  if (shape.errorId) logInternalError(shape.errorId, error);

  return Response.json(
    {
      error: {
        code: shape.code,
        message: shape.message,
        ...(shape.details ? { details: shape.details } : {}),
        ...(shape.errorId ? { errorId: shape.errorId } : {}),
      },
    },
    { status: shape.status },
  );
}

/**
 * Corps JSON d'une requête, ou refus explicite.
 *
 * Un corps illisible est une requête malformée, donc 400, à distinguer d'un corps
 * lisible mais refusé par le schéma, qui donne 422.
 */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new MalformedRequestBodyError();
  }
}

/** Corps de requête illisible. Traduite en 400 par `apiErrorResponse`. */
export class MalformedRequestBodyError extends Error {
  constructor() {
    super("Le corps de la requête n'est pas un JSON valide.");
    this.name = 'MalformedRequestBodyError';
  }
}
