/**
 * Erreurs métier du module Locataires (MVP-ENG-029, DEC-046 à DEC-048).
 *
 * Mêmes absences volontaires qu'ailleurs : aucune erreur « locataire
 * inexistant » ni « logement inexistant », car un identifiant inconnu et un
 * identifiant hors périmètre doivent rester indiscernables (ADR-007, ADR-008).
 * Ils lèvent `ResourceOutOfScopeError`, qui appartient au service
 * d'autorisation. Aucune erreur de permission non plus.
 *
 * Les refus communs à toute invitation, quel que soit le rôle invité, vivent
 * dans le noyau `invitations` : `InvitationInvalidError`,
 * `InvitationLoginRequiredError`, `InvitationNotOpenError` et
 * `InvitationTargetUnavailableError`. Ne restent ici que ceux qui parlent du
 * rôle de locataire.
 */

/** Détail de validation, par champ, tel qu'un formulaire peut l'afficher. */
export type FieldErrors = Record<string, string[]>;

/**
 * Entrée refusée par le schéma de validation, ou par une règle qui vise un champ.
 *
 * Portée par le cas d'usage et non par l'appelant : la validation appliquée dans
 * chaque route finirait par être oubliée dans l'une d'elles.
 */
export class TenantValidationError extends Error {
  constructor(readonly fieldErrors: FieldErrors) {
    super('Les données fournies sont invalides.');
    this.name = 'TenantValidationError';
  }
}

/**
 * Invitation refusée parce que la personne est déjà dans la situation visée.
 *
 * Trois cas, qui n'appellent pas la même correction. La personne est déjà
 * propriétaire de l'organisation : son compte sert déjà à gérer, et lui ouvrir
 * en plus un espace locataire brouillerait les deux points de vue. Elle a déjà
 * un accès locataire actif ou suspendu dans cette organisation : il n'y a rien à
 * inviter. Une invitation encore valable existe déjà : il faut la renvoyer.
 *
 * Un locataire RÉVOQUÉ n'en fait pas partie : il peut être réinvité, comme un
 * gestionnaire révoqué (DEC-043).
 *
 * **Ce n'est PAS la règle de simultanéité de DEC-049.** Celle-ci porte sur la
 * relation locative et s'appliquera au Lot 8, pas au niveau de l'invitation :
 * ici, il ne s'agit que de l'hygiène des invitations et des accès.
 */
export type TenantInvitationConflictReason = 'already-owner' | 'already-tenant' | 'invitation-open';

export class TenantInvitationConflictError extends Error {
  constructor(readonly reason: TenantInvitationConflictReason) {
    super(
      reason === 'already-owner'
        ? "Cette personne est propriétaire de l'organisation : elle ne peut pas être invitée comme locataire."
        : reason === 'already-tenant'
          ? 'Cette personne a déjà un espace locataire dans votre organisation. Ouvrez sa fiche.'
          : 'Une invitation encore valable existe déjà pour cette personne. Renvoyez-la depuis la liste.',
    );
    this.name = 'TenantInvitationConflictError';
  }
}

/**
 * Changement de nom refusé parce que ce nom n'est pas celui de l'appelant
 * (DEC-048, Rôles et permissions section 14).
 *
 * Le nom est modifiable « par le locataire lui-même », et il vit dans `users` :
 * le modifier depuis l'écran d'un propriétaire changerait l'identité de la
 * personne partout, y compris chez un autre bailleur. Le même principe protège
 * déjà le nom d'un compte actif à l'invitation (DEC-041) : il appartient à la
 * personne, pas à celui qui l'invite.
 *
 * Un refus EXPLICITE, en 403, et non un 404 : l'appelant peut lire cette fiche,
 * donc lui cacher l'existence du locataire n'aurait aucun sens. Ce qu'il apprend,
 * c'est seulement une règle du produit.
 */
export class TenantNameNotOwnedError extends Error {
  constructor() {
    super(
      'Seul le locataire peut modifier son nom. Pour corriger une erreur de saisie, révoquez son accès puis invitez-le de nouveau.',
    );
    this.name = 'TenantNameNotOwnedError';
  }
}

/**
 * Opération refusée parce que l'accès n'est pas dans l'état qu'elle suppose
 * (DEC-047).
 *
 * Le refus est EXPLICITE plutôt qu'idempotent : afficher un succès sur une
 * suspension sans effet tromperait l'appelant sur l'état réel de l'accès. Le
 * motif est dit, car il oriente la correction.
 *
 * Un accès RÉVOQUÉ ne se réactive jamais et ne se suspend plus : pour rendre
 * l'accès, on réinvite la personne. Le message rappelle au passage ce que la
 * révocation ne fait pas, puisque c'est la confusion que DEC-047 veut éviter :
 * elle ne termine aucun bail.
 */
export type TenantAction = 'suspend' | 'reactivate' | 'revoke';
export type TenantAccessStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

export class TenantStateError extends Error {
  constructor(
    readonly action: TenantAction,
    readonly status: TenantAccessStatus,
  ) {
    super(TenantStateError.messageFor(action, status));
    this.name = 'TenantStateError';
  }

  private static messageFor(action: TenantAction, status: TenantAccessStatus): string {
    if (status === 'REVOKED') {
      return action === 'reactivate'
        ? 'Un accès révoqué ne se réactive pas : invitez de nouveau la personne.'
        : action === 'revoke'
          ? 'Cet accès est déjà révoqué.'
          : 'Cet accès a été révoqué : il ne peut plus être suspendu.';
    }

    if (status === 'SUSPENDED') return 'Cet accès est déjà suspendu.';

    return 'Cet accès est déjà actif.';
  }
}
