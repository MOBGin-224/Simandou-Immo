import { describe, expect, it } from 'vitest';

import {
  buildInvitationLink,
  effectiveInvitationStatus,
  invitationExpiry,
  invitationPath,
  isInvitationOpen,
  type InvitationStatus,
} from '../../src/modules/invitations';

/**
 * BR-012, DEC-041, DEC-045 : états et expiration d'une invitation.
 *
 * Pures : l'instant courant est un PARAMÈTRE, ce qui rend l'expiration testable
 * sans attendre sept jours.
 */
describe("États d'une invitation", () => {
  const ISSUED = new Date('2026-10-02T09:00:00.000Z');
  const EXPIRES = new Date('2026-10-09T09:00:00.000Z');
  const BEFORE = new Date(EXPIRES.getTime() - 1);

  const invitation = (status: InvitationStatus) => ({ status, expiresAt: EXPIRES });

  describe('Statut réel', () => {
    it('reste ouvert tant que la date n est pas atteinte', () => {
      expect(effectiveInvitationStatus(invitation('PENDING'), BEFORE)).toBe('PENDING');
      expect(effectiveInvitationStatus(invitation('SENT'), BEFORE)).toBe('SENT');
    });

    /** DEC-041 : `EXPIRED` est DÉRIVÉ, jamais écrit par une tâche. */
    it('devient expiré à la date, par dérivation', () => {
      expect(
        effectiveInvitationStatus(invitation('PENDING'), new Date(EXPIRES.getTime() + 1)),
      ).toBe('EXPIRED');
    });

    /**
     * La borne est EXCLUE : à la milliseconde exacte, le lien est déjà périmé. La
     * requête qui consomme le lien applique la même borne (`expires_at > now`).
     */
    it("traite l'instant exact d'expiration comme expiré", () => {
      expect(effectiveInvitationStatus(invitation('PENDING'), EXPIRES)).toBe('EXPIRED');
      expect(isInvitationOpen(invitation('PENDING'), EXPIRES)).toBe(false);
      expect(isInvitationOpen(invitation('PENDING'), BEFORE)).toBe(true);
    });

    it('ne rouvre jamais une invitation acceptée ou révoquée, même avant la date', () => {
      expect(effectiveInvitationStatus(invitation('ACCEPTED'), BEFORE)).toBe('ACCEPTED');
      expect(effectiveInvitationStatus(invitation('REVOKED'), BEFORE)).toBe('REVOKED');
      expect(isInvitationOpen(invitation('ACCEPTED'), BEFORE)).toBe(false);
      expect(isInvitationOpen(invitation('REVOKED'), BEFORE)).toBe(false);
    });

    it('ne transforme pas une invitation acceptée ou révoquée en expirée', () => {
      const late = new Date(EXPIRES.getTime() + 10 * 24 * 60 * 60 * 1000);

      expect(effectiveInvitationStatus(invitation('ACCEPTED'), late)).toBe('ACCEPTED');
      expect(effectiveInvitationStatus(invitation('REVOKED'), late)).toBe('REVOKED');
    });

    it('garde le statut EXPIRED stocké, qui désigne une invitation remplacée', () => {
      expect(effectiveInvitationStatus(invitation('EXPIRED'), BEFORE)).toBe('EXPIRED');
      expect(isInvitationOpen(invitation('EXPIRED'), BEFORE)).toBe(false);
    });
  });

  describe('Durée de validité (DEC-045)', () => {
    it('ajoute le nombre de jours demandé', () => {
      expect(invitationExpiry(ISSUED, 7).toISOString()).toBe('2026-10-09T09:00:00.000Z');
      expect(invitationExpiry(ISSUED, 1).toISOString()).toBe('2026-10-03T09:00:00.000Z');
      expect(invitationExpiry(ISSUED, 30).toISOString()).toBe('2026-11-01T09:00:00.000Z');
    });

    it("ne dépend pas de l'heure d'été ni du fuseau : un jour vaut 24 heures", () => {
      const eve = new Date('2026-03-28T23:00:00.000Z');

      expect(invitationExpiry(eve, 1).getTime() - eve.getTime()).toBe(24 * 60 * 60 * 1000);
    });

    it("ne modifie pas la date d'émission", () => {
      const copy = new Date(ISSUED.getTime());

      invitationExpiry(ISSUED, 7);

      expect(ISSUED.getTime()).toBe(copy.getTime());
    });
  });

  describe('Lien', () => {
    const TOKEN = 'a'.repeat(43);

    it('est construit sur l adresse du site', () => {
      expect(buildInvitationLink('https://immo.example', TOKEN)).toBe(
        `https://immo.example/invitation/${TOKEN}`,
      );
    });

    it("n'ajoute pas de barre en double quand l'adresse se termine par /", () => {
      expect(buildInvitationLink('https://immo.example/', TOKEN)).toBe(
        `https://immo.example/invitation/${TOKEN}`,
      );
      expect(buildInvitationLink('https://immo.example///', TOKEN)).toBe(
        `https://immo.example/invitation/${TOKEN}`,
      );
    });

    it('garde un éventuel port, utile en développement', () => {
      expect(buildInvitationLink('http://localhost:3000', TOKEN)).toBe(
        `http://localhost:3000/invitation/${TOKEN}`,
      );
    });

    it("n'expose que le chemin quand l'adresse du site n'est pas nécessaire", () => {
      expect(invitationPath(TOKEN)).toBe(`/invitation/${TOKEN}`);
    });
  });
});
