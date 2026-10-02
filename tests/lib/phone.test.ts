import { describe, expect, it } from 'vitest';

import { normalizePhone } from '../../src/lib/phone';

/**
 * Le téléphone est l'identifiant de connexion (DEC-032) : il est comparé tel quel
 * à la valeur stockée. Un seul format est donc stocké.
 */
describe('Normalisation du téléphone', () => {
  it('garde un numéro international propre', () => {
    expect(normalizePhone('+224620000001')).toBe('+224620000001');
  });

  it('retire les espaces, points, tirets et parenthèses que l on tape naturellement', () => {
    expect(normalizePhone('+224 620 00 00 01')).toBe('+224620000001');
    expect(normalizePhone('+224.620.00.00.01')).toBe('+224620000001');
    expect(normalizePhone('+224-620-00-00-01')).toBe('+224620000001');
    expect(normalizePhone('+(224) 620 00 00 01')).toBe('+224620000001');
    expect(normalizePhone('  +224620000001  ')).toBe('+224620000001');
  });

  it('traduit le préfixe 00, usuel pour un appel international', () => {
    expect(normalizePhone('00224620000001')).toBe('+224620000001');
    expect(normalizePhone('00 224 620 00 00 01')).toBe('+224620000001');
  });

  /**
   * Aucun indicatif n'est deviné : un numéro mal saisi deviendrait sinon un numéro
   * valable d'une AUTRE personne, et une invitation partirait vers la mauvaise.
   */
  it('refuse un numéro local, sans deviner l indicatif', () => {
    expect(normalizePhone('620000001')).toBeNull();
    expect(normalizePhone('620 00 00 01')).toBeNull();
    expect(normalizePhone('0620000001')).toBeNull();
  });

  it('refuse ce qui n est pas un numéro', () => {
    for (const value of ['', '   ', 'abc', '+', '+abc', '+22462000000a', '++224620000001']) {
      expect(normalizePhone(value), JSON.stringify(value)).toBeNull();
    }
  });

  it('refuse un numéro trop court ou trop long', () => {
    expect(normalizePhone('+1234567')).toBeNull();
    expect(normalizePhone('+1234567890123456')).toBeNull();
    expect(normalizePhone('+12345678')).toBe('+12345678');
    expect(normalizePhone('+123456789012345')).toBe('+123456789012345');
  });

  it('refuse un indicatif commençant par zéro', () => {
    expect(normalizePhone('+0224620000001')).toBeNull();
  });

  it('est idempotente : normaliser deux fois donne le même résultat', () => {
    const once = normalizePhone('+224 620 00 00 01');

    expect(once).not.toBeNull();
    expect(normalizePhone(once ?? '')).toBe(once);
  });
});
