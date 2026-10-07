import type { InvitationPreviewMode, InvitationStatus } from '@/modules/invitations';

import type { TenantListStatus } from './constants';

/**
 * Vues du module Locataires (DEC-046, DEC-051).
 *
 * Ce que le service renvoie aux routes et aux écrans. Jamais une ligne de base
 * brute : un champ ajouté demain à une table ne doit pas se retrouver exposé par
 * accident, et le hachage d'un jeton ne doit jamais pouvoir quitter le serveur.
 *
 * **Le locataire est une PERSONNE** (DEC-051), identifiée par `users.id`. Son
 * accès au produit est un attribut de sa relation avec l'organisation, pas son
 * identité : `accessId` peut donc être nul, et c'est le cas normal du locataire
 * qui n'utilisera jamais l'application.
 *
 * **La ressource est le couple personne et organisation.** `users` ne porte pas
 * d'organisation, à dessein : une personne peut être locataire chez deux
 * bailleurs, et chaque relation a son propre accès, son propre logement et son
 * propre statut.
 */

/** Logement, tel que l'écran l'affiche. */
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
 * D'où vient le logement affiché.
 *
 * Le bail fait foi dès qu'il y en a un ; l'invitation ne sert qu'en son absence,
 * parce qu'au Lot 7 elle portait le logement faute de bail (DEC-046). Les deux
 * peuvent diverger, si l'on invite une personne sur un logement puis qu'on lui en
 * loue un autre : le dire évite un écran qui se contredit.
 */
export type ApartmentSource = 'LEASE' | 'INVITATION' | 'NONE';

/**
 * Un locataire dans une organisation : la personne, et sa relation.
 *
 * `id` est l'identifiant de la PERSONNE. Il se répète d'une organisation à
 * l'autre lorsqu'une même personne est locataire chez deux bailleurs : c'est le
 * couple `(id, organizationId)` qui identifie la relation.
 */
export type TenantListItem = {
  /** `users.id`, l'identité métier du locataire (DEC-051). */
  id: string;
  organizationId: string;
  organizationName: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: TenantListStatus;
  apartment: TenantApartmentRef | null;
  apartmentSource: ApartmentSource;
  /** `user_access.id`, ou `null` si la personne n'a aucun accès au produit. */
  accessId: string | null;
  /** `invitations.id` d'une invitation ENCORE OUVERTE, pour la renvoyer ou la révoquer. */
  invitationId: string | null;
  /** `leases.id` du bail en cours, s'il y en a un. */
  leaseId: string | null;
  /** Émission du lien en vigueur, ou de la dernière invitation acceptée. */
  invitedAt: Date | null;
  /** Acceptation de la dernière invitation : l'instant où l'accès s'est ouvert. */
  activatedAt: Date | null;
  /** Expiration, pour une invitation encore ouverte. */
  expiresAt: Date | null;
};

/**
 * Fiche d'un locataire, telle que le propriétaire ou le gestionnaire la consulte.
 *
 * Même contenu qu'un élément de liste, plus les dates de changement d'état de
 * l'accès, qui n'ont de sens que sur la fiche.
 */
export type TenantDetailView = TenantListItem & {
  /** Dernier changement de statut de l'accès, s'il y en a un. */
  statusChangedAt: Date | null;
  revokedAt: Date | null;
};

/** Invitation d'un locataire, telle que l'inviteur la voit. */
export type TenantInvitationView = {
  id: string;
  organizationId: string;
  /** `users.id` de la personne invitée : son identité métier (DEC-051). */
  userId: string | null;
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
 * accorde. Aucun montant n'y figure : l'invitation n'est pas le bail.
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

/**
 * Ordre d'affichage : ce qui appelle une action d'abord.
 *
 * `NO_ACCESS` vient après `ACTIVE` et avant `SUSPENDED` : ce n'est pas un état à
 * corriger, juste un locataire qui n'utilise pas l'application.
 */
const STATUS_ORDER: Record<TenantListStatus, number> = {
  INVITED: 0,
  INVITATION_EXPIRED: 1,
  ACTIVE: 2,
  NO_ACCESS: 3,
  SUSPENDED: 4,
  REVOKED: 5,
};

/** Tri de la liste : par statut, puis par nom. Le nom départage sans tenir compte de la casse ni des accents. */
export function compareTenantItems(a: TenantListItem, b: TenantListItem): number {
  const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];

  if (byStatus !== 0) return byStatus;

  return a.fullName.localeCompare(b.fullName, 'fr', { sensitivity: 'base' });
}

/** Libellé d'un logement, tel qu'on le lit partout : « A01, Résidence Camayenne ». */
export function describeApartment(apartment: TenantApartmentRef | null): string {
  if (!apartment) return 'Aucun logement';

  return `${apartment.number}, ${apartment.propertyName}`;
}

/**
 * La personne a-t-elle un accès au produit ?
 *
 * Ce que suspendre, réactiver et révoquer supposent : ces trois opérations
 * agissent sur le droit d'accès, et une personne qui n'en a pas n'a rien à
 * suspendre (DEC-051).
 */
export function hasProductAccess(tenant: Pick<TenantListItem, 'accessId'>): boolean {
  return tenant.accessId !== null;
}
