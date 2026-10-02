/**
 * Traduction des erreurs en réponses HTTP (API sections 6, 7 et 68).
 *
 * Deux exigences se rencontrent ici.
 *
 *   1. Le frontend doit pouvoir traiter un `code` de manière DÉTERMINISTE. Les
 *      codes sont donc un ensemble fermé, jamais une chaîne improvisée.
 *   2. Une erreur interne ne doit rien divulguer : ni message technique, ni
 *      trace, ni nom de table (MVP-ENG-030, MVP-ENG-031). Elle est journalisée
 *      côté serveur avec une référence, et l'utilisateur ne reçoit que cette
 *      référence.
 *
 * La correspondance se fait par le NOM de l'erreur et non par `instanceof`. Ce
 * module reste ainsi sans dépendance vers les modules métier, qui ne connaissent
 * donc pas HTTP : c'est la séparation exigée par MVP-ENG-029. Le prix est qu'un
 * nom mal orthographié retomberait silencieusement en 500 ; le test
 * `tests/http/errors.test.ts` interdit ce cas en confrontant la table aux vraies
 * classes d'erreur.
 */

/** Codes d'erreur du produit. Sous-ensemble utilisé par les routes de ce lot. */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_STATE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export type ApiErrorShape = {
  status: number;
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
  /** Présent uniquement pour une erreur interne, à communiquer au support. */
  errorId?: string;
};

/**
 * Correspondance nom d'erreur, statut et code.
 *
 * `ResourceOutOfScopeError` donne 404 et JAMAIS 403 : répondre « interdit » sur
 * une ressource hors périmètre confirmerait son existence (ADR-007, DEC-025).
 *
 * La validation donne 422 et non 400, réservé à une requête malformée : le corps
 * était lisible, ce sont ses valeurs qui sont refusées.
 */
const BY_ERROR_NAME: Record<string, { status: number; code: ApiErrorCode }> = {
  MalformedRequestBodyError: { status: 400, code: 'VALIDATION_ERROR' },
  UnauthenticatedError: { status: 401, code: 'UNAUTHORIZED' },
  PermissionDeniedError: { status: 403, code: 'FORBIDDEN' },
  ResourceOutOfScopeError: { status: 404, code: 'NOT_FOUND' },
  PropertyValidationError: { status: 422, code: 'VALIDATION_ERROR' },
  PropertyNameAlreadyUsedError: { status: 409, code: 'CONFLICT' },
  ArchivedPropertyError: { status: 409, code: 'CONFLICT' },
  ApartmentValidationError: { status: 422, code: 'VALIDATION_ERROR' },
  ApartmentNumberAlreadyUsedError: { status: 409, code: 'CONFLICT' },
  ApartmentBulkConflictError: { status: 409, code: 'CONFLICT' },
  ArchivedApartmentError: { status: 409, code: 'CONFLICT' },
  AlreadyArchivedApartmentError: { status: 409, code: 'CONFLICT' },
};

/** Référence technique corrélable entre la réponse et les journaux. */
export function newErrorId(now: Date = new Date()): string {
  const digits = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0');

  return `ERR-${now.getUTCFullYear()}-${digits}`;
}

const GENERIC_MESSAGE = 'Une erreur est survenue.';

/** Détails exploitables par un formulaire, lorsque l'erreur en porte. */
function detailsOf(error: unknown): Record<string, unknown> | undefined {
  if (typeof error !== 'object' || error === null) return undefined;

  const fieldErrors = (error as { fieldErrors?: unknown }).fieldErrors;

  if (typeof fieldErrors !== 'object' || fieldErrors === null) return undefined;

  return { fieldErrors };
}

/**
 * Forme HTTP d'une erreur.
 *
 * Toute erreur inconnue devient 500 avec un message générique : ne rien
 * reconnaître doit rester sûr par défaut, jamais bavard par accident.
 */
export function toApiError(error: unknown): ApiErrorShape {
  const name = error instanceof Error ? error.name : '';
  const known = BY_ERROR_NAME[name];

  if (!known) {
    return {
      status: 500,
      code: 'INTERNAL_ERROR',
      message: GENERIC_MESSAGE,
      errorId: newErrorId(),
    };
  }

  return {
    status: known.status,
    code: known.code,
    message: error instanceof Error ? error.message : GENERIC_MESSAGE,
    details: detailsOf(error),
  };
}

/** Une erreur inattendue doit être journalisée, sinon la référence ne sert à rien. */
export function logInternalError(errorId: string, error: unknown): void {
  console.error(`[${errorId}]`, error);
}
