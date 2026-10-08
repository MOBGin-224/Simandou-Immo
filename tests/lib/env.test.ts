import { describe, expect, it } from 'vitest';

import { parseEnv } from '../../src/lib/env';

/**
 * La validation d'environnement doit échouer au démarrage avec un message
 * lisible. Une DATABASE_URL absente qui n'échoue qu'au premier accès à la base
 * produit une erreur obscure, loin de sa cause.
 */
describe('Validation des variables d environnement', () => {
  const valid = {
    DATABASE_URL: 'postgresql://simandou:secret@localhost:5432/simandou_immo',
    APP_URL: 'http://localhost:3000',
    BETTER_AUTH_SECRET: 'secret-de-signature-des-sessions-assez-long',
    BETTER_AUTH_URL: 'http://localhost:3000',
  };

  it('accepte une configuration valide', () => {
    const env = parseEnv(valid);

    expect(env.DATABASE_URL).toBe(valid.DATABASE_URL);
    expect(env.APP_URL).toBe(valid.APP_URL);
  });

  it('applique development comme environnement par défaut', () => {
    expect(parseEnv(valid).NODE_ENV).toBe('development');
  });

  it('accepte le schéma postgres comme le schéma postgresql', () => {
    expect(() =>
      parseEnv({ ...valid, DATABASE_URL: 'postgres://user:pass@host:5432/base' }),
    ).not.toThrow();
  });

  it('refuse une DATABASE_URL absente', () => {
    expect(() => parseEnv({ APP_URL: valid.APP_URL })).toThrow(/DATABASE_URL/);
  });

  it('refuse une DATABASE_URL qui n est pas une URL PostgreSQL', () => {
    // Une URL valide mais d un autre protocole est le piège réel : un copier
    // coller de chaîne MySQL ou HTTP passerait une validation trop permissive.
    expect(() => parseEnv({ ...valid, DATABASE_URL: 'mysql://user@host:3306/base' })).toThrow(
      /PostgreSQL/,
    );
    expect(() => parseEnv({ ...valid, DATABASE_URL: 'pas-une-url' })).toThrow(/PostgreSQL/);
  });

  it('refuse une APP_URL relative', () => {
    expect(() => parseEnv({ ...valid, APP_URL: '/accueil' })).toThrow(/APP_URL/);
  });

  it('refuse un NODE_ENV inconnu', () => {
    expect(() => parseEnv({ ...valid, NODE_ENV: 'staging' })).toThrow();
  });

  it('cite toutes les variables fautives dans un seul message', () => {
    // Corriger une variable à la fois, en relançant à chaque essai, est une perte
    // de temps évitable : le message doit tout dire du premier coup.
    let message = '';
    try {
      parseEnv({});
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('APP_URL');
    expect(message).toContain('BETTER_AUTH_SECRET');
    expect(message).toContain('.env.example');
  });

  // --- Authentification (DEC-032, ADR-006) -----------------------------------

  it('refuse un BETTER_AUTH_SECRET absent', () => {
    expect(() => parseEnv({ ...valid, BETTER_AUTH_SECRET: undefined })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });

  it('refuse un BETTER_AUTH_SECRET trop court', () => {
    // Un secret court rend attaquable la signature de toutes les sessions :
    // c'est un refus au démarrage, pas un avertissement.
    expect(() => parseEnv({ ...valid, BETTER_AUTH_SECRET: 'trop-court' })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });

  it("refuse un BETTER_AUTH_URL qui n'est pas une URL absolue", () => {
    expect(() => parseEnv({ ...valid, BETTER_AUTH_URL: '/api/auth' })).toThrow(/BETTER_AUTH_URL/);
  });

  // --- Invitations (DEC-045) -------------------------------------------------

  describe('INVITATION_TTL_DAYS', () => {
    it('vaut 7 jours quand elle est absente', () => {
      expect(parseEnv(valid).INVITATION_TTL_DAYS).toBe(7);
    });

    it('accepte une durée valide, lue depuis une chaîne comme le fait process.env', () => {
      expect(parseEnv({ ...valid, INVITATION_TTL_DAYS: '14' }).INVITATION_TTL_DAYS).toBe(14);
    });

    it('accepte les deux bornes, 1 et 30 jours', () => {
      expect(parseEnv({ ...valid, INVITATION_TTL_DAYS: '1' }).INVITATION_TTL_DAYS).toBe(1);
      expect(parseEnv({ ...valid, INVITATION_TTL_DAYS: '30' }).INVITATION_TTL_DAYS).toBe(30);
    });

    /**
     * Un zéro, ou une valeur négative, rendrait toute invitation expirée avant
     * d'être copiée. Un grand nombre ferait d'un lien oublié un accès durable.
     */
    it('refuse zéro, un négatif, et plus de 30 jours', () => {
      for (const bad of ['0', '-3', '31', '365']) {
        expect(() => parseEnv({ ...valid, INVITATION_TTL_DAYS: bad })).toThrow(
          /INVITATION_TTL_DAYS/,
        );
      }
    });

    it("refuse une durée qui n'est pas un entier, ou pas un nombre", () => {
      expect(() => parseEnv({ ...valid, INVITATION_TTL_DAYS: '7.5' })).toThrow(
        /INVITATION_TTL_DAYS/,
      );
      expect(() => parseEnv({ ...valid, INVITATION_TTL_DAYS: 'une semaine' })).toThrow(
        /INVITATION_TTL_DAYS/,
      );
    });
  });

  /**
   * Le secret des routes internes est le seul contrôle qui protège les jobs
   * (DEC-028). Son absence n'a pas la même gravité selon l'environnement, et ces
   * tests figent la différence : tolérée en développement, elle est une panne
   * silencieuse du cœur financier en production, puisque les échéances de loyer
   * ne seraient jamais générées.
   */
  describe('INTERNAL_JOB_SECRET', () => {
    const secret = 'secret-interne-de-job-assez-long-pour-passer';

    it('est facultative en développement et en test', () => {
      expect(parseEnv(valid).INTERNAL_JOB_SECRET).toBeUndefined();
      expect(parseEnv({ ...valid, NODE_ENV: 'test' }).INTERNAL_JOB_SECRET).toBeUndefined();
    });

    it('est requise en production', () => {
      expect(() => parseEnv({ ...valid, NODE_ENV: 'production' })).toThrow(/INTERNAL_JOB_SECRET/);
    });

    it('accepte un secret suffisamment long, y compris en production', () => {
      expect(
        parseEnv({ ...valid, NODE_ENV: 'production', INTERNAL_JOB_SECRET: secret })
          .INTERNAL_JOB_SECRET,
      ).toBe(secret);
    });

    /**
     * `.env.example` porte la ligne `INTERNAL_JOB_SECRET=` pour la rendre
     * visible : un fichier copié tel quel transmet une chaîne vide, et sans
     * cette équivalence le produit refuserait de démarrer en développement pour
     * une variable facultative.
     */
    it('traite une valeur vide comme une absence', () => {
      expect(parseEnv({ ...valid, INTERNAL_JOB_SECRET: '' }).INTERNAL_JOB_SECRET).toBeUndefined();
      expect(
        parseEnv({ ...valid, INTERNAL_JOB_SECRET: '   ' }).INTERNAL_JOB_SECRET,
      ).toBeUndefined();
    });

    it('refuse en production une valeur vide, comme une absence', () => {
      expect(() => parseEnv({ ...valid, NODE_ENV: 'production', INTERNAL_JOB_SECRET: '' })).toThrow(
        /INTERNAL_JOB_SECRET/,
      );
    });

    it('refuse un secret trop court, qui rendrait la route attaquable', () => {
      expect(() => parseEnv({ ...valid, INTERNAL_JOB_SECRET: 'trop-court' })).toThrow(
        /INTERNAL_JOB_SECRET/,
      );
    });
  });
});
