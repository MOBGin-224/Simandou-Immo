import { describe, expect, it } from 'vitest';

import { formatArea, formatDate, formatMoney, pluralize } from '../../src/lib/ui/format';

/**
 * Formatage d'affichage, verrouillé par des tests.
 *
 * Ce fichier existe pour une raison précise, apparue en parcourant les écrans à
 * 360 pixels : les espaces de ces chaînes ne sont pas toutes la même. Celle qui
 * précède une unité ou une devise est INSÉCABLE, sans quoi « 2 500 000 » et
 * « GNF » se séparent en fin de ligne sur une colonne étroite. Une espace
 * ordinaire tapée par inadvertance lors d'une retouche ne se verrait pas à la
 * relecture, et le défaut ne se révélerait que sur un téléphone.
 */
/**
 * Trois espaces différentes cohabitent dans ces chaînes, et les confondre est
 * exactement le défaut que ce fichier doit empêcher.
 */
/** U+00A0, posée par le produit entre une valeur et son unité ou sa devise. */
const NBSP = ' ';
/** U+202F, choisie par `Intl` en français pour séparer les milliers. */
const NNBSP = ' ';

describe('Montants', () => {
  /** DEC-014 : le GNF n'a pas de sous-unité, l'entier s'affiche tel quel. */
  it('affiche un montant en francs guinéens sans décimale', () => {
    expect(formatMoney(2500000, 'GNF')).toBe(`2${NNBSP}500${NNBSP}000${NBSP}GNF`);
  });

  it('sépare la devise du montant par une espace insécable', () => {
    const formatted = formatMoney(1800000, 'GNF');

    expect(formatted.endsWith(`${NBSP}GNF`)).toBe(true);
    expect(formatted).not.toContain(' GNF');
  });

  /** Une devise à sous-unité doit retrouver ses décimales. */
  it('rend ses décimales à une devise qui en a', () => {
    expect(formatMoney(1234, 'EUR')).toBe(`12,34${NBSP}EUR`);
  });

  /** Une devise inconnue ne doit pas faire échouer un affichage. */
  it('traite une devise inconnue comme ayant deux décimales', () => {
    expect(formatMoney(1000, 'XXX')).toBe(`10,00${NBSP}XXX`);
  });

  it('affiche zéro sans le maquiller', () => {
    expect(formatMoney(0, 'GNF')).toBe(`0${NBSP}GNF`);
  });
});

describe('Surfaces', () => {
  it('n affiche les décimales que lorsqu elles renseignent', () => {
    expect(formatArea(78.5)).toBe(`78,5${NBSP}m²`);
    expect(formatArea(95)).toBe(`95${NBSP}m²`);
  });

  it('sépare l unité par une espace insécable', () => {
    expect(formatArea(62.75)).not.toContain(' m²');
    expect(formatArea(62.75)).toBe(`62,75${NBSP}m²`);
  });
});

describe('Dates et pluriels', () => {
  /** Fuseau explicite : la Guinée est à GMT+0 et n'observe pas d'heure d'été. */
  it('affiche une date dans le fuseau de Conakry', () => {
    expect(formatDate('2026-09-28T23:30:00.000Z')).toBe('28 septembre 2026');
  });

  it('accorde le pluriel français', () => {
    expect(pluralize(1, 'logement')).toBe('1 logement');
    expect(pluralize(2, 'logement')).toBe('2 logements');
    expect(pluralize(0, 'logement')).toBe('0 logement');
  });

  it('accepte un pluriel irrégulier', () => {
    expect(pluralize(2, 'logement trouvé', 'logements trouvés')).toBe('2 logements trouvés');
  });
});
