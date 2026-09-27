import type { ReactNode } from 'react';

import { cn } from '@/lib/ui/cn';

/**
 * Carte (Component Specification section 22, MVP-UI-005).
 *
 * Sur mobile, la carte remplace le tableau : une ligne de tableau à cinq colonnes
 * est illisible sur un téléphone, et c'est l'écran de référence (MVP-UI-001).
 *
 * La variante `interactive` ne rend RIEN cliquable par elle-même : elle prépare
 * le survol d'une carte dont le contenu porte un lien. Rendre la carte entière
 * cliquable en attachant un gestionnaire à un `<div>` la retirerait de la
 * navigation clavier.
 */
export type CardProps = {
  as?: 'div' | 'li' | 'article' | 'section';
  interactive?: boolean;
  className?: string;
  children: ReactNode;
};

export function Card({ as: Tag = 'div', interactive = false, className, children }: CardProps) {
  return (
    <Tag
      className={cn(
        'rounded-lg border border-line bg-surface p-4 shadow-sm',
        interactive && 'transition-shadow hover:shadow-md focus-within:shadow-md',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
