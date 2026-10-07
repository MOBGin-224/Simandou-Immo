/**
 * Erreurs métier du module Gestionnaires (MVP-ENG-029).
 *
 * Mêmes absences volontaires que pour les immeubles et les appartements : aucune
 * erreur « gestionnaire inexistant » ni « invitation inexistante », car un
 * identifiant inconnu et un identifiant hors périmètre doivent rester
 * indiscernables (ADR-007, DEC-025). Ils lèvent `ResourceOutOfScopeError`, qui
 * appartient au service d'autorisation. Aucune erreur de permission non plus.
 *
 * Ne restent ici que les erreurs propres au RÔLE de gestionnaire. Celles qui
 * valent pour toute invitation, quel que soit le rôle invité, ont rejoint le
 * noyau `invitations` par DEC-046 : `InvitationInvalidError`,
 * `InvitationLoginRequiredError`, `InvitationNotOpenError` et
 * `InvitationTargetUnavailableError`. Le module Locataires s'en sert aussi, et un
 * module ne doit pas importer les erreurs d'un autre.
 */

/** Détail de validation, par champ, tel qu'un formulaire peut l'afficher. */
export type FieldErrors = Record<string, string[]>;

/**
 * Entrée refusée par le schéma de validation, ou par une règle qui vise un champ.
 *
 * Portée par le cas d'usage et non par l'appelant : la validation appliquée dans
 * chaque route finirait par être oubliée dans l'une d'elles.
 */
export class ManagerValidationError extends Error {
  constructor(readonly fieldErrors: FieldErrors) {
    super('Les données fournies sont invalides.');
    this.name = 'ManagerValidationError';
  }
}

/**
 * Invitation refusée parce que la personne est déjà dans la situation visée.
 *
 * Trois cas, qui n'appellent pas la même correction. La personne est déjà
 * propriétaire de l'organisation : elle n'a besoin d'aucune invitation (DEC-003).
 * Elle est déjà gestionnaire, actif ou suspendu : il faut modifier son périmètre.
 * Une invitation encore valable existe déjà : il faut la renvoyer.
 *
 * Un gestionnaire RÉVOQUÉ n'en fait pas partie : il peut être réinvité (DEC-043).
 */
export type ManagerInvitationConflictReason =
  'already-owner' | 'already-manager' | 'invitation-open';

export class ManagerInvitationConflictError extends Error {
  constructor(readonly reason: ManagerInvitationConflictReason) {
    super(
      reason === 'already-owner'
        ? "Cette personne est déjà propriétaire de l'organisation : elle n'a pas besoin d'invitation."
        : reason === 'already-manager'
          ? 'Cette personne est déjà gestionnaire. Modifiez son périmètre depuis sa fiche.'
          : 'Une invitation encore valable existe déjà pour cette personne. Renvoyez-la depuis la liste.',
    );
    this.name = 'ManagerInvitationConflictError';
  }
}

/**
 * Opération refusée parce que l'accès n'est pas dans l'état qu'elle suppose (DEC-044).
 *
 * Le refus est EXPLICITE plutôt qu'idempotent : afficher un succès sur une
 * suspension sans effet tromperait le propriétaire sur l'état réel de l'accès.
 * Le motif est dit, car il oriente la correction.
 *
 * Un accès RÉVOQUÉ ne se réactive jamais, ne se suspend plus et ne change plus de
 * périmètre : pour lui rendre l'accès, on réinvite la personne (DEC-043).
 */
export type ManagerAction = 'suspend' | 'reactivate' | 'revoke' | 'update-scope';
export type ManagerAccessStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

export class ManagerStateError extends Error {
  constructor(
    readonly action: ManagerAction,
    readonly status: ManagerAccessStatus,
  ) {
    super(ManagerStateError.messageFor(action, status));
    this.name = 'ManagerStateError';
  }

  private static messageFor(action: ManagerAction, status: ManagerAccessStatus): string {
    if (status === 'REVOKED') {
      return action === 'reactivate'
        ? 'Un accès révoqué ne se réactive pas : invitez de nouveau la personne.'
        : action === 'revoke'
          ? 'Cet accès est déjà révoqué.'
          : action === 'update-scope'
            ? "Le périmètre d'un accès révoqué ne se modifie pas : invitez de nouveau la personne."
            : 'Cet accès a été révoqué : il ne peut plus être suspendu.';
    }

    if (status === 'SUSPENDED') return 'Cet accès est déjà suspendu.';

    return 'Cet accès est déjà actif.';
  }
}
