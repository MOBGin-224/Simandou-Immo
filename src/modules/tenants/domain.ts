import type { InvitationPreviewMode, InvitationStatus } from '@/modules/invitations';

import type { TenantListKind, TenantListStatus } from './constants';

/**
 * Vues du module Locataires (DEC-046).
 *
 * Ce que le service renvoie aux routes et aux écrans. Jamais une ligne de base
 * brute : un champ ajouté demain à une table ne doit pas se retrouver exposé par
 * accident, et le hachage d'un jeton ne doit jamais pouvoir quitter le serveur.
 *
 * **Aucune donnée financière au Lot 7.** Ni montant de loyer, ni état de
 * paiement : ces notions naissent du bail, au Lot 8. Une vue qui porterait un
 * champ vide en attendant obligerait chaque écran à décider quoi en faire.
 */

/** Logement désigné par l'invitation, tel que l'écran l'affiche. */
export type TenantApartmentRef = {
  id: string;
  /** Référence affichée du logement, par exemple A01. */
  number: string;
  propertyId: string;
  propertyName: string;
  /** Vrai si le logement lui-même est archivé (DEC-020). */
  archived: boolean;
};

/**
 * Un élément de la liste des locataires.
 *
 * Réunit deux natures, distinguées par `kind`. Un `ACCESS` est un locataire
 * dont le compte existe, identifié par `user_access.id`. Une `INVITATION` est
 * une personne invitée qui n'a pas encore accepté, identifiée par
 * `invitations.id` : elle n'a pas d'accès tant qu'elle n'a pas accepté
 * (DEC-041, DEC-046).
 *
 * `apartment` peut être nul pour un accès : au Lot 7, le logement d'un locataire
 * est celui que portait son invitation acceptée, et une relation locative créée
 * autrement n'existera qu'au Lot 8.
 */
export type TenantListItem = {
  kind: TenantListKind;
  /** `user_access.id` pour un accès, `invitations.id` pour une invitation. */
  id: string;
  organizationId: string;
  organizationName: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: TenantListStatus;
  apartment: TenantApartmentRef | null;
  /** Émission du lien en vigueur (invitation) ou de la dernière invitation acceptée (accès). */
  invitedAt: Date | null;
  /** Acceptation de la dernière invitation, pour un accès. */
  activatedAt: Date | null;
  /** Expiration, pour une invitation en attente ou expirée. */
  expiresAt: Date | null;
};

/** Invitation d'un locataire, telle que le propriétaire ou le gestionnaire la voit. */
export type TenantInvitationView = {
  id: string;
  organizationId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  /** Statut RÉEL à l'instant de la lecture, `EXPIRED` dérivé compris. */
  status: InvitationStatus;
  issuedAt: Date;
  expiresAt: Date;
  apartment: TenantApartmentRef | null;
};

/**
 * Invitation qui vient d'être émise, ou renvoyée.
 *
 * `token` et `link` ne sont renvoyés qu'ICI, une seule fois : la base ne
 * conserve que le hachage du jeton, donc rien ne permet de les reconstituer
 * ensuite (SEC-INV-002). À afficher aussitôt, et à ne jamais journaliser.
 */
export type IssuedTenantInvitation = {
  invitation: TenantInvitationView;
  token: string;
  link: string;
};

/**
 * Ce que la page publique d'activation affiche à un LOCATAIRE (parcours 9).
 *
 * Le logement remplace la liste d'immeubles de l'invitation de gestionnaire :
 * c'est ce que l'invité reconnaît, et c'est aussi tout ce que l'invitation lui
 * accorde. Aucun montant n'y figure, aucun n'existant avant le bail (DEC-046).
 */
export type TenantInvitationPreview = {
  organizationName: string;
  inviterName: string;
  inviteeName: string;
  /** Identifiant de connexion de l'invité, à lui montrer : c'est avec lui qu'il se connectera. */
  phone: string | null;
  apartmentLabel: string;
  propertyName: string;
  expiresAt: Date;
  mode: InvitationPreviewMode;
  /** Vrai si une session existe mais appartient à un AUTRE compte que l'invité. */
  signedInAsOther: boolean;
};

/** Résultat d'une acceptation, pour que l'appelant ouvre la session. */
export type AcceptedTenantInvitation = {
  userId: string;
  accessId: string;
  organizationId: string;
  phone: string | null;
  /** Vrai si un mot de passe vient d'être défini : l'appelant ouvre alors la session. */
  activatedAccount: boolean;
};

/** Ordre d'affichage : ce qui appelle une action d'abord. */
const STATUS_ORDER: Record<TenantListStatus, number> = {
  INVITED: 0,
  INVITATION_EXPIRED: 1,
  ACTIVE: 2,
  SUSPENDED: 3,
  REVOKED: 4,
};

/** Tri de la liste : par statut, puis par nom. Le nom départage sans tenir compte de la casse ni des accents. */
export function compareTenantItems(a: TenantListItem, b: TenantListItem): number {
  const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];

  if (byStatus !== 0) return byStatus;

  return a.fullName.localeCompare(b.fullName, 'fr', { sensitivity: 'base' });
}

/**
 * Fiche d'un locataire, telle que le propriétaire ou le gestionnaire la consulte.
 *
 * Porte l'identité, le statut d'accès, le logement désigné et les dates
 * d'invitation et d'activation. **Rien de financier** : le loyer et les paiements
 * arrivent avec le bail (DEC-046).
 */
export type TenantDetailView = {
  /** `user_access.id`. */
  id: string;
  userId: string;
  organizationId: string;
  organizationName: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  apartment: TenantApartmentRef | null;
  /** Émission de la dernière invitation acceptée. */
  invitedAt: Date | null;
  /** Acceptation de cette invitation. */
  activatedAt: Date | null;
  /** Dernier changement de statut : suspension, réactivation ou révocation. */
  statusChangedAt: Date;
  revokedAt: Date | null;
};

/** Libellé d'un logement, tel qu'on le lit partout : « A01, Résidence Camayenne ». */
export function describeApartment(apartment: TenantApartmentRef | null): string {
  if (!apartment) return 'Aucun logement';

  return `${apartment.number}, ${apartment.propertyName}`;
}
