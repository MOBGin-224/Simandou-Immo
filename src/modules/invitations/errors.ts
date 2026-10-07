/**
 * Erreurs du noyau Invitations (MVP-ENG-029, ADR-008, DEC-046).
 *
 * Elles vivent ICI et non dans le module qui invite, parce qu'elles ne dépendent
 * d'aucun rôle : un lien inutilisable, une invitation qui n'est plus ouverte, un
 * compte indisponible se disent exactement de la même façon pour un gestionnaire
 * et pour un locataire. DEC-046 a déplacé `InvitationInvalidError` du module
 * Gestionnaires vers ce noyau ; ses trois voisines ont suivi pour la même raison,
 * la règle d'isolation des modules interdisant au module Locataires d'importer
 * les erreurs du module Gestionnaires.
 *
 * Ce qui reste propre à un rôle reste chez lui : `ManagerValidationError` et
 * `ManagerStateError` dans `managers`, leurs équivalents locataires dans
 * `tenants`. Le partage s'arrête à ce qui est réellement commun.
 *
 * Aucune dépendance : ni base, ni HTTP, ni rôle. La couche HTTP les reconnaît par
 * leur NOM, que `tests/http/errors.test.ts` confronte à ces vraies classes.
 */

/**
 * Lien d'invitation inutilisable, SANS dire pourquoi (ADR-008).
 *
 * Inconnu, expiré, révoqué, déjà accepté, d'un autre rôle, compte indisponible,
 * contexte disparu depuis l'émission : une seule erreur, un seul message. Les
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

/**
 * Opération refusée parce que l'invitation n'est plus ouverte.
 *
 * Côté INVITANT, qui connaît l'invitation : le motif est donc dit, car il oriente
 * la correction. Il ne faut pas confondre avec `InvitationInvalidError`, côté
 * invité, qui n'en dit jamais rien.
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
 * Numéro qui ne peut pas être invité : compte suspendu ou archivé.
 *
 * Le message n'explique volontairement pas pourquoi. Dire « ce compte est
 * suspendu » apprendrait à l'invitant l'état du compte d'une personne qui n'est
 * pas encore liée à lui.
 */
export class InvitationTargetUnavailableError extends Error {
  constructor() {
    super('Cette personne ne peut pas être invitée.');
    this.name = 'InvitationTargetUnavailableError';
  }
}
