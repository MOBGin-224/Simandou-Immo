import type { ReactNode } from 'react';

import { cn } from '@/lib/ui/cn';

/**
 * Badge et badge de statut (Component Specification sections 19 et 20).
 *
 * Les tons reprennent les états fonctionnels de la charte (DEC-012). Chaque badge
 * porte un TEXTE en plus de sa couleur : un utilisateur daltonien doit lire le
 * statut, pas le deviner, et c'est une règle explicite de la charte.
 */
export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<BadgeTone, string> = {
  neutral: 'border-line bg-canvas text-muted',
  success: 'border-success/20 bg-success/10 text-success',
  warning: 'border-warning/20 bg-warning/10 text-warning',
  danger: 'border-danger/20 bg-danger/10 text-danger',
  info: 'border-info/20 bg-info/10 text-info',
};

export type BadgeProps = {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
};

export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Statut d'archivage d'un immeuble (DEC-020).
 *
 * Un immeuble n'a pas de colonne `status` : il est actif tant que `archived_at`
 * est nul. Le badge traduit cet état, et rien d'autre.
 *
 * L'actif n'est pas affiché en vert : le vert signale un succès, « payé » ou
 * « résolu » (MVP-UI-011). Un immeuble actif est l'état normal, donc neutre, et
 * réserver la couleur à ce qui mérite l'attention garde celle-ci disponible.
 */
export function PropertyStatusBadge({ archived }: { archived: boolean }) {
  return archived ? <Badge tone="warning">Archivé</Badge> : <Badge tone="neutral">Actif</Badge>;
}

/**
 * Statut d'occupation d'un appartement (DEC-019).
 *
 * Trois valeurs seulement : Vacant, Occupé, En maintenance. `ARCHIVED` n'en fait
 * pas partie, l'archivage étant porté par `archived_at` (DEC-020) : un logement
 * archivé garde donc son dernier statut d'occupation, et l'archive s'affiche par
 * un badge distinct, à côté.
 *
 * Le choix des tons suit MVP-UI-011. « Occupé » est en vert parce que c'est
 * l'objectif d'un bailleur, un logement loué étant un logement qui produit.
 * « Vacant » est neutre et non rouge : un logement vide n'est pas une anomalie,
 * c'est une situation à traiter. « En maintenance » est en orange, seul état qui
 * appelle réellement une action.
 */
export type ApartmentStatusValue = 'VACANT' | 'OCCUPIED' | 'MAINTENANCE';

const APARTMENT_STATUS_BADGES: Record<ApartmentStatusValue, { tone: BadgeTone; label: string }> = {
  VACANT: { tone: 'neutral', label: 'Vacant' },
  OCCUPIED: { tone: 'success', label: 'Occupé' },
  MAINTENANCE: { tone: 'warning', label: 'En maintenance' },
};

export function ApartmentStatusBadge({ status }: { status: ApartmentStatusValue }) {
  const badge = APARTMENT_STATUS_BADGES[status];

  return <Badge tone={badge.tone}>{badge.label}</Badge>;
}

/** Badge d'archive, commun à toutes les entités archivables (DEC-020). */
export function ArchivedBadge() {
  return <Badge tone="warning">Archivé</Badge>;
}

/**
 * Statut d'un accès, dans la liste des gestionnaires comme dans celle des
 * locataires (DEC-041, DEC-046, PRD 10.2).
 *
 * Les trois derniers viennent de `user_access.status`. Les deux premiers
 * décrivent une INVITATION qui n'a pas encore d'accès : la personne n'est pas
 * encore gestionnaire, ou pas encore locataire du produit.
 *
 * Un seul composant pour les deux rôles, parce que les cinq valeurs sont
 * exactement les mêmes : deux badges distincts finiraient par ne plus dire la
 * même chose du même état.
 *
 * Les tons suivent MVP-UI-011. « Actif » est en vert : c'est un accès qui
 * fonctionne. « Suspendu » et « Invitation expirée » sont en orange : ce sont les
 * seuls états qui appellent une action. « Révoqué » est en rouge, un état
 * terminal. Chaque badge porte un texte, jamais la couleur seule.
 */
export type AccessStatusValue =
  'INVITED' | 'INVITATION_EXPIRED' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

const ACCESS_STATUS_BADGES: Record<AccessStatusValue, { tone: BadgeTone; label: string }> = {
  INVITED: { tone: 'info', label: 'Invitation en attente' },
  INVITATION_EXPIRED: { tone: 'warning', label: 'Invitation expirée' },
  ACTIVE: { tone: 'success', label: 'Actif' },
  SUSPENDED: { tone: 'warning', label: 'Suspendu' },
  REVOKED: { tone: 'danger', label: 'Révoqué' },
};

export function AccessStatusBadge({ status }: { status: AccessStatusValue }) {
  const badge = ACCESS_STATUS_BADGES[status];

  return <Badge tone={badge.tone}>{badge.label}</Badge>;
}

/**
 * Statut RÉEL d'une invitation, `EXPIRED` dérivé compris (DEC-041).
 *
 * `SENT` se lit comme `PENDING` : aucun envoi automatique n'existe au MVP, la
 * valeur n'est jamais atteinte.
 */
export type InvitationStatusValue = 'PENDING' | 'SENT' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

const INVITATION_STATUS_BADGES: Record<InvitationStatusValue, { tone: BadgeTone; label: string }> =
  {
    PENDING: { tone: 'info', label: 'Invitation en attente' },
    SENT: { tone: 'info', label: 'Invitation en attente' },
    EXPIRED: { tone: 'warning', label: 'Invitation expirée' },
    ACCEPTED: { tone: 'success', label: 'Invitation acceptée' },
    REVOKED: { tone: 'neutral', label: 'Invitation révoquée' },
  };

export function InvitationStatusBadge({ status }: { status: InvitationStatusValue }) {
  const badge = INVITATION_STATUS_BADGES[status];

  return <Badge tone={badge.tone}>{badge.label}</Badge>;
}

/**
 * Statut d'un bail (DEC-021, BR-030).
 *
 * Les tons suivent MVP-UI-011. « En cours » est en vert : c'est un bail qui
 * produit, et c'est l'objectif d'un bailleur. « Clôturé » est neutre et non
 * rouge : un bail qui s'achève normalement n'est pas une anomalie, c'est
 * l'histoire du logement. « Brouillon » et « Annulé » ne sont pas atteints au
 * MVP, l'énumération ayant été figée d'emblée pour les lots suivants : ils sont
 * traduits quand même, pour qu'une donnée inattendue s'affiche en français
 * plutôt qu'en majuscules anglaises.
 */
export type LeaseStatusValue = 'DRAFT' | 'ACTIVE' | 'ENDED' | 'CANCELLED';

const LEASE_STATUS_BADGES: Record<LeaseStatusValue, { tone: BadgeTone; label: string }> = {
  DRAFT: { tone: 'info', label: 'Brouillon' },
  ACTIVE: { tone: 'success', label: 'En cours' },
  ENDED: { tone: 'neutral', label: 'Clôturé' },
  CANCELLED: { tone: 'neutral', label: 'Annulé' },
};

export function LeaseStatusBadge({ status }: { status: LeaseStatusValue }) {
  const badge = LEASE_STATUS_BADGES[status];

  return <Badge tone={badge.tone}>{badge.label}</Badge>;
}
