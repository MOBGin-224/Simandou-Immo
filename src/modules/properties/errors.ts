/**
 * Erreurs métier du module Immeubles (MVP-ENG-029).
 *
 * Elles sont distinctes des erreurs techniques : chacune correspond à une règle
 * du produit et se traduit par un code d'erreur d'API stable, jamais par un
 * message improvisé (API sections 6 et 7).
 *
 * Deux absences sont volontaires.
 *
 * 1. Aucune erreur « immeuble inexistant ». Un identifiant inconnu et un
 *    identifiant hors périmètre doivent être indiscernables, sinon deviner un
 *    identifiant révèle l'existence de données d'une autre organisation. Les
 *    deux cas lèvent donc le `ResourceOutOfScopeError` du service
 *    d'autorisation, traduit en NOT_FOUND (ADR-007, DEC-025).
 *
 * 2. Aucune erreur de permission. Elle appartient au service d'autorisation, qui
 *    est le point de décision unique.
 */

/** Détail de validation, par champ, tel qu'un formulaire peut l'afficher. */
export type FieldErrors = Record<string, string[]>;

/**
 * Entrée refusée par le schéma de validation.
 *
 * Portée par le cas d'usage et non par l'appelant : la validation appliquée dans
 * chaque route finirait par être oubliée dans l'une d'elles.
 */
export class PropertyValidationError extends Error {
  constructor(readonly fieldErrors: FieldErrors) {
    super('Les données fournies sont invalides.');
    this.name = 'PropertyValidationError';
  }
}

/**
 * Deux immeubles d'une même organisation ne peuvent pas porter le même nom.
 *
 * La contrainte d'unicité en base porte sur toutes les lignes, archivées
 * comprises : un immeuble archivé continue donc d'occuper son nom. C'est
 * volontaire, l'archivage préservant l'historique (BR-025, DEC-020) ; libérer le
 * nom rendrait deux lignes homonymes indistinguables dans un journal.
 */
export class PropertyNameAlreadyUsedError extends Error {
  constructor(readonly propertyName: string) {
    super(`Un immeuble nommé « ${propertyName} » existe déjà dans cette organisation.`);
    this.name = 'PropertyNameAlreadyUsedError';
  }
}

/** Pourquoi l'état d'archivage refuse l'opération. */
export type ArchivedPropertyReason = 'already-archived' | 'not-modifiable';

/**
 * Opération refusée en raison de l'archivage.
 *
 * BR-025 conserve l'historique d'un immeuble archivé mais bloque ses opérations
 * futures : le modifier ou l'archiver une seconde fois n'a pas de sens. Le refus
 * est explicite plutôt qu'idempotent, afin que l'interface puisse dire ce qui
 * s'est passé au lieu d'afficher un succès trompeur.
 */
export class ArchivedPropertyError extends Error {
  constructor(readonly reason: ArchivedPropertyReason) {
    super(
      reason === 'already-archived'
        ? 'Cet immeuble est déjà archivé.'
        : 'Un immeuble archivé ne peut plus être modifié.',
    );
    this.name = 'ArchivedPropertyError';
  }
}
