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
    expect(message).toContain('.env.example');
  });
});
