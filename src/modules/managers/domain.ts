import type { InvitationPreviewMode, InvitationStatus } from '@/modules/invitations';

import type { ManagerListKind, ManagerListStatus } from './constants';

/**
 * Vues du module Gestionnaires (DEC-041).
 *
 * Ce que le service renvoie aux routes et aux écrans. Jamais une ligne de base
 * brute : un champ ajouté demain à une table ne doit pas se retrouver exposé par
 * accident, et le hachage d'un jeton ne doit jamais pouvoir quitter le serveur.
 */

/** Immeuble du périmètre, tel que l'écran l'affiche. */
export type ManagerPropertyRef = {
  id: string;
  name: string;
  archived: boolean;
};

/**
 * Un élément de la liste des gestionnaires.
 *
 * Réunit deux natures, distinguées par `kind`. Un `ACCESS` est un gestionnaire,
 * identifié par `user_access.id`. Une `INVITATION` est une personne invitée qui
 * n'a pas encore accepté, identifiée par `invitation.id` : elle n'a pas d'accès
 * tant qu'elle n'a pas accepté (DEC-041).
 */
export type ManagerListItem = {
  kind: ManagerListKind;
  /** `user_access.id` pour un accès, `invitations.id` pour une invitation. */
  id: string;
  organizationId: string;
  organizationName: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: ManagerListStatus;
  /** Immeubles accessibles, ou attribués par l'invitation. Ceux retirés n'y figurent pas. */
  properties: ManagerPropertyRef[];
  /** Émission du lien en vigueur (invitation) ou de la dernière invitation acceptée (accès). */
  invitedAt: Date | null;
  /** Acceptation de la dernière invitation, pour un accès. */
  activatedAt: Date | null;
  /** Expiration, pour une invitation en attente ou expirée. */
  expiresAt: Date | null;
};

/** Invitation d'un gestionnaire, telle que le propriétaire la voit. */
export type ManagerInvitationView = {
  id: string;
  organizationId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  /** Statut RÉEL à l'instant de la lecture, `EXPIRED` dérivé compris. */
  status: InvitationStatus;
  issuedAt: Date;
  expiresAt: Date;
  properties: ManagerPropertyRef[];
};

/**
 * Invitation qui vient d'être émise, ou renvoyée.
 *
 * `token` et `link` ne sont renvoyés qu'ICI, une seule fois : la base ne
 * conserve que le hachage du jeton, donc rien ne permet de les reconstituer
 * ensuite (SEC-INV-002). À afficher aussitôt, et à ne jamais journaliser.
 */
export type IssuedInvitation = {
  invitation: ManagerInvitationView;
  token: string;
  link: string;
};

/**
 * Ce que la page publique d'activation affiche pour un GESTIONNAIRE (parcours 5,
 * étape 3).
 *
 * `mode` dit ce que l'invité doit faire ; il vient du noyau `invitations`, l'état
 * du compte ne dépendant pas du rôle invité (DEC-046).
 */
export type InvitationPreview = {
  organizationName: string;
  inviterName: string;
  inviteeName: string;
  /** Identifiant de connexion de l'invité, à lui montrer : c'est avec lui qu'il se connectera. */
  phone: string | null;
  propertyNames: string[];
  expiresAt: Date;
  mode: InvitationPreviewMode;
  /** Vrai si une session existe mais appartient à un AUTRE compte que l'invité. */
  signedInAsOther: boolean;
};

/** Résultat d'une acceptation, pour que l'appelant ouvre la session. */
export type AcceptedInvitation = {
  userId: string;
  accessId: string;
  organizationId: string;
  phone: string | null;
  /** Vrai si un mot de passe vient d'être défini : l'appelant ouvre alors la session. */
  activatedAccount: boolean;
};

/** Ordre d'affichage : ce qui appelle une action d'abord. */
const STATUS_ORDER: Record<ManagerListStatus, number> = {
  INVITED: 0,
  INVITATION_EXPIRED: 1,
  ACTIVE: 2,
  SUSPENDED: 3,
  REVOKED: 4,
};

/** Tri de la liste : par statut, puis par nom. Le nom départage sans tenir compte de la casse ni des accents. */
export function compareManagerItems(a: ManagerListItem, b: ManagerListItem): number {
  const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];

  if (byStatus !== 0) return byStatus;

  return a.fullName.localeCompare(b.fullName, 'fr', { sensitivity: 'base' });
}

/**
 * Fiche d'un gestionnaire, telle que le propriétaire la consulte (PRD 10.2).
 *
 * Porte les informations minimales du PRD : nom, téléphone, email éventuel, statut,
 * immeubles accessibles, dates d'invitation et d'activation. Les immeubles sont ceux
 * ACTUELLEMENT accessibles : les lignes révoquées n'y figurent pas, un accès révoqué
 * n'en a donc plus aucune.
 */
export type ManagerDetailView = {
  /** `user_access.id`. */
  id: string;
  organizationId: string;
  organizationName: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  properties: ManagerPropertyRef[];
  /** Émission de la dernière invitation acceptée. */
  invitedAt: Date | null;
  /** Acceptation de cette invitation. */
  activatedAt: Date | null;
  /** Dernier changement de statut : suspension, réactivation ou révocation. */
  statusChangedAt: Date;
  revokedAt: Date | null;
};
