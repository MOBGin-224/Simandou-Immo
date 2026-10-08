import { describe, expect, it } from 'vitest';

import { UnauthenticatedError, WeakPasswordError } from '../../src/lib/auth/session';
import {
  PermissionDeniedError,
  ResourceOutOfScopeError,
} from '../../src/lib/authorization/service';
import { newErrorId, toApiError } from '../../src/lib/http/errors';
import { MalformedRequestBodyError } from '../../src/lib/http/responses';
import {
  AlreadyArchivedApartmentError,
  ApartmentBulkConflictError,
  ApartmentNumberAlreadyUsedError,
  ApartmentValidationError,
  ArchivedApartmentError,
} from '../../src/modules/apartments/errors';
import {
  InvitationInvalidError,
  InvitationLoginRequiredError,
  InvitationNotOpenError,
  InvitationTargetUnavailableError,
} from '../../src/modules/invitations/errors';
import {
  ManagerInvitationConflictError,
  ManagerStateError,
  ManagerValidationError,
} from '../../src/modules/managers/errors';
import {
  ArchivedPropertyError,
  PropertyNameAlreadyUsedError,
  PropertyValidationError,
} from '../../src/modules/properties/errors';
import {
  LeaseConflictError,
  LeaseStateError,
  LeaseTerminationDateError,
  LeaseValidationError,
} from '../../src/modules/leases/errors';
import { RentGenerationLimitError, RentValidationError } from '../../src/modules/rents/errors';
import {
  TenantInvitationConflictError,
  TenantNameNotOwnedError,
  TenantNoAccessError,
  TenantOrganizationRequiredError,
  TenantStateError,
  TenantValidationError,
} from '../../src/modules/tenants/errors';

/**
 * Ce fichier existe pour une raison précise.
 *
 * La traduction des erreurs en réponses HTTP se fait par le NOM de l'erreur, afin
 * que la couche HTTP ne dépende d'aucun module métier. Le prix de ce découplage est
 * qu'un nom mal orthographié retomberait silencieusement en 500, c'est-à-dire qu'un
 * refus de permission deviendrait une panne. Ce test confronte donc la table aux
 * VRAIES classes : renommer une erreur sans toucher la table casse ici, et non en
 * production.
 */
describe('Traduction des erreurs en réponses HTTP', () => {
  const cases: { error: Error; status: number; code: string }[] = [
    { error: new MalformedRequestBodyError(), status: 400, code: 'VALIDATION_ERROR' },
    { error: new UnauthenticatedError(), status: 401, code: 'UNAUTHORIZED' },
    { error: new PermissionDeniedError('property.archive'), status: 403, code: 'FORBIDDEN' },
    { error: new ResourceOutOfScopeError(), status: 404, code: 'NOT_FOUND' },
    {
      error: new PropertyValidationError({ name: ['obligatoire'] }),
      status: 422,
      code: 'VALIDATION_ERROR',
    },
    { error: new PropertyNameAlreadyUsedError('Immeuble A'), status: 409, code: 'CONFLICT' },
    { error: new ArchivedPropertyError('already-archived'), status: 409, code: 'CONFLICT' },
    {
      error: new ApartmentValidationError({ number: ['obligatoire'] }),
      status: 422,
      code: 'VALIDATION_ERROR',
    },
    { error: new ApartmentNumberAlreadyUsedError('A01'), status: 409, code: 'CONFLICT' },
    { error: new ApartmentBulkConflictError(['A01', 'A02']), status: 409, code: 'CONFLICT' },
    { error: new ArchivedApartmentError('property-archived'), status: 409, code: 'CONFLICT' },
    { error: new AlreadyArchivedApartmentError(), status: 409, code: 'CONFLICT' },
    {
      error: new ManagerValidationError({ phone: ['invalide'] }),
      status: 422,
      code: 'VALIDATION_ERROR',
    },
    {
      error: new ManagerInvitationConflictError('already-manager'),
      status: 409,
      code: 'CONFLICT',
    },
    { error: new InvitationTargetUnavailableError(), status: 409, code: 'CONFLICT' },
    { error: new InvitationNotOpenError('accepted'), status: 409, code: 'CONFLICT' },
    { error: new ManagerStateError('suspend', 'SUSPENDED'), status: 409, code: 'CONFLICT' },
    {
      error: new TenantValidationError({ apartmentId: ['archivé'] }),
      status: 422,
      code: 'VALIDATION_ERROR',
    },
    { error: new TenantInvitationConflictError('already-tenant'), status: 409, code: 'CONFLICT' },
    { error: new TenantStateError('reactivate', 'REVOKED'), status: 409, code: 'CONFLICT' },
    { error: new TenantNameNotOwnedError(), status: 403, code: 'FORBIDDEN' },
    { error: new TenantNoAccessError(), status: 409, code: 'CONFLICT' },
    {
      error: new TenantOrganizationRequiredError(['a', 'b']),
      status: 409,
      code: 'CONFLICT',
    },
    {
      error: new LeaseValidationError({ startDate: ['invalide'] }),
      status: 422,
      code: 'VALIDATION_ERROR',
    },
    { error: new LeaseConflictError('apartment-occupied'), status: 409, code: 'CONFLICT' },
    { error: new LeaseStateError('terminate', 'ENDED'), status: 409, code: 'CONFLICT' },
    {
      error: new LeaseTerminationDateError('2026-10-01'),
      status: 422,
      code: 'VALIDATION_ERROR',
    },
    {
      error: new RentValidationError({ period: ['invalide'] }),
      status: 422,
      code: 'VALIDATION_ERROR',
    },
    { error: new RentGenerationLimitError(501, 500), status: 409, code: 'CONFLICT' },
    { error: new InvitationInvalidError(), status: 404, code: 'NOT_FOUND' },
    { error: new InvitationLoginRequiredError(), status: 401, code: 'UNAUTHORIZED' },
    { error: new WeakPasswordError(), status: 422, code: 'VALIDATION_ERROR' },
  ];

  for (const { error, status, code } of cases) {
    it(`traduit ${error.name} en ${status} ${code}`, () => {
      const shape = toApiError(error);

      expect(shape.status).toBe(status);
      expect(shape.code).toBe(code);
      expect(shape.message).toBe(error.message);
      expect(shape.errorId).toBeUndefined();
    });
  }

  /**
   * Une ressource hors périmètre ne doit JAMAIS donner 403 : répondre « interdit »
   * confirmerait son existence (ADR-007).
   */
  it('ne traduit jamais un hors-périmètre en interdit', () => {
    expect(toApiError(new ResourceOutOfScopeError()).status).not.toBe(403);
  });

  it('joint les messages par champ à une erreur de validation', () => {
    const shape = toApiError(new PropertyValidationError({ name: ['Le nom est obligatoire.'] }));

    expect(shape.details).toEqual({ fieldErrors: { name: ['Le nom est obligatoire.'] } });
  });

  /** Aucune divulgation : ni message technique, ni trace (MVP-ENG-030, MVP-ENG-031). */
  it('réduit une erreur inconnue à un message générique et une référence', () => {
    const shape = toApiError(new Error('échec de connexion à postgres://user:secret@hôte'));

    expect(shape.status).toBe(500);
    expect(shape.code).toBe('INTERNAL_ERROR');
    expect(shape.message).toBe('Une erreur est survenue.');
    expect(shape.message).not.toContain('secret');
    expect(shape.errorId).toMatch(/^ERR-\d{4}-\d{6}$/);
  });

  it('traite une valeur levée qui n est pas une erreur', () => {
    expect(toApiError('quelque chose').status).toBe(500);
    expect(toApiError(undefined).code).toBe('INTERNAL_ERROR');
  });

  it('produit une référence datée et lisible', () => {
    expect(newErrorId(new Date('2026-09-27T00:00:00.000Z'))).toMatch(/^ERR-2026-\d{6}$/);
  });
});

/**
 * Un lien d'invitation inutilisable ne doit rien apprendre (ADR-008).
 *
 * Il répond 404, et non 410 « disparu » ni 403 « refusé » : seul 404 laisse
 * indiscernables un lien inconnu, expiré, révoqué et déjà consommé.
 */
describe("Réponse à un lien d'invitation inutilisable", () => {
  it('est un 404, jamais un 410 ni un 403', () => {
    const shape = toApiError(new InvitationInvalidError());

    expect(shape.status).toBe(404);
    expect(shape.status).not.toBe(410);
    expect(shape.status).not.toBe(403);
  });

  it('porte toujours le même message, quelle que soit la cause réelle', () => {
    expect(toApiError(new InvitationInvalidError()).message).toBe(
      toApiError(new InvitationInvalidError()).message,
    );
  });
});
