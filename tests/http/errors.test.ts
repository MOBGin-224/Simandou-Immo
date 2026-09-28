import { describe, expect, it } from 'vitest';

import { UnauthenticatedError } from '../../src/lib/auth/session';
import {
  PermissionDeniedError,
  ResourceOutOfScopeError,
} from '../../src/lib/authorization/service';
import { newErrorId, toApiError } from '../../src/lib/http/errors';
import { MalformedRequestBodyError } from '../../src/lib/http/responses';
import {
  ArchivedPropertyError,
  PropertyNameAlreadyUsedError,
  PropertyValidationError,
} from '../../src/modules/properties/errors';

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
