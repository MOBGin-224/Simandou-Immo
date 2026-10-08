import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * Ce fichier existe pour une raison précise.
 *
 * La charte graphique officielle, version 2.0 d'octobre 2026, est la source de
 * vérité visuelle du produit. Ses valeurs vivent dans `src/app/globals.css`, et
 * rien n'empêche techniquement quelqu'un d'en changer une au passage, pour faire
 * tenir une maquette ou parce qu'un ton « rend mieux ». Le produit dériverait
 * alors de sa marque sans que rien ne le signale.
 *
 * Ce test confronte donc le fichier de tokens aux valeurs du document. Il est
 * volontairement BÊTE : il ne juge rien, il vérifie que ce qui est écrit dans la
 * charte est écrit dans le code. Le faire échouer demande un geste délibéré, et
 * c'est exactement ce qu'on veut d'un changement d'identité visuelle.
 *
 * Même esprit que `tests/authorization/permissions.test.ts`, qui confronte le
 * catalogue de permissions à sa documentation.
 */
const TOKENS = readFileSync('src/app/globals.css', 'utf8');

describe('Charte graphique, valeurs figées', () => {
  describe('Couleurs de marque (charte page 15)', () => {
    const BRAND: [string, string][] = [
      ['Deep Navy', '#123b4a'],
      ['Digital Teal', '#138a8a'],
      ['Teal profond', '#0f7373'],
      ['Bright Blue', '#3b8dff'],
      ['Structural Blue', '#2a67b1'],
      ['Teal secondaire', '#2b9a8f'],
    ];

    it.each(BRAND)('%s vaut %s', (_name, value) => {
      expect(TOKENS).toContain(value);
    });
  });

  describe('Neutres (charte page 17)', () => {
    const NEUTRALS: [string, string][] = [
      ['Background', '#f7f9f8'],
      ['Surface', '#ffffff'],
      ['Surface subtle', '#eef2f1'],
      ['Border', '#dce4e5'],
      ['Border strong', '#cbd5d7'],
      ['Gray 400', '#9aa9ae'],
      ['Muted', '#66747a'],
      ['Gray 700', '#4a5a60'],
      ['Gray 800', '#34444a'],
      ['Gray 900', '#243238'],
      ['Ink', '#172126'],
    ];

    it.each(NEUTRALS)('%s vaut %s', (_name, value) => {
      expect(TOKENS).toContain(value);
    });
  });

  /**
   * Chaque couleur fonctionnelle va avec SON fond, et le fond est une valeur du
   * document, pas une opacité. C'est sur ces couples que la charte a mesuré ses
   * contrastes : 4,8:1 pour le succès et l'alerte, 5,7:1 pour le danger, 5,1:1
   * pour l'information. Calculer le fond par `bg-success/10` donnerait une autre
   * couleur, donc un autre contraste que celui qui est annoncé.
   */
  describe('Couleurs fonctionnelles et leur fond (charte page 17)', () => {
    const FUNCTIONAL: [string, string, string][] = [
      ['Success', '#18794e', '#e8f5ee'],
      ['Warning', '#a15c00', '#fff4de'],
      ['Danger', '#b42318', '#fdecea'],
      ['Info', '#1769aa', '#e8f2fa'],
    ];

    it.each(FUNCTIONAL)('%s vaut %s sur %s', (_name, color, surface) => {
      expect(TOKENS).toContain(color);
      expect(TOKENS).toContain(surface);
    });
  });

  describe('Formes (charte page 24)', () => {
    it('porte les trois rayons du document, 8, 12 et 16 px', () => {
      expect(TOKENS).toContain('--radius-md: 0.5rem');
      expect(TOKENS).toContain('--radius-lg: 0.75rem');
      expect(TOKENS).toContain('--radius-xl: 1rem');
    });

    it('porte la forme pill des badges', () => {
      expect(TOKENS).toContain('--radius-pill');
    });
  });

  /**
   * L'anneau de focus est en BRIGHT BLUE, pas en teal.
   *
   * La charte le fixe à 2 px de Bright Blue avec 2 px de vide, et son chapitre
   * accessibilité ajoute « jamais supprimé, jamais masqué ». Le vide est ce qui
   * le rend lisible sur un bouton plein.
   */
  describe('Focus (charte pages 30 et 34)', () => {
    it('est un anneau de Bright Blue précédé de 2 px de vide', () => {
      expect(TOKENS).toContain('--focus-ring');
      expect(TOKENS).toMatch(/--focus-ring:[^;]*var\(--color-accent\)/);
    });

    it("n'est jamais supprimé : la règle globale existe", () => {
      expect(TOKENS).toContain(':focus-visible');
      expect(TOKENS).toMatch(/:focus-visible\s*\{[^}]*var\(--focus-ring\)/);
    });
  });

  describe('Typographie (charte pages 20 et 21)', () => {
    it('sépare les deux familles, Manrope pour la marque et Inter pour le produit', () => {
      expect(TOKENS).toContain('--font-sans: var(--font-inter)');
      expect(TOKENS).toContain('--font-display: var(--font-manrope)');
    });

    /** Display 48/56, H1 36/44, H2 30/38, H3 24/32, H4 20/28. */
    it('porte les cinq niveaux de titre avec leur interligne', () => {
      const LEVELS: [string, string, string][] = [
        ['display', '3rem', '3.5rem'],
        ['h1', '2.25rem', '2.75rem'],
        ['h2', '1.875rem', '2.375rem'],
        ['h3', '1.5rem', '2rem'],
        ['h4', '1.25rem', '1.75rem'],
      ];

      for (const [name, size, lineHeight] of LEVELS) {
        expect(TOKENS).toContain(`--text-${name}: ${size}`);
        expect(TOKENS).toContain(`--text-${name}--line-height: ${lineHeight}`);
      }
    });

    it('porte l interlettrage de 16 % des surtitres', () => {
      expect(TOKENS).toContain('--tracking-overline: 0.16em');
    });

    /**
     * Chiffres tabulaires pour les données et les montants. Dans une colonne de
     * loyers, des chiffres de largeurs différentes désalignent les unités et
     * rendent deux montants incomparables d'un coup d'oeil.
     */
    it('active les chiffres tabulaires sur les données', () => {
      expect(TOKENS).toContain('font-variant-numeric: tabular-nums');
      expect(TOKENS).toContain('[data-numeric]');
    });
  });

  describe('Mouvement (charte page 37)', () => {
    it('porte les trois durées du document', () => {
      expect(TOKENS).toContain('--duration-fast: 120ms');
      expect(TOKENS).toContain('--duration-base: 180ms');
      expect(TOKENS).toContain('--duration-slow: 250ms');
    });

    it('porte les deux courbes du document', () => {
      expect(TOKENS).toContain('--ease-standard: cubic-bezier(0.2, 0, 0, 1)');
      expect(TOKENS).toContain('--ease-exit: cubic-bezier(0.4, 0, 1, 1)');
    });

    /**
     * « Réduire ou supprimer si l'utilisateur le demande. » Le réglage vient du
     * système, et l'ignorer peut déclencher un malaise chez une personne
     * sensible au mouvement.
     */
    it('respecte le mouvement réduit demandé par le système', () => {
      expect(TOKENS).toContain('prefers-reduced-motion: reduce');
    });
  });

  /**
   * La charte n'en définit pas, et en inventer un anticiperait le Design System
   * final avec des valeurs que personne n'a validées.
   */
  it('ne définit aucun thème sombre', () => {
    expect(TOKENS).not.toContain('prefers-color-scheme');
    expect(TOKENS).toContain('color-scheme: light');
  });
});

/**
 * Le symbole de marque n'a qu'UNE géométrie, celle des fichiers officiels.
 *
 * Le composant la recopie, et ce test la confronte au fichier livré : une
 * retouche du symbole, même bien intentionnée, ferait diverger le produit de sa
 * marque, et la charte l'interdit explicitement, « déformer le logo »,
 * « étirer le symbole », « changer les couleurs ».
 */
describe('Symbole de marque, géométrie officielle', () => {
  const MARK = readFileSync('src/components/brand/brand-mark.tsx', 'utf8');
  const OFFICIAL = readFileSync('Identité visuelle/icone-application-fond-clair.svg', 'utf8');

  /** Les quatre volumes, tels que le fichier officiel les décrit. */
  const VOLUMES = [
    'M21.7 76.7L43.3 65.8V143.7L21.7 135.3V76.7Z',
    'M45.8 45L83.8 25V155.8L58.8 143.3V71.3L45.8 65V45Z',
    'M94.2 43.3L126.2 58V76.3L117.5 79.7V143.3L94.2 155.8V43.3Z',
    'M128.7 75.8L149.2 85V135.3L128.7 143.3V75.8Z',
  ];

  it.each(VOLUMES)('le volume %s vient du fichier officiel', (path) => {
    expect(OFFICIAL).toContain(path);
    expect(MARK).toContain(path);
  });

  /** La boîte du symbole, « 127,5 × 130,8, environ 1 : 1 » (charte page 8). */
  it('garde la boîte du symbole, donc ses proportions', () => {
    expect(MARK).toContain('viewBox="21.7 25 127.5 130.8"');
  });

  /**
   * Sur fond clair, « IMMO » passe en Structural Blue ; sur navy, il reprend le
   * Bright Blue. La charte en donne la raison : sur fond clair le Bright Blue ne
   * tient que 3,3:1 et disparaîtrait.
   */
  it('emploie les deux bleus là où la charte les place', () => {
    expect(MARK).toContain('#3B8DFF');
    expect(MARK).toContain('text-accent-deep');
    expect(MARK).toContain('text-accent');
  });
});
