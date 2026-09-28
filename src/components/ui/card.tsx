import type { ReactNode } from 'react';

import { cn } from '@/lib/ui/cn';

/**
 * Carte (Component Specification section 22, MVP-UI-005).
 *
 * Sur mobile, la carte remplace le tableau : une ligne de tableau à cinq colonnes
 * est illisible sur un téléphone, et c'est l'écran de référence (MVP-UI-001).
 *
 * La variante `interactive` ne rend RIEN cliquable par elle-même : elle prépare
 * le survol, et le positionnement dont a besoin le lien de titre pour étendre sa
 * zone tactile à toute la carte (voir `linkOverlayClasses`). Rendre la carte
 * entière cliquable en attachant un gestionnaire à un `<div>` la retirerait de
 * la navigation clavier.
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
        interactive && 'relative transition-shadow hover:shadow-md focus-within:shadow-md',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * Étend la zone tactile d'un lien de titre à toute sa carte.
 *
 * Mesuré au doigt, et non supposé : sur la liste des appartements à 360 pixels,
 * le lien « A01 » n'offrait que 28 par 22 pixels, là où le projet impose 44
 * pixels de côté pour une cible tactile. Sur un téléphone, viser ce texte
 * demande de l'attention ; c'est le geste le plus fréquent de l'écran.
 *
 * Le pseudo-élément recouvre la carte, qui doit donc être `relative` : c'est ce
 * que pose la variante `interactive`. Le lien RESTE sur le titre, ce qui préserve
 * ce qu'un `<div>` cliquable aurait perdu : l'atteinte au clavier, l'ouverture
 * dans un nouvel onglet, et un nom accessible qui dit où l'on va.
 *
 * À n'utiliser que sur une carte portant UN SEUL lien : un second deviendrait
 * inatteignable au doigt, recouvert par celui-ci.
 */
export const linkOverlayClasses = 'after:absolute after:inset-0 after:content-[""] hover:underline';
