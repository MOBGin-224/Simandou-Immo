/**
 * Erreurs métier du module Loyers (MVP-ENG-029).
 *
 * Mêmes absences volontaires qu'ailleurs : aucune erreur « échéance
 * inexistante », car un identifiant inconnu et un identifiant hors périmètre
 * doivent rester indiscernables (ADR-007, ADR-008). Ils lèvent
 * `ResourceOutOfScopeError`, qui appartient au service d'autorisation. Aucune
 * erreur de permission non plus.
 *
 * Et une absence propre à ce lot : **aucune erreur de conflit**. La génération
 * est idempotente par construction, portée par `UNIQUE (lease_id,
 * period_start)` : une échéance qui existe déjà n'est pas un échec, c'est le
 * résultat attendu d'un job rejoué (DEC-028). Elle est comptée comme ignorée, et
 * la réponse le dit.
 */

/** Détail de validation, par champ, tel qu'un formulaire peut l'afficher. */
export type FieldErrors = Record<string, string[]>;

/**
 * Entrée refusée par le schéma de validation, ou par une règle qui vise un champ.
 *
 * Portée par le cas d'usage et non par l'appelant : la validation appliquée dans
 * chaque route finirait par être oubliée dans l'une d'elles.
 */
export class RentValidationError extends Error {
  constructor(readonly fieldErrors: FieldErrors) {
    super('Les données fournies sont invalides.');
    this.name = 'RentValidationError';
  }
}

/**
 * Génération refusée parce qu'elle produirait trop d'écritures d'un coup.
 *
 * Garde-fou d'exploitation, et non une règle métier : une génération normale
 * porte sur une période et sur les baux actifs d'un périmètre, donc son volume
 * suit le nombre de logements loués. Dépasser la borne signale une erreur de
 * périmètre bien plus probablement qu'un parc réel de cette taille, et DEC-028
 * interdit un traitement long dans une requête interactive.
 *
 * Le refus est explicite plutôt que tronqué : créer les cinq cents premières
 * échéances et taire le reste laisserait un parc à moitié facturé sans que
 * personne ne le sache.
 */
export class RentGenerationLimitError extends Error {
  constructor(
    readonly expected: number,
    readonly limit: number,
  ) {
    super(
      `Cette génération créerait ${expected} échéances, au-delà de la limite de ${limit}. Restreignez-la à un immeuble ou à une période.`,
    );
    this.name = 'RentGenerationLimitError';
  }
}
