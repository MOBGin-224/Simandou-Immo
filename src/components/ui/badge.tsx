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
