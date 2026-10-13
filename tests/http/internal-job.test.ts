import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { internalJobNotFound, isAuthorizedInternalJob } from '../../src/lib/http/internal-job';

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getEnv: vi.fn(),
}));

vi.mock('@/db/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/db/client')>()),
  getDb: mocks.getDb,
}));

vi.mock('@/lib/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/env')>()),
  getEnv: mocks.getEnv,
}));

import { POST } from '../../src/app/internal/jobs/generate-receipts/route';
import { createTestDatabase, type TestDatabase } from '../helpers/database';

/**
 * DEC-028 : « toute route `/internal/*` est inaccessible publiquement ».
 *
 * Ce garde est le SEUL contrôle qui protège les routes de job, et un job de
 * génération laissé ouvert permettrait à n'importe qui de créer des créances
 * dans toutes les organisations à la fois. D'où un fichier de test à lui seul.
 *
 * Le garde reçoit le secret attendu en PARAMÈTRE, ce qui rend ce fichier
 * indépendant de l'environnement : aucune base, aucune variable à poser, et le
 * cas « secret absent » s'écrit en passant `undefined` plutôt qu'en manipulant
 * `process.env`. C'est précisément pourquoi le garde ne lit pas `getEnv`
 * lui-même.
 */
describe('Garde des routes internes', () => {
  const SECRET = 'secret-interne-de-job-assez-long-pour-passer';

  const requestWith = (authorization?: string) =>
    new Request('https://immo.test/internal/jobs/generate-rents', {
      method: 'POST',
      headers: authorization === undefined ? {} : { authorization },
    });

  describe('Quand le secret est configuré', () => {
    it('accepte le bon secret en Bearer', () => {
      expect(isAuthorizedInternalJob(requestWith(`Bearer ${SECRET}`), SECRET)).toBe(true);
    });

    it('accepte le schéma écrit en minuscules ou en majuscules', () => {
      expect(isAuthorizedInternalJob(requestWith(`bearer ${SECRET}`), SECRET)).toBe(true);
      expect(isAuthorizedInternalJob(requestWith(`BEARER ${SECRET}`), SECRET)).toBe(true);
    });

    it('refuse un mauvais secret', () => {
      expect(isAuthorizedInternalJob(requestWith('Bearer mauvais-secret'), SECRET)).toBe(false);
    });

    /** Un préfixe correct ne doit rien valoir : la comparaison porte sur le tout. */
    it('refuse un préfixe du bon secret', () => {
      expect(isAuthorizedInternalJob(requestWith(`Bearer ${SECRET.slice(0, -1)}`), SECRET)).toBe(
        false,
      );
      expect(isAuthorizedInternalJob(requestWith(`Bearer ${SECRET}x`), SECRET)).toBe(false);
    });

    it('refuse un appel sans en-tête d autorisation', () => {
      expect(isAuthorizedInternalJob(requestWith(), SECRET)).toBe(false);
    });

    it('refuse un autre schéma d autorisation', () => {
      expect(isAuthorizedInternalJob(requestWith(`Basic ${SECRET}`), SECRET)).toBe(false);
      expect(isAuthorizedInternalJob(requestWith(SECRET), SECRET)).toBe(false);
    });
  });

  /**
   * Fermé par défaut. Une route de job ouverte parce que sa configuration est
   * incomplète serait exactement la faille que la décision ferme.
   */
  describe('Quand le secret est absent', () => {
    it('refuse tout, y compris un appel sans en-tête', () => {
      expect(isAuthorizedInternalJob(requestWith(), undefined)).toBe(false);
      expect(isAuthorizedInternalJob(requestWith('Bearer '), undefined)).toBe(false);
      expect(isAuthorizedInternalJob(requestWith(`Bearer ${SECRET}`), undefined)).toBe(false);
    });
  });

  /**
   * Le refus est un 404 et jamais un 401 : répondre « non autorisé »
   * confirmerait qu'une route de job existe à cette adresse (ADR-008).
   */
  describe('Forme du refus', () => {
    it('répond 404, sans corps', async () => {
      const response = internalJobNotFound();

      expect(response.status).toBe(404);
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
      expect(await response.text()).toBe('');
    });
  });
});

/**
 * Route du job `generateMonthlyReceipts` (DEC-058, 3.3) : même garde que les
 * autres jobs internes, vérifiée ici de bout en bout plutôt qu'à l'unité,
 * puisqu'aucune route de job n'avait encore de test à ce niveau.
 */
describe('POST /internal/jobs/generate-receipts', () => {
  let harness: TestDatabase;
  const SECRET = 'secret-interne-de-job-assez-long-pour-passer';

  const request = (authorization?: string) =>
    new Request('https://immo.test/internal/jobs/generate-receipts', {
      method: 'POST',
      headers: authorization === undefined ? {} : { authorization },
    });

  beforeAll(async () => {
    harness = await createTestDatabase();
  });

  afterAll(async () => {
    await harness.close();
  });

  it('répond 404 sans en-tête Authorization, jamais 401', async () => {
    mocks.getEnv.mockReturnValue({ INTERNAL_JOB_SECRET: SECRET });

    const response = await POST(request());

    expect(response.status).toBe(404);
    expect(response.status).not.toBe(401);
  });

  it('répond 404 avec un mauvais secret, jamais 401', async () => {
    mocks.getEnv.mockReturnValue({ INTERNAL_JOB_SECRET: SECRET });

    const response = await POST(request('Bearer mauvais-secret'));

    expect(response.status).toBe(404);
    expect(response.status).not.toBe(401);
  });

  it('répond 200 avec le bon secret, et un JSON de résultat', async () => {
    mocks.getEnv.mockReturnValue({ INTERNAL_JOB_SECRET: SECRET });
    mocks.getDb.mockReturnValue(harness.db);

    const response = await POST(request(`Bearer ${SECRET}`));
    const body = (await response.json()) as {
      data?: { emitted: number; skipped: number; details: unknown[] };
    };

    expect(response.status).toBe(200);
    expect(body.data?.emitted).toBeTypeOf('number');
    expect(body.data?.skipped).toBeTypeOf('number');
    expect(Array.isArray(body.data?.details)).toBe(true);
  });
});
