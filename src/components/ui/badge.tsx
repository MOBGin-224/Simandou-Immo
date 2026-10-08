import type { ReactNode } from 'react';

import { cn } from '@/lib/ui/cn';

/**
 * Badge et badge de statut (charte chapitre 06, Component Specification 19 et 20).
 *
 * **Anatomie fixée par la charte** : hauteur 26 px, forme pill, point de 7 px,
 * libellé de 12 px gras, fond teinté, texte ET point dans la couleur
 * fonctionnelle.
 *
 * Le POINT n'est pas un ornement : « jamais la couleur seule, un statut associe
 * toujours une couleur, un point et un libellé ». Il donne une seconde marque
 * visuelle, qui subsiste quand la couleur ne se distingue pas, et il fait tenir
 * la règle même si quelqu'un copie le badge sans son texte.
 *
 * Les fonds viennent des valeurs EXPLICITES de la charte et non d'une opacité :
 * `bg-success/10` donne une autre couleur, donc un autre contraste que les
 * ratios que la charte a mesurés sur ces fonds précis.
 *
 * **Un badge ne se replie jamais et ne se comprime pas.** Vu à l'écran au Lot 9,
 * sur une carte de loyer dont le logement portait un nom long : « En retard »
 * passait sur deux lignes, et la pastille devenait un rectangle à coins arrondis
 * de 40 px de haut. La hauteur de 26 px que la charte fixe n'est tenable qu'avec
 * `whitespace-nowrap`, et `shrink-0` fait céder le TEXTE voisin plutôt que le
 * badge, ce qui suppose que ce voisin porte `min-w-0`. Aucune mesure
 * automatique ne voyait ce défaut : ni débordement, ni texte coupé, ni cible
 * trop petite.
 */
export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<BadgeTone, string> = {
  neutral: 'border-line bg-surface-subtle text-muted',
  success: 'border-success/20 bg-success-surface text-success',
  warning: 'border-warning/20 bg-warning-surface text-warning',
  danger: 'border-danger/20 bg-danger-surface text-danger',
  info: 'border-info/20 bg-info-surface text-info',
};

export type BadgeProps = {
  tone?: BadgeTone;
  /**
   * Afficher le point. Vrai par défaut : la charte le veut sur un STATUT.
   *
   * Un badge qui ne porte pas un statut, un simple compteur par exemple, s'en
   * passe : le point y annoncerait un état qui n'existe pas.
   */
  dot?: boolean;
  children: ReactNode;
  className?: string;
};

export function Badge({ tone = 'neutral', dot = true, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex min-h-6.5 shrink-0 items-center gap-1.5 rounded-pill border px-2.5 text-xs font-bold whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {dot ? (
        // `bg-current` reprend la couleur du texte : le point suit donc le ton
        // sans qu'une seconde table de couleurs puisse diverger de la première.
        <span aria-hidden="true" className="size-1.75 shrink-0 rounded-pill bg-current" />
      ) : null}
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
 * Occupation d'un appartement, DÉRIVÉE de son bail (DEC-050).
 *
 * Deux valeurs seulement : Vacant et Occupé. `ARCHIVED` n'en fait pas partie,
 * l'archivage étant porté par `archived_at` (DEC-020), et il s'affiche par un
 * badge distinct, à côté.
 *
 * **La maintenance a son propre badge**, et vient EN PLUS de celui-ci. Elle n'est
 * pas une occupation : un logement peut être en travaux qu'il soit loué ou vide,
 * et les fondre en un seul badge ferait disparaître « Occupé » dès que des travaux
 * sont déclarés, c'est-à-dire cacherait le bail qui court.
 *
 * Le choix des tons suit MVP-UI-011. « Occupé » est en vert parce que c'est
 * l'objectif d'un bailleur, un logement loué étant un logement qui produit.
 * « Vacant » est neutre et non rouge : un logement vide n'est pas une anomalie,
 * c'est une situation à traiter. « En travaux » est en orange, le seul état qui
 * appelle réellement une action.
 */
export type ApartmentOccupancyValue = 'VACANT' | 'OCCUPIED';

const APARTMENT_OCCUPANCY_BADGES: Record<
  ApartmentOccupancyValue,
  { tone: BadgeTone; label: string }
> = {
  VACANT: { tone: 'neutral', label: 'Vacant' },
  OCCUPIED: { tone: 'success', label: 'Occupé' },
};

export function ApartmentOccupancyBadge({ occupancy }: { occupancy: ApartmentOccupancyValue }) {
  const badge = APARTMENT_OCCUPANCY_BADGES[occupancy];

  return <Badge tone={badge.tone}>{badge.label}</Badge>;
}

/** Travaux déclarés sur un logement. S'affiche à côté de son occupation. */
export function ApartmentMaintenanceBadge() {
  return <Badge tone="warning">En travaux</Badge>;
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
  'NO_ACCESS' | 'INVITED' | 'INVITATION_EXPIRED' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

const ACCESS_STATUS_BADGES: Record<AccessStatusValue, { tone: BadgeTone; label: string }> = {
  /*
   * `NO_ACCESS` n'arrive QUE pour un locataire (DEC-051) : une personne qui
   * occupe un logement sans avoir de compte. Un gestionnaire ne l'atteint
   * jamais, son accès étant la raison même de son existence dans le produit.
   *
   * Ton neutre et non rouge : ne pas utiliser l'application n'est pas une
   * anomalie, c'est le cas courant du locataire qui paie en main propre.
   */
  NO_ACCESS: { tone: 'neutral', label: 'Sans accès' },
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

/**
 * Statut d'une créance, « À venir » comprise (BR-037, DEC-015).
 *
 * Il prend le statut AFFICHÉ et non le statut stocké : « À venir » n'existe pas
 * en base, c'est une dérivation que le serveur calcule et transmet. Le badge ne
 * la recalcule donc pas, et ne lit aucune date : deux endroits qui liraient la
 * date du jour séparément se contrediraient au passage de minuit.
 *
 * Un seul composant pour les DEUX créances du MVP, loyer et charge, puisque
 * l'énumération leur est commune (DEC-015) : le Lot 10 réutilisera celui-ci
 * plutôt que d'en écrire un second qui finirait par ne plus dire la même chose
 * du même état.
 *
 * Les tons suivent MVP-UI-011. « Payé » est en vert, c'est l'argent reçu.
 * « En retard » est en rouge, le seul état vraiment anormal. « Impayé » et
 * « Partiellement payé » sont en orange : ils appellent une action sans être des
 * fautes. « À venir » est en bleu d'information, parce qu'il n'appelle
 * précisément AUCUNE action, et l'afficher en orange ferait de chaque loyer du
 * mois une alerte. « Annulé » est neutre, non rouge : une créance annulée est
 * une décision, pas un incident.
 */
export type ReceivableStatusValue =
  'UPCOMING' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';

const RECEIVABLE_STATUS_BADGES: Record<ReceivableStatusValue, { tone: BadgeTone; label: string }> =
  {
    UPCOMING: { tone: 'info', label: 'À venir' },
    UNPAID: { tone: 'warning', label: 'Impayé' },
    PARTIALLY_PAID: { tone: 'warning', label: 'Partiellement payé' },
    PAID: { tone: 'success', label: 'Payé' },
    OVERDUE: { tone: 'danger', label: 'En retard' },
    CANCELLED: { tone: 'neutral', label: 'Annulé' },
  };

export function ReceivableStatusBadge({ status }: { status: ReceivableStatusValue }) {
  const badge = RECEIVABLE_STATUS_BADGES[status];

  return <Badge tone={badge.tone}>{badge.label}</Badge>;
}
