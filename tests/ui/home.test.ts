import { describe, expect, it } from 'vitest';

import type { Role } from '../../src/lib/authorization/permissions';
import { MANAGEMENT_HOME, TENANT_HOME, homeForRoles } from '../../src/lib/ui/home';

/**
 * Orientation de la racine selon le rôle (DEC-046).
 *
 * Ce test existe parce que la règle est partagée par trois endroits, la racine du
 * produit, le logo de l'en-tête et la redirection qui suit l'acceptation d'une
 * invitation : la figer ici garantit qu'ils ne peuvent pas répondre trois choses
 * différentes à la même question.
 *
 * Le cas qui compte vraiment est le locataire SEUL : `/immeubles` lui répondrait
 * « inexistant », juste après sa connexion.
 */
describe('Accueil selon le rôle', () => {
  const cases: { roles: Role[]; expected: string; why: string }[] = [
    { roles: ['TENANT'], expected: TENANT_HOME, why: 'un locataire va à son logement' },
    { roles: ['OWNER'], expected: MANAGEMENT_HOME, why: 'un propriétaire va au patrimoine' },
    { roles: ['MANAGER'], expected: MANAGEMENT_HOME, why: 'un gestionnaire va au patrimoine' },
    {
      roles: ['OWNER', 'MANAGER'],
      expected: MANAGEMENT_HOME,
      why: 'le cumul de gestion reste de la gestion (DEC-003)',
    },
    {
      roles: ['OWNER', 'TENANT'],
      expected: MANAGEMENT_HOME,
      why: 'la gestion gagne sur le cumul : son espace locataire reste à un clic',
    },
    {
      roles: ['TENANT', 'TENANT'],
      expected: TENANT_HOME,
      why: 'locataire chez deux bailleurs reste un locataire',
    },
  ];

  for (const { roles, expected, why } of cases) {
    it(`${roles.join(' et ')} : ${why}`, () => {
      expect(homeForRoles(roles)).toBe(expected);
    });
  }

  it('renvoie la gestion sans aucun rôle : l enveloppe dira « aucun accès actif »', () => {
    expect(homeForRoles([])).toBe(MANAGEMENT_HOME);
  });

  it('ne propose que deux destinations, et aucune autre', () => {
    expect(new Set([MANAGEMENT_HOME, TENANT_HOME]).size).toBe(2);
    expect(MANAGEMENT_HOME).toBe('/immeubles');
    expect(TENANT_HOME).toBe('/mon-logement');
  });
});
