/**
 * Erreurs métier du module Appartements (MVP-ENG-029).
 *
 * Mêmes absences volontaires que pour les immeubles : aucune erreur
 * « appartement inexistant », un identifiant inconnu et un identifiant hors
 * périmètre devant rester indiscernables (ADR-007, DEC-025), et aucune erreur de
 * permission, qui appartient au service d'autorisation.
 */

/** Détail de validation, par champ, tel qu'un formulaire peut l'afficher. */
export type FieldErrors = Record<string, string[]>;

/**
 * Entrée refusée par le schéma de validation.
 *
 * Portée par le cas d'usage et non par l'appelant : la validation appliquée dans
 * chaque route finirait par être oubliée dans l'une d'elles.
 */
export class ApartmentValidationError extends Error {
  constructor(readonly fieldErrors: FieldErrors) {
    super('Les données fournies sont invalides.');
    this.name = 'ApartmentValidationError';
  }
}

/**
 * Deux appartements d'un même immeuble ne peuvent pas porter la même référence.
 *
 * La contrainte `apartments_property_number_unique` porte sur toutes les lignes,
 * archivées comprises. Un logement archivé continue donc d'occuper sa référence,
 * pour la même raison qu'un immeuble archivé garde son nom : libérer « A04 »
 * rendrait deux lignes homonymes indistinguables dans un historique de bail.
 */
export class ApartmentNumberAlreadyUsedError extends Error {
  constructor(readonly number: string) {
    super(`Un appartement « ${number} » existe déjà dans cet immeuble.`);
    this.name = 'ApartmentNumberAlreadyUsedError';
  }
}

/**
 * Création groupée refusée : des références se répètent, ou existent déjà.
 *
 * Le refus porte sur l'envoi ENTIER et nomme les références fautives. Créer les
 * logements recevables et taire les autres laisserait l'utilisateur devant une
 * structure partielle sans savoir laquelle : sur un onboarding de vingt
 * logements, c'est précisément le moment où il faut être explicite.
 */
export class ApartmentBulkConflictError extends Error {
  constructor(readonly numbers: readonly string[]) {
    super(
      numbers.length === 1
        ? `La référence « ${numbers[0]} » est déjà utilisée dans cet immeuble.`
        : `Ces références sont déjà utilisées dans cet immeuble : ${numbers.join(', ')}.`,
    );
    this.name = 'ApartmentBulkConflictError';
  }
}

/**
 * Opération refusée parce que l'appartement ou son immeuble est archivé.
 *
 * BR-025 conserve l'historique mais bloque les opérations futures. Deux motifs
 * distincts, car ils n'appellent pas la même correction : désarchiver le
 * logement, ou constater que c'est tout l'immeuble qui est sorti de
 * l'exploitation.
 */
export type ArchivedApartmentReason = 'apartment-archived' | 'property-archived';

export class ArchivedApartmentError extends Error {
  constructor(readonly reason: ArchivedApartmentReason) {
    super(
      reason === 'apartment-archived'
        ? 'Cet appartement est archivé et ne peut plus être modifié.'
        : "L'immeuble est archivé : ses appartements ne peuvent plus être modifiés.",
    );
    this.name = 'ArchivedApartmentError';
  }
}

/**
 * Opération refusée parce que l'appartement est déjà archivé.
 *
 * Le refus est explicite plutôt qu'idempotent, comme pour l'immeuble : afficher
 * un succès sur un archivage sans effet tromperait l'utilisateur sur l'état
 * réel du logement (BR-025, DEC-039).
 */
export class AlreadyArchivedApartmentError extends Error {
  constructor() {
    super('Cet appartement est déjà archivé.');
    this.name = 'AlreadyArchivedApartmentError';
  }
}
