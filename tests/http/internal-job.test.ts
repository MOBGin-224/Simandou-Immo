import { describe, expect, it } from 'vitest';

import { internalJobNotFound, isAuthorizedInternalJob } from '../../src/lib/http/internal-job';

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
