/**
 * Verdict de l'audit de rendu mobile (DEC-040).
 *
 * Ce module est volontairement PUR : aucun navigateur, aucune entrée-sortie. Il
 * reçoit ce que `audit.ts` a mesuré dans la page et décide ce qui est un défaut.
 * C'est la seule partie de l'outil dont un test peut dire si elle juge bien, et
 * c'est elle qui porte les seuils du projet.
 */

/** Hauteur minimale d'une cible tactile, seuil imposé par le projet. */
export const MIN_TARGET_PX = 44;

export type Target = {
  el: string;
  w: number;
  h: number;
  /** Vrai pour un lien noyé dans un texte, qui n'a pas de boîte propre. */
  inline: boolean;
  /**
   * Zone RÉELLEMENT atteignable, mesurée par `elementFromPoint` de part et
   * d'autre du centre. Absente quand la boîte de l'élément suffit.
   *
   * Elle existe parce qu'un lien peut étendre sa zone par un pseudo-élément qui
   * recouvre son conteneur : la boîte de l'élément ment alors sur ce qui est
   * touchable. Les titres de carte du Lot 5 faisaient 28 par 22 px et
   * s'atteignaient pourtant sur environ 150 par 84 px.
   */
  hitW?: number;
  hitH?: number;
};

export type Overflow = {
  el: string;
  left: number;
  right: number;
  /** Vrai dans un conteneur défilant voulu : ce n'est pas un défaut. */
  inScroller: boolean;
};

export type Clipped = {
  el: string;
  axis: 'x' | 'y';
  scroll: number;
  client: number;
  ellipsis?: boolean;
};

export type PageAudit = {
  label: string;
  width: number;
  url: string;
  vw: number;
  docScrollWidth: number;
  overflowX: Overflow[];
  targets: Target[];
  clipped: Clipped[];
  tinyText: { el: string; size: string }[];
  /** Décomptes annoncés à l'écran, à confronter à la réalité par un humain. */
  counts: string[];
  h1: string | null;
};

export type Problem = {
  /** `error` fait échouer la commande, `info` est signalé sans la faire échouer. */
  severity: 'error' | 'info';
  kind:
    | 'viewport'
    | 'page-scroll'
    | 'overflow'
    | 'small-target'
    | 'narrow-target'
    | 'clipped'
    | 'ellipsis'
    | 'tiny-text';
  message: string;
};

/** Hauteur qui compte : la zone atteignable quand elle a été mesurée, sinon la boîte. */
export function effectiveHeight(target: Target): number {
  return target.hitH ?? target.h;
}

export function findProblems(page: PageAudit): Problem[] {
  const problems: Problem[] = [];

  /*
   * Une émulation qui n'a pas pris est pire qu'une absence de mesure : elle
   * rassure à tort. C'est le piège que DEC-040 existe pour éviter.
   */
  if (page.vw < page.width) {
    problems.push({
      severity: 'error',
      kind: 'viewport',
      message: `largeur demandée ${page.width} px mais viewport mesuré ${page.vw} px : l'émulation n'a pas été appliquée`,
    });
  }

  /*
   * Le débordement se compare à la largeur DEMANDÉE, jamais au viewport mesuré.
   *
   * En émulation mobile, comme sur un vrai téléphone, un contenu plus large que
   * l'écran ne fait pas défiler la page : Chrome élargit le viewport pour le
   * contenir. `scrollWidth` et le viewport restent alors égaux, et une règle
   * « scrollWidth supérieur au viewport » ne se déclencherait JAMAIS. Un test
   * témoin avec un bloc de 500 px a livré un viewport de 500 px, sans erreur.
   *
   * Le même signe apparaît quand on demande moins que le plancher de Chrome, vers
   * 330 px : 240 px demandés livrent 330 px. D'où les deux causes dans le message.
   */
  const widest = Math.max(page.vw, page.docScrollWidth);
  if (widest > page.width) {
    problems.push({
      severity: 'error',
      kind: 'page-scroll',
      message:
        `la page est plus large que l'écran de ${page.width} px (${widest} px mesurés) : un contenu déborde, ` +
        `ou la largeur demandée est sous le plancher de Chrome, vers 330 px`,
    });
  }

  for (const item of page.overflowX) {
    if (item.inScroller) continue;
    problems.push({
      severity: 'error',
      kind: 'overflow',
      message: `${item.el} déborde de l'écran [${item.left}..${item.right}]`,
    });
  }

  for (const target of page.targets) {
    if (effectiveHeight(target) < MIN_TARGET_PX) {
      const reach =
        target.hitH === undefined ? '' : `, atteignable ${target.hitW ?? '?'}x${target.hitH}`;
      problems.push({
        severity: 'error',
        kind: 'small-target',
        message:
          `${target.el} : cible de ${target.w}x${target.h}${reach}, sous ${MIN_TARGET_PX} px de haut` +
          (target.inline ? ' (lien dans un texte)' : ''),
      });
    } else if (target.hitW !== undefined && target.hitW < MIN_TARGET_PX) {
      problems.push({
        severity: 'info',
        kind: 'narrow-target',
        message: `${target.el} : cible étroite, atteignable ${target.hitW}x${target.hitH ?? target.h}`,
      });
    }
  }

  for (const item of page.clipped) {
    problems.push(
      item.ellipsis === true
        ? {
            severity: 'info',
            kind: 'ellipsis',
            message: `${item.el} : texte tronqué par des points de suspension (${item.scroll} pour ${item.client})`,
          }
        : {
            severity: 'error',
            kind: 'clipped',
            message: `${item.el} : texte coupé sur l'axe ${item.axis} (${item.scroll} pour ${item.client})`,
          },
    );
  }

  for (const item of page.tinyText) {
    problems.push({
      severity: 'info',
      kind: 'tiny-text',
      message: `${item.el} : texte à ${item.size}`,
    });
  }

  return problems;
}

/** Résumé lisible d'une page : une ligne d'en-tête, puis un défaut par ligne. */
export function formatPage(page: PageAudit, problems: Problem[]): string {
  const errors = problems.filter((problem) => problem.severity === 'error').length;
  const infos = problems.length - errors;
  const verdict = errors === 0 ? 'OK' : `${errors} DÉFAUT${errors > 1 ? 'S' : ''}`;

  const lines = [
    `${verdict.padEnd(10)} ${page.label} @${page.width}  h1=${JSON.stringify(page.h1)}` +
      `  (${page.targets.length} cibles${infos > 0 ? `, ${infos} remarque${infos > 1 ? 's' : ''}` : ''})`,
  ];

  for (const problem of problems) {
    lines.push(`   ${problem.severity === 'error' ? 'DÉFAUT ' : 'remarque'}  ${problem.message}`);
  }
  for (const count of page.counts) lines.push(`   décompte  ${count}`);

  return lines.join('\n');
}
