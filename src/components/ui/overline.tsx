import type { ReactNode } from 'react';

import { cn } from '@/lib/ui/cn';

/**
 * Surtitre (charte chapitre 04, règles d'usage).
 *
 * « Surtitres en capitales, interlettrage +16 % ». Ce composant existe parce que
 * ce motif était recopié SOIXANTE-CINQ fois dans les écrans, avec un
 * interlettrage de 2,5 % au lieu de 16 % : une règle typographique recopiée est
 * une règle qui finira par ne plus valoir partout.
 *
 * Un surtitre introduit un BLOC de contenu. Il est donc un titre au sens du
 * document, et son niveau se choisit : `h2` dans une fiche dont le titre de page
 * est le `h1`, `h3` pour une sous-section. Le rendre toujours `h2` casserait la
 * hiérarchie que parcourt un lecteur d'écran.
 *
 * `span` et `dt` existent pour les cas où le texte ÉTIQUETTE une donnée sans
 * ouvrir de section : annoncer un titre là où il n'y a pas de section ferait
 * entendre un plan qui n'existe pas. `dt` est le cas le plus fréquent du produit,
 * les fiches présentant leurs détails en listes de définitions, et il doit rester
 * un `dt` : changé en `span`, le couple terme et définition disparaît pour un
 * lecteur d'écran.
 */
export type OverlineProps = {
  as?: 'h2' | 'h3' | 'h4' | 'span' | 'p' | 'dt';
  children: ReactNode;
  className?: string;
};

export function Overline({ as: Tag = 'h2', children, className }: OverlineProps) {
  return (
    <Tag
      className={cn(
        'font-display text-xs font-semibold tracking-overline uppercase text-muted',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
