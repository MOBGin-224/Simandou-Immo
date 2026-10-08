import { describe, expect, it } from 'vitest';

import {
  daysInMonth,
  dueDateFor,
  isPastDue,
  leaseCoversPeriod,
  nextPeriod,
  periodEndOf,
  periodOf,
} from '../../src/modules/rents/period';

/**
 * DEC-053 : les trois règles de calendrier que les documents ne tranchaient pas.
 *
 * Ce fichier est le seul endroit où elles sont vérifiées, et il n'a besoin
 * d'aucune base : c'est tout l'intérêt d'avoir gardé `period.ts` pur. Une
 * décision sur l'argent se relit ici, sur des dates choisies, et non au hasard du
 * jour où les tests tournent.
 */
describe('Calendrier des échéances (DEC-053)', () => {
  describe('Longueur des mois', () => {
    it('connaît les mois de 31, 30 et 28 jours', () => {
      expect(daysInMonth(2026, 1)).toBe(31);
      expect(daysInMonth(2026, 4)).toBe(30);
      expect(daysInMonth(2026, 2)).toBe(28);
      expect(daysInMonth(2026, 12)).toBe(31);
    });

    /**
     * L'exception séculaire est le piège classique : 2100 n'est pas bissextile,
     * 2000 l'était. La règle vient de la bibliothèque standard, et ce test
     * interdit de la réécrire à la main un jour.
     */
    it('applique la règle bissextile, exception séculaire comprise', () => {
      expect(daysInMonth(2028, 2)).toBe(29);
      expect(daysInMonth(2000, 2)).toBe(29);
      expect(daysInMonth(2100, 2)).toBe(28);
    });
  });

  describe('Période qui contient un jour', () => {
    it('ramène n importe quel jour au premier du mois', () => {
      expect(periodOf('2026-10-08')).toBe('2026-10-01');
      expect(periodOf('2026-10-01')).toBe('2026-10-01');
      expect(periodOf('2026-10-31')).toBe('2026-10-01');
    });

    it('donne le dernier jour de la période', () => {
      expect(periodEndOf('2026-10-01')).toBe('2026-10-31');
      expect(periodEndOf('2026-02-01')).toBe('2026-02-28');
      expect(periodEndOf('2028-02-01')).toBe('2028-02-29');
    });

    it('passe à la période suivante, changement d année compris', () => {
      expect(nextPeriod('2026-10-01')).toBe('2026-11-01');
      expect(nextPeriod('2026-12-01')).toBe('2027-01-01');
    });

    it('refuse une date qui n est pas une date civile', () => {
      expect(() => periodOf('octobre 2026')).toThrow(TypeError);
      expect(() => periodOf('2026-10')).toThrow(TypeError);
    });
  });

  /**
   * Règle 3 : la date d'échéance est RABATTUE sur le dernier jour du mois, jamais
   * reportée au mois suivant. « Dû le 31 » se lit « dû en fin de mois », et
   * l'échéance reste dans la période qu'elle couvre.
   */
  describe('Date d échéance, règle des mois courts', () => {
    it('garde le jour convenu quand le mois est assez long', () => {
      expect(dueDateFor('2026-10-01', 5)).toBe('2026-10-05');
      expect(dueDateFor('2026-10-01', 31)).toBe('2026-10-31');
      expect(dueDateFor('2026-10-01', 1)).toBe('2026-10-01');
    });

    it('rabat le 31 sur le dernier jour de février, année bissextile comprise', () => {
      expect(dueDateFor('2026-02-01', 31)).toBe('2026-02-28');
      expect(dueDateFor('2028-02-01', 31)).toBe('2028-02-29');
    });

    it('rabat le 31 sur le 30 des mois de trente jours', () => {
      expect(dueDateFor('2026-04-01', 31)).toBe('2026-04-30');
      expect(dueDateFor('2026-11-01', 31)).toBe('2026-11-30');
    });

    it('rabat aussi le 29 et le 30 en février', () => {
      expect(dueDateFor('2026-02-01', 29)).toBe('2026-02-28');
      expect(dueDateFor('2026-02-01', 30)).toBe('2026-02-28');
    });

    /**
     * La date d'échéance ne quitte JAMAIS sa période : c'est la raison pour
     * laquelle le report au 1er du mois suivant a été écarté. Un « Loyer février
     * 2026 » dû en mars se lirait mal partout.
     */
    it('ne fait jamais sortir l échéance de sa période', () => {
      for (const period of ['2026-01-01', '2026-02-01', '2026-04-01', '2028-02-01']) {
        for (const dueDay of [1, 15, 28, 29, 30, 31]) {
          const due = dueDateFor(period, dueDay);

          expect(due >= period).toBe(true);
          expect(due <= periodEndOf(period)).toBe(true);
        }
      }
    });
  });

  /**
   * Règle de RECOUVREMENT, conséquence directe de l'absence de prorata (règle 2) :
   * un bail qui commence en cours de mois doit ce mois-là en entier, sinon ses
   * premiers jours ne seraient facturés nulle part.
   */
  describe('Recouvrement d un bail sur une période', () => {
    const period = '2026-10-01';

    it('recouvre quand le bail a commencé avant la période et n est pas terminé', () => {
      expect(leaseCoversPeriod({ startDate: '2026-01-15', endDate: null }, period)).toBe(true);
    });

    it('recouvre quand le bail commence EN COURS de période', () => {
      expect(leaseCoversPeriod({ startDate: '2026-10-20', endDate: null }, period)).toBe(true);
      expect(leaseCoversPeriod({ startDate: '2026-10-31', endDate: null }, period)).toBe(true);
    });

    it('ne recouvre pas quand le bail commence APRÈS la période', () => {
      expect(leaseCoversPeriod({ startDate: '2026-11-01', endDate: null }, period)).toBe(false);
    });

    it('recouvre quand le bail se termine en cours de période', () => {
      expect(leaseCoversPeriod({ startDate: '2026-01-01', endDate: '2026-10-10' }, period)).toBe(
        true,
      );
      expect(leaseCoversPeriod({ startDate: '2026-01-01', endDate: '2026-10-01' }, period)).toBe(
        true,
      );
    });

    it('ne recouvre pas quand le bail s est terminé AVANT la période', () => {
      expect(leaseCoversPeriod({ startDate: '2026-01-01', endDate: '2026-09-30' }, period)).toBe(
        false,
      );
    });

    it('recouvre un bail qui commence et finit dans la même période', () => {
      expect(leaseCoversPeriod({ startDate: '2026-10-05', endDate: '2026-10-25' }, period)).toBe(
        true,
      );
    });
  });

  describe('Retard', () => {
    it('est en retard le lendemain de l échéance, pas le jour même', () => {
      expect(isPastDue('2026-10-05', '2026-10-05')).toBe(false);
      expect(isPastDue('2026-10-05', '2026-10-06')).toBe(true);
      expect(isPastDue('2026-10-05', '2026-10-04')).toBe(false);
    });
  });
});
