import { describe, expect, it } from 'vitest';

import { safeNextPath } from '../../src/lib/http/next-path';

/**
 * Destination d'une redirection demandée par l'URL.
 *
 * Un paramètre qui décide où l'on atterrit après la connexion est un classique de
 * l'hameçonnage. La règle est une LISTE FERMÉE, pas un refus des adresses
 * externes : tout ce qui n'y figure pas vaut `null`.
 */
describe('Redirection après connexion', () => {
  const TOKEN = 'aB3_-'.repeat(8) + 'xyz'; // 43 caractères
  const PATH = `/invitation/${TOKEN}`;

  it('accepte le lien d une invitation', () => {
    expect(TOKEN).toHaveLength(43);
    expect(safeNextPath(PATH)).toBe(PATH);
  });

  it('refuse une adresse absolue vers un autre site', () => {
    expect(safeNextPath('https://site-pirate.example')).toBeNull();
    expect(safeNextPath(`https://site-pirate.example${PATH}`)).toBeNull();
    expect(safeNextPath('http://localhost:3000/immeubles')).toBeNull();
  });

  it('refuse une adresse relative au protocole, qui désigne un autre site', () => {
    expect(safeNextPath('//site-pirate.example')).toBeNull();
    expect(safeNextPath(`//site-pirate.example${PATH}`)).toBeNull();
    expect(safeNextPath('/\\site-pirate.example')).toBeNull();
  });

  it('refuse les autres chemins du produit, même internes', () => {
    expect(safeNextPath('/immeubles')).toBeNull();
    expect(safeNextPath('/api/v1/sessions/revoke')).toBeNull();
    expect(safeNextPath('/connexion')).toBeNull();
    expect(safeNextPath('/')).toBeNull();
  });

  it("refuse un jeton qui n'a pas la forme exacte", () => {
    expect(safeNextPath('/invitation/')).toBeNull();
    expect(safeNextPath('/invitation/court')).toBeNull();
    expect(safeNextPath(`/invitation/${'a'.repeat(42)}`)).toBeNull();
    expect(safeNextPath(`/invitation/${'a'.repeat(44)}`)).toBeNull();
    expect(safeNextPath(`/invitation/${'a'.repeat(42)}!`)).toBeNull();
  });

  it('refuse tout résidu après le jeton', () => {
    expect(safeNextPath(`${PATH}/`)).toBeNull();
    expect(safeNextPath(`${PATH}?x=1`)).toBeNull();
    expect(safeNextPath(`${PATH}#ancre`)).toBeNull();
    expect(safeNextPath(`${PATH}/../../immeubles`)).toBeNull();
    expect(safeNextPath(`${PATH} `)).toBeNull();
  });

  it('refuse un retour à la ligne, qui permettrait d injecter un en-tête', () => {
    expect(safeNextPath(`${PATH}\n`)).toBeNull();
    expect(safeNextPath(`${PATH}\r\nSet-Cookie: x=1`)).toBeNull();
    expect(safeNextPath(`\n${PATH}`)).toBeNull();
  });

  it("refuse ce qui n'est pas du texte", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath(42)).toBeNull();
    expect(safeNextPath(['/invitation/x'])).toBeNull();
    expect(safeNextPath({})).toBeNull();
  });

  it('refuse la chaîne vide', () => {
    expect(safeNextPath('')).toBeNull();
  });
});
