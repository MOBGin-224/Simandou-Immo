/**
 * Erreurs métier du module Contrats (MVP-ENG-029).
 *
 * Mêmes absences volontaires qu'ailleurs : aucune erreur « bail inexistant » ni
 * « logement inexistant », car un identifiant inconnu et un identifiant hors
 * périmètre doivent rester indiscernables (ADR-007, ADR-008). Ils lèvent
 * `ResourceOutOfScopeError`, qui appartient au service d'autorisation. Aucune
 * erreur de permission non plus.
 */

/** Détail de validation, par champ, tel qu'un formulaire peut l'afficher. */
export type FieldErrors = Record<string, string[]>;

/**
 * Entrée refusée par le schéma de validation, ou par une règle qui vise un champ.
 *
 * Portée par le cas d'usage et non par l'appelant : la validation appliquée dans
 * chaque route finirait par être oubliée dans l'une d'elles.
 */
export class LeaseValidationError extends Error {
  constructor(readonly fieldErrors: FieldErrors) {
    super('Les données fournies sont invalides.');
    this.name = 'LeaseValidationError';
  }
}

/**
 * Création refusée parce qu'une relation locative active existe déjà.
 *
 * Deux règles distinctes, et le message dit laquelle, car la correction n'est pas
 * la même :
 *
 *   `apartment-occupied`  le LOGEMENT a déjà un bail actif (BR-028). Il faut
 *                         clôturer le bail en cours avant d'en ouvrir un autre.
 *   `tenant-engaged`      la PERSONNE a déjà un bail actif dans cette
 *                         organisation (DEC-049). Une seule relation locative
 *                         active par organisation : c'est au Lot 8 que cette
 *                         règle s'applique, et pas au niveau de l'invitation.
 *
 * Les deux sont aussi portées par un index d'unicité partiel : le pré-contrôle
 * par lecture ne suffit pas, deux créations simultanées passeraient chacune.
 */
export type LeaseConflictReason = 'apartment-occupied' | 'tenant-engaged';

export class LeaseConflictError extends Error {
  constructor(readonly reason: LeaseConflictReason) {
    super(
      reason === 'apartment-occupied'
        ? "Ce logement a déjà un bail en cours. Clôturez-le avant d'en créer un autre."
        : "Cette personne a déjà un bail en cours dans votre organisation. Clôturez-le avant d'en créer un autre.",
    );
    this.name = 'LeaseConflictError';
  }
}

/**
 * Opération refusée parce que le bail n'est pas dans l'état qu'elle suppose.
 *
 * Le refus est EXPLICITE plutôt qu'idempotent : afficher un succès sur une
 * clôture sans effet tromperait l'appelant sur l'état réel du bail. Le motif est
 * dit, car il oriente la correction.
 */
export type LeaseAction = 'update' | 'terminate';
export type LeaseStateValue = 'DRAFT' | 'ACTIVE' | 'ENDED' | 'CANCELLED';

export class LeaseStateError extends Error {
  constructor(
    readonly action: LeaseAction,
    readonly status: LeaseStateValue,
  ) {
    super(LeaseStateError.messageFor(action, status));
    this.name = 'LeaseStateError';
  }

  private static messageFor(action: LeaseAction, status: LeaseStateValue): string {
    if (action === 'terminate') {
      return status === 'ENDED'
        ? 'Ce bail est déjà clôturé.'
        : 'Ce bail a été annulé : il ne se clôture pas.';
    }

    return status === 'ENDED'
      ? 'Un bail clôturé ne se modifie plus : son contenu décrit ce qui a eu lieu.'
      : 'Un bail annulé ne se modifie plus.';
  }
}

/**
 * Clôture refusée parce que la date ne tient pas debout.
 *
 * Distincte d'une erreur de champ : la date est bien formée, c'est sa position
 * dans le temps du bail qui la rend impossible. Une clôture avant le début
 * ferait un bail de durée négative, ce que la base refuse de son côté.
 */
export class LeaseTerminationDateError extends Error {
  constructor(readonly startDate: string) {
    super(`La date de clôture ne peut pas précéder le début du bail, le ${startDate}.`);
    this.name = 'LeaseTerminationDateError';
  }
}
