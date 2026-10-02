import { describe, expect, it } from 'vitest';

import {
  MIN_TARGET_PX,
  effectiveHeight,
  findProblems,
  formatPage,
  type PageAudit,
  type Target,
} from '../../scripts/mobile/report';

/**
 * Verdict de l'audit de rendu mobile (DEC-040).
 *
 * Ces tests figent ce que l'outil considère comme un défaut, car c'est la seule
 * partie de l'outil qui juge. Un seuil déplacé sans le dire ferait passer un
 * écran inutilisable, ou en condamnerait un correct, et personne ne le verrait
 * avant d'avoir un téléphone en main.
 */

/** Une page sans aucun défaut, que chaque test dégrade d'un seul point. */
function cleanPage(overrides: Partial<PageAudit> = {}): PageAudit {
  return {
    label: '/immeubles',
    width: 360,
    url: '/immeubles',
    vw: 360,
    docScrollWidth: 360,
    overflowX: [],
    targets: [{ el: 'button "Rechercher"', w: 111, h: 44, inline: false }],
    clipped: [],
    tinyText: [],
    counts: [],
    h1: 'Immeubles',
    ...overrides,
  };
}

const errors = (page: PageAudit) =>
  findProblems(page).filter((problem) => problem.severity === 'error');

describe('Viewport', () => {
  /**
   * Le piège central de DEC-040, constaté avec une page témoin : en émulation
   * mobile, comme sur un vrai téléphone, un contenu de 500 px ne fait pas défiler
   * la page, Chrome ÉLARGIT le viewport à 500 px. `scrollWidth` et le viewport
   * restent égaux : une règle « scrollWidth supérieur au viewport » ne se
   * déclencherait jamais. Le débordement se lit contre la largeur DEMANDÉE.
   */
  it('un viewport élargi par un contenu trop large est un débordement', () => {
    const [problem] = errors(cleanPage({ width: 360, vw: 500, docScrollWidth: 500 }));

    expect(problem?.kind).toBe('page-scroll');
    expect(problem?.message).toContain('360');
    expect(problem?.message).toContain('500');
  });

  /** Chrome impose un plancher, vers 330 px : demander 240 px livre 330 px. */
  it('une largeur sous le plancher de Chrome est signalée, avec la cause possible', () => {
    const [problem] = errors(cleanPage({ width: 240, vw: 330, docScrollWidth: 330 }));

    expect(problem?.kind).toBe('page-scroll');
    expect(problem?.message).toContain('plancher');
  });

  it("un viewport plus étroit que demandé est une émulation qui n'a pas pris", () => {
    const [problem] = errors(cleanPage({ width: 390, vw: 360, docScrollWidth: 360 }));

    expect(problem?.kind).toBe('viewport');
  });

  it('une largeur obtenue conforme à la demande ne dit rien', () => {
    expect(findProblems(cleanPage({ width: 390, vw: 390, docScrollWidth: 390 }))).toEqual([]);
  });
});

describe('Cibles tactiles', () => {
  it('le seuil du projet est de 44 px', () => {
    expect(MIN_TARGET_PX).toBe(44);
  });

  it('une cible de 44 px de haut est acceptée, 43 px est refusée', () => {
    const at = (h: number): Target => ({ el: 'a "Modifier"', w: 90, h, inline: false });

    expect(errors(cleanPage({ targets: [at(44)] }))).toEqual([]);
    expect(errors(cleanPage({ targets: [at(43)] }))).toHaveLength(1);
  });

  /**
   * Le cas des titres de carte du Lot 5 : 28 par 22 px de boîte, mais un
   * pseudo-élément étend la zone à toute la carte. La boîte ment, la zone
   * atteignable dit vrai.
   */
  it('une petite boîte dont la zone atteignable est grande est acceptée', () => {
    const card: Target = { el: 'a "A01"', w: 28, h: 22, inline: false, hitW: 151, hitH: 112 };

    expect(effectiveHeight(card)).toBe(112);
    expect(errors(cleanPage({ targets: [card] }))).toEqual([]);
  });

  it('une petite boîte sans zone étendue est refusée, avec la zone dans le message', () => {
    const small: Target = { el: 'a "A01"', w: 28, h: 22, inline: false, hitW: 30, hitH: 24 };
    const [problem] = errors(cleanPage({ targets: [small] }));

    expect(problem?.kind).toBe('small-target');
    expect(problem?.message).toContain('atteignable 30x24');
  });

  it('une cible haute mais étroite est une remarque, pas un échec', () => {
    const narrow: Target = { el: 'a "X"', w: 30, h: 44, inline: false, hitW: 30, hitH: 44 };
    const problems = findProblems(cleanPage({ targets: [narrow] }));

    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ severity: 'info', kind: 'narrow-target' });
  });

  it('signale un lien dans un texte sous le seuil, en le précisant', () => {
    const inline: Target = { el: 'a "ici"', w: 20, h: 18, inline: true, hitW: 20, hitH: 18 };
    const [problem] = errors(cleanPage({ targets: [inline] }));

    expect(problem?.message).toContain('lien dans un texte');
  });
});

describe('Débordement', () => {
  it('une page plus large que le viewport est un défaut', () => {
    const [problem] = errors(cleanPage({ docScrollWidth: 374 }));

    expect(problem?.kind).toBe('page-scroll');
    expect(problem?.message).toContain('374');
  });

  /** L'onglet « En maintenance » débordait de 14 px à 360 px au Lot 5. */
  it('un élément qui dépasse le viewport est un défaut', () => {
    const page = cleanPage({
      overflowX: [{ el: 'a "En maintenance"', left: 200, right: 374, inScroller: false }],
    });

    expect(errors(page)).toHaveLength(1);
  });

  it("un élément dans un conteneur défilant voulu n'est pas un défaut", () => {
    const page = cleanPage({
      overflowX: [{ el: 'a "Onglet"', left: 200, right: 500, inScroller: true }],
    });

    expect(findProblems(page)).toEqual([]);
  });
});

describe('Texte coupé', () => {
  it('un texte coupé sans points de suspension est un défaut', () => {
    const page = cleanPage({
      clipped: [{ el: 'span "Résidence Kipe Nord"', axis: 'x', scroll: 212, client: 180 }],
    });

    expect(errors(page)).toHaveLength(1);
  });

  it('un texte tronqué par des points de suspension est une remarque', () => {
    const page = cleanPage({
      clipped: [{ el: 'p "Résidence"', axis: 'x', scroll: 212, client: 180, ellipsis: true }],
    });
    const problems = findProblems(page);

    expect(errors(page)).toEqual([]);
    expect(problems[0]).toMatchObject({ severity: 'info', kind: 'ellipsis' });
  });

  it('un texte sous 12 px est une remarque', () => {
    const page = cleanPage({ tinyText: [{ el: 'span "mention"', size: '10px' }] });

    expect(errors(page)).toEqual([]);
    expect(findProblems(page)).toHaveLength(1);
  });
});

describe('Résumé', () => {
  it('une page propre est annoncée OK, sans ligne de défaut', () => {
    const page = cleanPage();
    const text = formatPage(page, findProblems(page));

    expect(text).toContain('OK');
    expect(text).not.toContain('DÉFAUT');
  });

  it('une page en défaut annonce leur nombre et les détaille', () => {
    const page = cleanPage({
      docScrollWidth: 374,
      targets: [{ el: 'a "A01"', w: 28, h: 22, inline: false }],
    });
    const text = formatPage(page, findProblems(page));

    expect(text).toContain('2 DÉFAUTS');
    expect(text).toContain("la page est plus large que l'écran");
    expect(text).toContain('a "A01"');
  });

  it("reproduit les décomptes annoncés pour qu'un humain les confronte à la liste", () => {
    const page = cleanPage({ counts: ['16 logements · Immeuble Camayenne'] });

    expect(formatPage(page, findProblems(page))).toContain('16 logements · Immeuble Camayenne');
  });
});
