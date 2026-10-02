import { describe, expect, it } from 'vitest';

import {
  INVITATION_TOKEN_BYTES,
  INVITATION_TOKEN_PATTERN,
  generateInvitationToken,
  hashInvitationToken,
  isWellFormedInvitationToken,
} from '../../src/modules/invitations';

/**
 * SEC-INV-001 et SEC-INV-002 : le jeton d'invitation.
 *
 * Un lien d'invitation est un secret de fait. Ces tests figent ce qui le rend
 * sûr : imprévisible, stocké haché, d'une forme exacte.
 */
describe("Jeton d'invitation", () => {
  it('est imprévisible : 1000 jetons, aucun doublon', () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => generateInvitationToken().token));

    expect(tokens.size).toBe(1000);
  });

  it('porte 256 bits : 32 octets, soit 43 caractères en base64url', () => {
    const { token } = generateInvitationToken();

    expect(INVITATION_TOKEN_BYTES).toBe(32);
    expect(token).toHaveLength(43);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  });

  /** Il se colle dans une adresse et traverse WhatsApp ou un SMS sans être altéré. */
  it("n'emploie que des caractères sûrs dans une adresse", () => {
    for (let index = 0; index < 200; index += 1) {
      expect(generateInvitationToken().token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  it('est haché en SHA-256 hexadécimal, 64 caractères', () => {
    const { token, tokenHash } = generateInvitationToken();

    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toBe(hashInvitationToken(token));
  });

  it('ne se retrouve jamais dans son hachage', () => {
    const { token, tokenHash } = generateInvitationToken();

    expect(tokenHash).not.toContain(token);
    expect(tokenHash).not.toBe(token);
  });

  it('donne le même hachage pour le même jeton, un hachage différent pour un autre', () => {
    const first = generateInvitationToken();
    const second = generateInvitationToken();

    expect(hashInvitationToken(first.token)).toBe(hashInvitationToken(first.token));
    expect(hashInvitationToken(first.token)).not.toBe(hashInvitationToken(second.token));
  });

  /** Valeur de référence : le hachage ne doit jamais changer de nature sans qu'un test le dise. */
  it('reste du SHA-256, vérifié sur une valeur connue', () => {
    expect(hashInvitationToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  describe('Forme attendue', () => {
    it('reconnaît un jeton généré', () => {
      expect(isWellFormedInvitationToken(generateInvitationToken().token)).toBe(true);
    });

    it('refuse ce qui ne peut pas être un jeton, avant toute lecture de la base', () => {
      const refused = [
        '',
        'court',
        'a'.repeat(42),
        'a'.repeat(44),
        `${'a'.repeat(42)}=`,
        `${'a'.repeat(42)}+`,
        `${'a'.repeat(42)}/`,
        `${'a'.repeat(42)} `,
        `${'a'.repeat(42)}\n`,
        "' OR '1'='1",
        '../../etc/passwd',
        `${'a'.repeat(43)}`.replace('a', 'é'),
      ];

      for (const value of refused) {
        expect(isWellFormedInvitationToken(value), JSON.stringify(value)).toBe(false);
      }
    });

    it('expose le motif de la forme', () => {
      expect(INVITATION_TOKEN_PATTERN.test('a'.repeat(43))).toBe(true);
    });
  });
});
