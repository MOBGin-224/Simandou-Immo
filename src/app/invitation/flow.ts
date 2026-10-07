import { getDb } from '@/db/client';
import { MANAGEMENT_HOME, TENANT_HOME } from '@/lib/ui/home';
import { InvitationInvalidError, type InvitationPreviewMode } from '@/modules/invitations';
import {
  acceptManagerInvitation,
  previewInvitation as previewManagerInvitation,
  type AcceptInvitationDependencies,
  type InvitationPreview,
} from '@/modules/managers';
import {
  acceptTenantInvitation,
  previewTenantInvitation,
  type TenantInvitationPreview,
} from '@/modules/tenants';

/**
 * Aperçu et acceptation publics, ORIENTÉS SELON LE RÔLE porté par l'invitation
 * (DEC-046, API sections 14 et 16).
 *
 * Deux rôles sont invitables, et chacun a son module : le gestionnaire voit les
 * immeubles qu'on lui confie, le locataire voit son logement. Les routes
 * publiques, elles, sont UNIQUES : le lien reçu par la personne ne dit pas quel
 * rôle il porte, et c'est voulu.
 *
 * **Pourquoi ce fichier vit ici, au-dessus des modules.** Le noyau `invitations`
 * ne contient que des règles pures, sans base de données ; il ne peut donc pas
 * lire le rôle d'un jeton. Et un module ne peut pas appeler l'autre sans créer un
 * cycle. L'orientation appartient donc à la couche qui consomme les deux, c'est-à
 * -dire aux routes et aux pages, qui partagent ce fichier plutôt que de répéter
 * la même cascade trois fois.
 *
 * **Pourquoi chaque module est essayé tour à tour.** Chacun refuse un jeton d'un
 * autre rôle par la MÊME `InvitationInvalidError` qu'un jeton inconnu (ADR-008),
 * et il le fait AVANT toute écriture. Essayer l'un puis l'autre est donc sans
 * effet de bord, et reste indiscernable de l'extérieur : un jeton inconnu,
 * expiré, révoqué ou consommé donne exactement la même réponse qu'un jeton d'un
 * rôle que l'appelant n'attendait pas. Les lectures en trop portent sur une
 * colonne indexée et unique.
 */

/** Rôle invitable, tel que le flux public le découvre. */
export type InvitedRole = 'MANAGER' | 'TENANT';

/**
 * Aperçu, avec le rôle qui dit laquelle des deux formes lire.
 *
 * Union discriminée plutôt qu'un type commun aux champs facultatifs : une page
 * qui affiche un locataire ne doit pas pouvoir lire par distraction la liste
 * d'immeubles d'un gestionnaire.
 */
export type PublicInvitationPreview =
  | { role: 'MANAGER'; manager: InvitationPreview }
  | { role: 'TENANT'; tenant: TenantInvitationPreview };

/** Mode d'aperçu, commun aux deux formes : ce que l'invité doit faire. */
export function previewMode(preview: PublicInvitationPreview): InvitationPreviewMode {
  return preview.role === 'MANAGER' ? preview.manager.mode : preview.tenant.mode;
}

/** Numéro de l'invité, commun aux deux formes : son identifiant de connexion. */
export function previewPhone(preview: PublicInvitationPreview): string | null {
  return preview.role === 'MANAGER' ? preview.manager.phone : preview.tenant.phone;
}

/** Vrai si une session existe mais appartient à un AUTRE compte que l'invité. */
export function previewSignedInAsOther(preview: PublicInvitationPreview): boolean {
  return preview.role === 'MANAGER'
    ? preview.manager.signedInAsOther
    : preview.tenant.signedInAsOther;
}

/**
 * Aperçu d'une invitation, quel que soit le rôle qu'elle porte.
 *
 * Ne modifie rien : consulter un lien ne le consomme pas, un aperçu chargé par un
 * navigateur ou un lecteur de liens ne doit pas brûler l'invitation.
 */
export async function previewPublicInvitation(input: {
  token: string;
  sessionUserId?: string | null;
}): Promise<PublicInvitationPreview> {
  const db = getDb();

  try {
    return { role: 'MANAGER', manager: await previewManagerInvitation(db, input) };
  } catch (error) {
    if (!(error instanceof InvitationInvalidError)) throw error;
  }

  return { role: 'TENANT', tenant: await previewTenantInvitation(db, input) };
}

/**
 * Ce qu'une acceptation réussie apprend à l'appelant.
 *
 * Les quatre premiers champs sont ceux que la route renvoyait déjà avant le
 * Lot 7 : le contrat JSON ne se réduit pas. `role` s'y ajoute, et c'est lui qui
 * dit où conduire la personne.
 */
export type PublicAcceptance = {
  role: InvitedRole;
  userId: string;
  accessId: string;
  organizationId: string;
  phone: string | null;
  /** Vrai si un mot de passe vient d'être défini : l'appelant ouvre alors la session. */
  activatedAccount: boolean;
};

/**
 * Accepte une invitation, quel que soit le rôle qu'elle porte.
 *
 * Chaque module résout le jeton AVANT d'écrire quoi que ce soit et avant même de
 * hacher le mot de passe : un jeton d'un autre rôle ressort donc de la première
 * tentative sans avoir rien touché.
 */
export async function acceptPublicInvitation(
  dependencies: AcceptInvitationDependencies,
  input: { token: string; password?: unknown; sessionUserId?: string | null },
): Promise<PublicAcceptance> {
  const db = getDb();

  try {
    return { role: 'MANAGER', ...(await acceptManagerInvitation(db, dependencies, input)) };
  } catch (error) {
    if (!(error instanceof InvitationInvalidError)) throw error;
  }

  return { role: 'TENANT', ...(await acceptTenantInvitation(db, dependencies, input)) };
}

/**
 * Où conduire la personne après son activation, selon son rôle (DEC-046).
 *
 * Un locataire ne peut pas aller sur `/immeubles` : il n'atteint aucun immeuble.
 * Le mener là lui montrerait un refus, juste après avoir activé son compte. Les
 * deux destinations sont celles de `homeForRoles`, pour que la racine, l'en-tête
 * et cette redirection ne puissent pas diverger.
 */
export const HOME_BY_ROLE: Record<InvitedRole, string> = {
  MANAGER: MANAGEMENT_HOME,
  TENANT: TENANT_HOME,
};
