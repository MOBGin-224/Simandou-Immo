import { cn } from '@/lib/ui/cn';

/**
 * Symbole et logotype de SIMANDOU IMMO (charte chapitre 02).
 *
 * **La géométrie du symbole est celle du fichier officiel**
 * `Identité visuelle/icone-application-fond-clair.svg`, recopiée telle quelle
 * avec sa boîte d'origine, `viewBox="21.7 25 127.5 130.8"`, que la charte
 * documente comme « 127,5 × 130,8, environ 1 : 1 ». Rien n'y est redessiné :
 * trois volumes, une seule inclinaison proche de 25°, des interstices nets.
 *
 * Deux règles de la charte commandent les couleurs, et elles ne sont pas
 * symétriques :
 *
 * ```text
 * fond clair   volumes navy + Bright Blue, « IMMO » en Structural Blue
 * fond navy    volumes blancs + Bright Blue, « IMMO » en Bright Blue
 * ```
 *
 * Pourquoi « IMMO » change de bleu : sur fond clair, le Bright Blue ne tient que
 * 3,3:1 et disparaîtrait ; le Structural Blue tient 5,7:1. Sur navy, c'est
 * l'inverse qui se lit. La charte interdit d'ailleurs explicitement le logo sur
 * un fond Bright Blue, « le bleu disparaît ».
 *
 * **Le logotype s'écrit toujours en capitales**, et en Manrope. Il est composé en
 * texte plutôt qu'en image pour une raison d'usage : dans un en-tête, un texte
 * reste sélectionnable, se redimensionne avec les préférences de l'utilisateur et
 * ne pèse rien. Le symbole, lui, est bien le fichier officiel.
 *
 * **Les couleurs du symbole sont écrites en dur, et c'est voulu.** La règle
 * générale du projet interdit un hexadécimal dans un composant : elle protège
 * contre la dérive d'une couleur d'interface. Le logo est l'exception exacte, et
 * pour la raison inverse : la charte interdit d'en changer les couleurs, donc
 * elles ne doivent PAS suivre un token qu'un futur thème pourrait redéfinir. Un
 * logo qui change avec le thème n'est plus un logo.
 *
 * La ZONE DE PROTECTION vaut un quart de la hauteur du symbole sur les quatre
 * côtés. Elle est portée par la marge du composant appelant, et non ici : un
 * `padding` interne empêcherait d'aligner le logo sur la grille de l'écran.
 * Tailles minimales de la charte : 120 px pour le logo complet, 24 px pour le
 * symbole seul.
 */
export type BrandMarkProps = {
  /** Le fond sur lequel la marque est posée. */
  tone?: 'light' | 'navy';
  /**
   * Quand afficher le logotype à côté du symbole.
   *
   * `sm-and-up` existe pour une raison MESURÉE, pas par goût. Le symbole, le
   * logotype, le rôle et la déconnexion sur une seule ligne débordent de 23 px à
   * 360 px, et d'un pixel à 390 px : un palier à 390 a été essayé puis retiré
   * pour cela. La charte autorise explicitement le symbole SEUL, « favicon,
   * application, avatar », et son minimum de 24 px est respecté ; le nom du
   * produit reste porté par le titre de la page et par l'onglet du navigateur.
   *
   * Ce compromis est TEMPORAIRE et disparaîtra avec la navigation basse : la
   * charte y place les actions, « la zone du pouce porte les actions », donc la
   * déconnexion quittera l'en-tête et libérera la place du logotype.
   */
  wordmark?: 'always' | 'sm-and-up' | 'never';
  className?: string;
};

/** Hauteur du symbole seul. 24 px est le minimum de la charte. */
const SYMBOL_CLASSES = 'h-7 w-auto shrink-0';

export function BrandMark({ tone = 'light', wordmark = 'always', className }: BrandMarkProps) {
  const dark = tone === 'navy';

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg
        viewBox="21.7 25 127.5 130.8"
        className={SYMBOL_CLASSES}
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        {/* Les deux unités encadrantes et la face claire de la tour. */}
        <path fill={dark ? '#FFFFFF' : '#123B4A'} d="M21.7 76.7L43.3 65.8V143.7L21.7 135.3V76.7Z" />
        <path
          fill={dark ? '#FFFFFF' : '#123B4A'}
          d="M45.8 45L83.8 25V155.8L58.8 143.3V71.3L45.8 65V45Z"
        />
        {/* La face colorée de la tour, qui crée la profondeur, et l'unité droite. */}
        <path fill="#3B8DFF" d="M94.2 43.3L126.2 58V76.3L117.5 79.7V143.3L94.2 155.8V43.3Z" />
        <path fill="#3B8DFF" d="M128.7 75.8L149.2 85V135.3L128.7 143.3V75.8Z" />
      </svg>

      {wordmark === 'never' ? null : (
        /*
          Une seule ligne, deux couleurs, et aucune espace perdue : « SIMANDOU »
          et « IMMO » forment un mot composé que le lecteur d'écran doit lire
          d'un trait. L'espace est donc dans le texte, pas dans une marge.
        */
        <span
          className={cn(
            'font-display text-sm font-bold tracking-wide whitespace-nowrap sm:tracking-widest',
            dark ? 'text-white' : 'text-brand',
            wordmark === 'sm-and-up' && 'hidden sm:inline',
          )}
        >
          {'SIMANDOU '}
          <span className={dark ? 'text-accent' : 'text-accent-deep'}>IMMO</span>
        </span>
      )}
    </span>
  );
}
