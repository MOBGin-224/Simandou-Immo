import type { ReactNode } from 'react';

import { cn } from '@/lib/ui/cn';

/**
 * Icônes officielles (charte chapitre 05).
 *
 * **FICHIER ENGENDRÉ par `npm run icons` depuis `Identité visuelle/icone-*.svg`.**
 * Ne pas le modifier à la main : la géométrie appartient à la charte, et la
 * redessiner ferait diverger le produit de sa marque. Pour ajouter une icône,
 * déposer son fichier officiel, l'ajouter à la liste du script, puis régénérer.
 *
 * Trois règles de la charte sont tenues ici, et ce sont elles qui justifient un
 * composant plutôt qu'un fichier importé :
 *
 *   1. **la couleur est héritée du texte.** Les fichiers fournis portent un trait
 *      en dur, navy dans un jeu et blanc dans l'autre. `currentColor` remplace
 *      les deux : dans un bouton primaire l'icône devient blanche, dans un
 *      libellé elle devient navy, sans deux jeux de fichiers à maintenir ;
 *   2. **grille 24, trait 2 px**, terminaisons et angles arrondis ;
 *   3. **une icône ne remplace jamais un libellé** si l'action n'est pas
 *      évidente. D'où `label` : fourni, l'icône s'annonce ; absent, elle est
 *      décorative et masquée aux lecteurs d'écran, ce qui est le cas normal
 *      quand un texte l'accompagne déjà.
 */
export type IconName =
  | 'immeuble'
  | 'logement'
  | 'acces'
  | 'locataires'
  | 'paiements'
  | 'documents'
  | 'alertes'
  | 'valide'
  | 'echeances'
  | 'recherche'
  | 'filtres'
  | 'maintenance'
  | 'ajouter'
  | 'chevron'
  | 'coche'
  | 'fermer'
  | 'fleche'
  | 'grille'
  | 'information'
  | 'avertissement'
  | 'statistiques';

/** Tailles courantes de la charte. 24 par défaut, la taille de la grille. */
export type IconSize = 16 | 20 | 24 | 32;

export type IconProps = {
  name: IconName;
  size?: IconSize;
  /** Nom accessible. Omis, l'icône est décorative et masquée. */
  label?: string;
  className?: string;
};

const SHAPES: Record<IconName, ReactNode> = {
  immeuble: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01" />
      <path d="M10 21v-3h4v3" />
    </>
  ),
  logement: (
    <>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  acces: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9M16 7l3 3M14 9l2 2" />
    </>
  ),
  locataires: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M17 14c2.8 0 4.5 1.8 4.5 4.5" />
    </>
  ),
  paiements: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h13v4" />
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M16 13.5h2" />
    </>
  ),
  documents: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </>
  ),
  alertes: (
    <>
      <path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z" />
      <path d="M10 21h4" />
    </>
  ),
  valide: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.7 2.7L16 9.5" />
    </>
  ),
  echeances: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  recherche: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  filtres: (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
  maintenance: (
    <>
      <path d="M14.5 6.5a4 4 0 0 1 5 5L10 21a2.1 2.1 0 1 1-3-3z" />
      <path d="M14.5 6.5l3 3" />
    </>
  ),
  ajouter: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  chevron: (
    <>
      <path d="M9 6l6 6-6 6" />
    </>
  ),
  coche: (
    <>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </>
  ),
  fermer: (
    <>
      <path d="M6 6l12 12M18 6L6 18" />
    </>
  ),
  fleche: (
    <>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </>
  ),
  grille: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  information: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  avertissement: (
    <>
      <path d="M12 3.5l9.5 16.5h-19z" />
      <path d="M12 10v4.5M12 17.2h.01" />
    </>
  ),
  statistiques: (
    <>
      <path d="M4 4v16h16" />
      <path d="M8 16v-4M12 16V8M16 16v-6" />
    </>
  ),
};

export function Icon({ name, size = 24, label, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('shrink-0', className)}
    >
      {label ? <title>{label}</title> : null}
      {SHAPES[name]}
    </svg>
  );
}
