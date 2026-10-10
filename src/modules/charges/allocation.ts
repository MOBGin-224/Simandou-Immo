import type { AllocationMethod } from './constants';

/**
 * Moteur de répartition d'une charge (DEC-029, BR-050, BR-051, Database Schema
 * section 31).
 *
 * Fichier À PART et entièrement PUR : ni base, ni HTTP, ni React, ni horloge.
 * C'est le même choix que `rents/period.ts`, et pour la même raison : le calcul
 * qui décide d'une dette doit pouvoir être vérifié sans monter quoi que ce soit,
 * sur des nombres choisis plutôt que sur un parc réel.
 *
 * **La règle, et elle est entièrement écrite dans DEC-029.**
 *
 * ```text
 * part_de_base = total / nombre_de_logements   (division entière)
 * reste        = total - (part_de_base * nombre_de_logements)
 * ```
 *
 * Le reste est réparti **une unité par logement**, dans l'ordre croissant de la
 * référence d'appartement, jusqu'à épuisement.
 *
 * **Pourquoi une division entière, et non un arrondi.** Les montants sont des
 * ENTIERS d'unité monétaire (DEC-014) : le franc guinéen n'a pas de centime, et
 * la base stocke des `bigint`. Une division flottante produirait 299 999,999…
 * et un arrondi par logement ferait perdre ou inventer quelques francs sur le
 * total, ce que BR-051 interdit.
 *
 * **Pourquoi l'ordre de la référence, et non l'ordre de création.** DEC-029
 * l'impose, et c'est le seul ordre qu'un gestionnaire peut VÉRIFIER à l'écran :
 * il lit « A01 à A04 paient un franc de plus », ce qui s'explique à un
 * locataire. L'ordre de création, invisible, rendrait la même répartition
 * inexplicable.
 *
 * **Déterministe** : les mêmes entrées donnent toujours la même sortie, reste
 * compris. C'est ce qui permet à l'aperçu (API section 28) d'annoncer exactement
 * ce que la publication écrira.
 */

/** Logement concerné par une répartition, réduit à ce qui la détermine. */
export type AllocationUnit = {
  apartmentId: string;
  /** Référence affichée du logement, par exemple `A01`. Décide de l'ordre. */
  number: string;
};

/**
 * Justification du calcul d'une part, telle que `calculation_basis` la stocke
 * (section 31).
 *
 * EXPLICATIVE et jamais source de calcul : elle permet de relire un montant
 * sans le recalculer, ce qui donnerait un autre résultat le jour où un logement
 * est archivé ou ajouté.
 */
export type CalculationBasis = {
  method: AllocationMethod;
  totalAmount: number;
  unitCount: number;
  baseShare: number;
  /** `1` si ce logement a reçu une unité du reste de la division, `0` sinon. */
  roundingAdjustment: 0 | 1;
};

/** Part d'un logement dans une charge. */
export type AllocationShare = {
  apartmentId: string;
  number: string;
  amountDue: number;
  basis: CalculationBasis;
};

/**
 * Compare deux références de logement, dans l'ordre que DEC-029 impose.
 *
 * Comparaison TEXTUELLE, comme le tri de la liste des appartements : « A10 »
 * suit « A09 » à condition que la largeur soit constante, seule convention que
 * la création groupée produise (`generateNumbers`). Le second critère est
 * l'identifiant, et il n'existe que pour rendre l'ordre total : deux logements
 * du même immeuble ne peuvent pas porter la même référence, une contrainte
 * d'unicité l'interdisant, mais un ordre partiel rendrait la répartition non
 * déterministe si cette contrainte venait à changer.
 */
export function compareUnits(a: AllocationUnit, b: AllocationUnit): number {
  const byNumber = a.number.localeCompare(b.number, 'fr');

  return byNumber !== 0 ? byNumber : a.apartmentId.localeCompare(b.apartmentId);
}

/**
 * Répartit un montant à parts égales entre des logements (DEC-029, `EQUAL`).
 *
 * L'invariant de BR-051 est tenu par CONSTRUCTION et non par correction : la
 * somme des parts vaut le total parce que le reste de la division entière est
 * distribué en entier, une unité à la fois. `assertAllocationBalances` le
 * vérifie malgré tout avant d'écrire, parce qu'un invariant que personne ne
 * contrôle finit par être faux.
 *
 * Un appel sans aucun logement est une erreur de PROGRAMMATION et non une
 * entrée refusée : le cas d'usage doit l'avoir écarté avant, un immeuble sans
 * logement n'ayant personne entre qui répartir. Diviser par zéro rendrait
 * `Infinity`, et une créance de `Infinity` franc.
 */
export function allocateEqually(
  totalAmount: number,
  units: readonly AllocationUnit[],
): AllocationShare[] {
  if (units.length === 0) {
    throw new TypeError('Une répartition exige au moins un logement.');
  }

  if (!Number.isInteger(totalAmount) || totalAmount < 0) {
    throw new TypeError(`Montant entier positif attendu, reçu « ${totalAmount} ».`);
  }

  const unitCount = units.length;
  const baseShare = Math.floor(totalAmount / unitCount);
  const remainder = totalAmount - baseShare * unitCount;

  return [...units].sort(compareUnits).map((unit, rank) => {
    const roundingAdjustment = rank < remainder ? 1 : 0;

    return {
      apartmentId: unit.apartmentId,
      number: unit.number,
      amountDue: baseShare + roundingAdjustment,
      basis: {
        method: 'EQUAL',
        totalAmount,
        unitCount,
        baseShare,
        roundingAdjustment,
      },
    } satisfies AllocationShare;
  });
}

/**
 * Vue d'ensemble d'une répartition, telle que l'aperçu l'annonce (API section
 * 28).
 *
 * Les quatre nombres que la section demande : le total, le nombre de logements,
 * la part de chacun et « l'éventuel écart d'arrondi », qui est ici le nombre de
 * logements qui paient une unité de plus. Le mot « écart » ne désigne donc pas
 * une perte : la somme des parts vaut toujours le total (BR-051).
 */
export type AllocationSummary = {
  method: AllocationMethod;
  totalAmount: number;
  unitCount: number;
  baseShare: number;
  /** Nombre de logements qui portent une unité du reste de la division. */
  adjustedUnitCount: number;
  /** Somme des parts. Égale au total, et contrôlée comme telle. */
  allocatedAmount: number;
};

export function summarizeAllocation(
  totalAmount: number,
  shares: readonly AllocationShare[],
): AllocationSummary {
  const adjusted = shares.filter((share) => share.basis.roundingAdjustment === 1);

  return {
    method: 'EQUAL',
    totalAmount,
    unitCount: shares.length,
    baseShare: shares[0]?.basis.baseShare ?? 0,
    adjustedUnitCount: adjusted.length,
    allocatedAmount: shares.reduce((sum, share) => sum + share.amountDue, 0),
  };
}

/**
 * Invariant de BR-051, vérifié AVANT toute écriture.
 *
 * ```text
 * somme(charge_allocations.amount_due) = charges.total_amount
 * ```
 *
 * La section 30 l'exige avant la publication et interdit qu'il soit violé
 * ensuite. L'échec est une erreur de programmation, pas une saisie refusée : le
 * moteur le tient par construction, donc une somme fausse signifierait que le
 * calcul a changé sans que ce contrôle ait été revu. Le lever ici annule la
 * transaction de publication en entier, ce qui est exactement ce que BR-052
 * demande : soit toutes les créances sont créées, soit aucune.
 */
export function assertAllocationBalances(
  totalAmount: number,
  shares: readonly AllocationShare[],
): void {
  const allocated = shares.reduce((sum, share) => sum + share.amountDue, 0);

  if (allocated !== totalAmount) {
    throw new Error(
      `Répartition incohérente : ${allocated} réparti pour un total de ${totalAmount}.`,
    );
  }
}
