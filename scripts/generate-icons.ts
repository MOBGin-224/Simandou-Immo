/**
 * Engendre `src/components/ui/icon.tsx` depuis les SVG officiels de la charte.
 *
 *   npm run icons
 *
 * La commande enchaîne Prettier sur le fichier produit : sans cela, une
 * régénération ferait échouer `format:check` en intégration continue, et le
 * défaut ne se verrait qu'une fois la branche poussée.
 *
 * **La géométrie est COPIÉE, jamais redessinée.** Chaque primitive vient du
 * fichier fourni dans `Identité visuelle/`. Seule la couleur du trait change, de
 * `#123B4A` ou `#FFFFFF` vers `currentColor`, ce que la charte demande
 * explicitement : « couleur héritée du texte, navy par défaut, teal pour
 * l'interactif ».
 *
 * Pourquoi un script plutôt qu'un copier-coller : la charte peut livrer une
 * icône corrigée, et la régénération garantit alors que le produit suit le
 * fichier officiel au pixel près, sans retouche manuelle oubliée.
 *
 * Pourquoi un script plutôt qu'un import de fichier SVG à l'exécution : un
 * `<img src="...svg">` ne peut pas hériter de la couleur du texte, ce qui
 * obligerait à maintenir deux jeux de fichiers, un navy et un blanc. C'est
 * exactement ce que la charte fournit aujourd'hui, et exactement ce qu'il faut
 * éviter dans un produit où une icône change de couleur selon son contexte.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = 'Identité visuelle';
const TARGET = 'src/components/ui/icon.tsx';

/**
 * Les icônes de la charte, dans l'ordre de ses planches.
 *
 * Le nom du produit est celui du fichier officiel, sans accent : il devient un
 * identifiant TypeScript, et `échéances` n'en serait pas un commode.
 */
const ICONS = [
  'immeuble',
  'logement',
  'acces',
  'locataires',
  'paiements',
  'documents',
  'alertes',
  'valide',
  'echeances',
  'recherche',
  'filtres',
  'maintenance',
  'ajouter',
  'chevron',
  'coche',
  'fermer',
  'fleche',
  'grille',
  'information',
  'avertissement',
  'statistiques',
] as const;

/** Primitives d'un fichier officiel, vérifié conforme à la grille de la charte. */
function geometryOf(slug: string): string[] {
  /*
   * Le jeu SANS espace dans le nom porte un trait blanc, celui AVEC espace un
   * trait navy. La géométrie est identique, octet pour octet hors cette couleur :
   * on lit donc l'un des deux et on neutralise la couleur.
   */
  const path = join(SOURCE, `icone-${slug}.svg`);

  if (!existsSync(path)) throw new Error(`Fichier officiel manquant : ${path}`);

  const raw = readFileSync(path, 'utf8');

  // La grille et l'épaisseur du trait sont des règles de la charte : si un
  // fichier livré ne les respecte pas, il faut le savoir avant de l'intégrer.
  if (!raw.includes('viewBox="0 0 24 24"')) throw new Error(`${path} : grille inattendue`);
  if (!raw.includes('stroke-width="2"')) throw new Error(`${path} : trait inattendu`);

  const body = /<\/title>\s*([\s\S]*?)\s*<\/svg>/.exec(raw)?.[1]?.trim();

  if (!body) throw new Error(`${path} : géométrie introuvable`);

  const pieces = body.match(/<[^>]+\/>/g);

  if (!pieces || pieces.length === 0) throw new Error(`${path} : aucune primitive`);

  /*
   * Les attributs employés par ces fichiers, `d`, `x`, `y`, `width`, `height`,
   * `rx`, `cx`, `cy` et `r`, s'écrivent pareil en JSX : aucune conversion n'est
   * nécessaire, et une conversion inutile serait une occasion d'introduire une
   * faute. Le contrôle ci-dessous refuse tout attribut hors de cette liste,
   * plutôt que de le laisser passer silencieusement.
   */
  const allowed = new Set(['d', 'x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r']);

  for (const piece of pieces) {
    for (const [, attribute] of piece.matchAll(/\s([a-zA-Z-]+)="/g)) {
      // `noUncheckedIndexedAccess` : un groupe de capture est typé facultatif,
      // alors que la regex garantit sa présence dès qu'elle correspond.
      if (attribute === undefined || !allowed.has(attribute)) {
        throw new Error(`${path} : attribut inattendu « ${attribute} », à convertir en JSX`);
      }
    }
  }

  return pieces;
}

const entries = ICONS.map((slug) => ({ slug, pieces: geometryOf(slug) }));

const header = `import type { ReactNode } from 'react';

import { cn } from '@/lib/ui/cn';

/**
 * Icônes officielles (charte chapitre 05).
 *
 * **FICHIER ENGENDRÉ par \`npm run icons\` depuis \`Identité visuelle/icone-*.svg\`.**
 * Ne pas le modifier à la main : la géométrie appartient à la charte, et la
 * redessiner ferait diverger le produit de sa marque. Pour ajouter une icône,
 * déposer son fichier officiel, l'ajouter à la liste du script, puis régénérer.
 *
 * Trois règles de la charte sont tenues ici, et ce sont elles qui justifient un
 * composant plutôt qu'un fichier importé :
 *
 *   1. **la couleur est héritée du texte.** Les fichiers fournis portent un trait
 *      en dur, navy dans un jeu et blanc dans l'autre. \`currentColor\` remplace
 *      les deux : dans un bouton primaire l'icône devient blanche, dans un
 *      libellé elle devient navy, sans deux jeux de fichiers à maintenir ;
 *   2. **grille 24, trait 2 px**, terminaisons et angles arrondis ;
 *   3. **une icône ne remplace jamais un libellé** si l'action n'est pas
 *      évidente. D'où \`label\` : fourni, l'icône s'annonce ; absent, elle est
 *      décorative et masquée aux lecteurs d'écran, ce qui est le cas normal
 *      quand un texte l'accompagne déjà.
 */
export type IconName =`;

const lines: string[] = [header];

entries.forEach((entry, index) => {
  lines.push(`  | '${entry.slug}'${index === entries.length - 1 ? ';' : ''}`);
});

lines.push(`
/** Tailles courantes de la charte. 24 par défaut, la taille de la grille. */
export type IconSize = 16 | 20 | 24 | 32;

export type IconProps = {
  name: IconName;
  size?: IconSize;
  /** Nom accessible. Omis, l'icône est décorative et masquée. */
  label?: string;
  className?: string;
};

const SHAPES: Record<IconName, ReactNode> = {`);

for (const entry of entries) {
  lines.push(`  ${entry.slug}: (`);
  lines.push('    <>');
  for (const piece of entry.pieces) {
    lines.push(`      ${piece}`);
  }
  lines.push('    </>');
  lines.push('  ),');
}

lines.push(`};

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
}`);

writeFileSync(TARGET, `${lines.join('\n')}\n`, 'utf8');

console.log(`${entries.length} icônes engendrées depuis la charte.`);
console.log(`Écrit dans ${TARGET}`);
