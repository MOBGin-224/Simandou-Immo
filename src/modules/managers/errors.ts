/**
 * Erreurs métier du module Gestionnaires (MVP-ENG-029).
 *
 * Mêmes absences volontaires que pour les immeubles et les appartements : aucune
 * erreur « gestionnaire inexistant » ni « invitation inexistante », car un
 * identifiant inconnu et un identifiant hors périmètre doivent rester
 * indiscernables (ADR-007, DEC-025). Ils lèvent `ResourceOutOfScopeError`, qui
 * appartient au service d'autorisation. Aucune erreur de permission non plus.
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
 * Numéro qui ne peut pas être invité : compte suspendu ou archivé.
 *
 * Le message n'explique volontairement pas pourquoi. Dire « ce compte est
 * suspendu » apprendrait à un propriétaire l'état du compte d'une personne qui
 * n'est pas encore liée à lui.
 */
export class InvitationTargetUnavailableError extends Error {
  constructor() {
    super('Cette personne ne peut pas être invitée.');
    this.name = 'InvitationTargetUnavailableError';
  }
}

/**
 * Opération refusée parce que l'invitation n'est plus ouverte.
 *
 * Côté PROPRIÉTAIRE, qui connaît l'invitation : le motif est donc dit, car il
 * oriente la correction. Il ne faut pas confondre avec `InvitationInvalidError`,
 * côté invité, qui n'en dit jamais rien.
 *
 * `superseded` : une invitation plus récente l'a remplacée.
 */
export type InvitationNotOpenReason = 'accepted' | 'revoked' | 'superseded';

export class InvitationNotOpenError extends Error {
  constructor(readonly reason: InvitationNotOpenReason) {
    super(
      reason === 'accepted'
        ? 'Cette invitation a déjà été acceptée.'
        : reason === 'revoked'
          ? 'Cette invitation a été révoquée.'
          : 'Cette invitation a été remplacée par une plus récente.',
    );
    this.name = 'InvitationNotOpenError';
  }
}

/**
 * Lien d'invitation inutilisable, SANS dire pourquoi (ADR-008).
 *
 * Inconnu, expiré, révoqué, déjà accepté, d'un autre rôle, compte indisponible,
 * tous les immeubles archivés depuis : une seule erreur, un seul message. Les
 * distinguer apprendrait à qui détient un lien, ou qui en essaie au hasard, si un
 * jeton a existé, s'il a servi, ou si on l'a retiré.
 */
export class InvitationInvalidError extends Error {
  constructor() {
    super(
      "Ce lien d'invitation n'est plus valable. Demandez-en un nouveau à la personne qui vous a invité.",
    );
    this.name = 'InvitationInvalidError';
  }
}

/**
 * Invitation destinée à un compte DÉJÀ ACTIF, présentée sans session de ce compte.
 *
 * Seul cas distinct du lien invalide, parce qu'il faut guider l'invité : se
 * connecter, puis revenir. Aucun mot de passe n'est jamais défini ni modifié par
 * un lien pour un compte actif (DEC-041) : sans cette règle, quiconque détiendrait
 * le lien pourrait réinitialiser le mot de passe de la personne invitée.
 */
export class InvitationLoginRequiredError extends Error {
  constructor() {
    super('Connectez-vous avec le compte invité pour accepter cette invitation.');
    this.name = 'InvitationLoginRequiredError';
  }
}
