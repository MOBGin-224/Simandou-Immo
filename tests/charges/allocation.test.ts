import { describe, expect, it } from 'vitest';

import {
  allocateEqually,
  assertAllocationBalances,
  compareUnits,
  summarizeAllocation,
  type AllocationUnit,
} from '../../src/modules/charges/allocation';

/**
 * DEC-029 : la répartition égale, et sa règle d'arrondi déterministe.
 *
 * Ces tests ne touchent AUCUNE base : le moteur est pur, et c'est tout l'intérêt
 * de l'avoir écrit à part. Le calcul qui décide de la dette de douze locataires
 * se vérifie donc sur des nombres choisis, y compris ceux qui ne se divisent
 * pas, et non sur un parc fabriqué pour l'occasion.
 *
 * L'invariant de BR-051 est la propriété centrale : la somme des parts vaut
 * toujours le total, sans exception.
 */
describe('Répartition égale d une charge', () => {
  const units = (...numbers: string[]): AllocationUnit[] =>
    numbers.map((number) => ({ apartmentId: `apt-${number}`, number }));

  describe("L'exemple des documents", () => {
    /**
     * L'exemple de référence, repris à l'identique du parcours 18 et de la
     * section 31 : 3 600 000 GNF pour douze appartements, 300 000 chacun.
     */
    it('donne 300 000 GNF à chacun des douze logements pour 3 600 000', () => {
      const twelve = units(
        ...Array.from({ length: 12 }, (_, index) => `A${String(index + 1).padStart(2, '0')}`),
      );

      const shares = allocateEqually(3_600_000, twelve);

      expect(shares).toHaveLength(12);
      expect(new Set(shares.map((share) => share.amountDue))).toEqual(new Set([300_000]));
      expect(shares.reduce((sum, share) => sum + share.amountDue, 0)).toBe(3_600_000);
    });

    it('justifie chaque part par la méthode, le total et le nombre de logements', () => {
      const shares = allocateEqually(3_600_000, units('A01', 'A02', 'A03'));

      expect(shares[0]?.basis).toEqual({
        method: 'EQUAL',
        totalAmount: 3_600_000,
        unitCount: 3,
        baseShare: 1_200_000,
        roundingAdjustment: 0,
      });
    });
  });

  describe("L'arrondi, quand le montant ne se divise pas", () => {
    /**
     * Le cas que la règle existe pour traiter : 100 pour 3 logements. La division
     * entière donne 33, le reste vaut 1, et il va au PREMIER logement dans
     * l'ordre des références.
     */
    it('distribue le reste une unité par logement, dans l ordre des références', () => {
      const shares = allocateEqually(100, units('A01', 'A02', 'A03'));

      expect(shares.map((share) => [share.number, share.amountDue])).toEqual([
        ['A01', 34],
        ['A02', 33],
        ['A03', 33],
      ]);
    });

    it('ne donne jamais plus d une unité de reste au même logement', () => {
      const shares = allocateEqually(3_600_002, units('A01', 'A02', 'A03', 'A04'));

      expect(shares.map((share) => share.amountDue)).toEqual([900_001, 900_001, 900_000, 900_000]);
    });

    it('marque dans la justification les logements qui portent le reste', () => {
      const shares = allocateEqually(10, units('A01', 'A02', 'A03', 'A04'));

      expect(shares.map((share) => share.basis.roundingAdjustment)).toEqual([1, 1, 0, 0]);
      expect(shares.map((share) => share.amountDue)).toEqual([3, 3, 2, 2]);
    });

    /**
     * BR-051, vérifiée sur tous les restes possibles d'un parc donné : quel que
     * soit le montant, la somme des parts vaut le total. C'est la propriété qui
     * interdit qu'un franc apparaisse ou disparaisse dans une facture.
     */
    it('somme toujours au total, pour tout montant et tout nombre de logements', () => {
      for (let unitCount = 1; unitCount <= 13; unitCount += 1) {
        const parc = units(
          ...Array.from(
            { length: unitCount },
            (_, index) => `A${String(index + 1).padStart(2, '0')}`,
          ),
        );

        for (const total of [1, 7, 99, 100, 3_600_000, 3_600_001, 1_234_567]) {
          const shares = allocateEqually(total, parc);

          expect(shares.reduce((sum, share) => sum + share.amountDue, 0)).toBe(total);
          expect(() => assertAllocationBalances(total, shares)).not.toThrow();
        }
      }
    });

    /**
     * Un montant inférieur au nombre de logements : la part de base vaut zéro, et
     * seuls les premiers logements paient une unité. La créance de zéro franc est
     * licite, à la différence d'une charge de zéro franc : la base l'autorise sur
     * une part et l'interdit sur un total.
     */
    it('accepte une part nulle quand le total est plus petit que le parc', () => {
      const shares = allocateEqually(2, units('A01', 'A02', 'A03', 'A04'));

      expect(shares.map((share) => share.amountDue)).toEqual([1, 1, 0, 0]);
    });
  });

  describe("L'ordre, qui rend la répartition explicable", () => {
    it('trie par référence et non par ordre d arrivée', () => {
      const shares = allocateEqually(10, units('B02', 'A01', 'C03'));

      expect(shares.map((share) => share.number)).toEqual(['A01', 'B02', 'C03']);
    });

    it('produit le même résultat quel que soit l ordre des entrées', () => {
      const first = allocateEqually(1_000_001, units('A01', 'A02', 'A03'));
      const second = allocateEqually(1_000_001, units('A03', 'A01', 'A02'));

      expect(second).toEqual(first);
    });

    it('départage deux références identiques par leur identifiant', () => {
      const a = { apartmentId: 'aaa', number: 'A01' };
      const b = { apartmentId: 'bbb', number: 'A01' };

      expect(compareUnits(a, b)).toBeLessThan(0);
      expect(compareUnits(b, a)).toBeGreaterThan(0);
    });
  });

  describe("Ce que l'aperçu annonce", () => {
    it('résume le total, le parc, la part de base et le nombre de parts ajustées', () => {
      const shares = allocateEqually(100, units('A01', 'A02', 'A03'));

      expect(summarizeAllocation(100, shares)).toEqual({
        method: 'EQUAL',
        totalAmount: 100,
        unitCount: 3,
        baseShare: 33,
        adjustedUnitCount: 1,
        allocatedAmount: 100,
      });
    });

    it('annonce zéro part ajustée quand le montant se divise exactement', () => {
      const shares = allocateEqually(900, units('A01', 'A02', 'A03'));

      expect(summarizeAllocation(900, shares).adjustedUnitCount).toBe(0);
    });
  });

  describe('Les refus du moteur', () => {
    /**
     * Répartir sans logement est une erreur de PROGRAMMATION et non une saisie :
     * le cas d'usage doit l'avoir écartée, un immeuble sans logement n'ayant
     * personne entre qui répartir. Diviser par zéro donnerait `Infinity`, et une
     * créance de `Infinity` franc.
     */
    it('refuse une répartition sans aucun logement', () => {
      expect(() => allocateEqually(3_600_000, [])).toThrow(TypeError);
    });

    it('refuse un montant non entier ou négatif', () => {
      expect(() => allocateEqually(100.5, units('A01'))).toThrow(TypeError);
      expect(() => allocateEqually(-100, units('A01'))).toThrow(TypeError);
    });

    /** L'invariant de somme refuse une répartition qu'un calcul futur casserait. */
    it('refuse une somme de parts qui ne vaut pas le total', () => {
      const shares = allocateEqually(100, units('A01', 'A02'));

      expect(() => assertAllocationBalances(101, shares)).toThrow(/Répartition incohérente/);
    });
  });
});
