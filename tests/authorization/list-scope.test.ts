import { describe, expect, it } from 'vitest';

import type { AccessContext } from '../../src/lib/authorization/access-context';
import {
  organizationsWhereAllowed,
  readablePropertyScopes,
  type PropertyScope,
} from '../../src/lib/authorization/list-scope';
import { PERMISSIONS, type Permission } from '../../src/lib/authorization/permissions';
import { can } from '../../src/lib/authorization/service';

/**
 * Le filtre de liste doit rendre EXACTEMENT le même verdict que `can()`.
 *
 * C'est l'objet principal de ce fichier. Deux chemins décident d'un accès : le
 * point de décision unique, pour une ressource désignée, et la traduction en
 * conditions SQL, pour une collection. S'ils divergent, une liste montre une ligne
 * qu'une consultation refuserait, ou l'inverse. Aucun des deux ne peut donc être
 * tenu pour correct sans l'autre, et ce test les confronte ressource par ressource.
 */

const ORG_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const ORG_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';

const PROPERTY_A1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa101';
const PROPERTY_A2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa102';
const PROPERTY_B1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb101';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const MANAGER_ID = '22222222-2222-4222-8222-222222222222';
const TENANT_ID = '33333333-3333-4333-8333-333333333333';

const owner: AccessContext = {
  userId: OWNER_ID,
  memberships: [{ accessId: 'acc-owner', organizationId: ORG_A, role: 'OWNER', propertyIds: [] }],
};

const manager: AccessContext = {
  userId: MANAGER_ID,
  memberships: [
    {
      accessId: 'acc-manager',
      organizationId: ORG_A,
      role: 'MANAGER',
      propertyIds: [PROPERTY_A1],
    },
  ],
};

const tenant: AccessContext = {
  userId: TENANT_ID,
  memberships: [{ accessId: 'acc-tenant', organizationId: ORG_A, role: 'TENANT', propertyIds: [] }],
};

/** Propriétaire qui gère aussi son patrimoine, sans second compte (DEC-003). */
const ownerAndManager: AccessContext = {
  userId: OWNER_ID,
  memberships: [
    { accessId: 'acc-owner', organizationId: ORG_A, role: 'OWNER', propertyIds: [] },
    {
      accessId: 'acc-manager',
      organizationId: ORG_A,
      role: 'MANAGER',
      propertyIds: [PROPERTY_A1],
    },
  ],
};

/** Gestionnaire sans aucun immeuble affecté : un périmètre vide referme l'accès. */
const managerWithoutScope: AccessContext = {
  userId: MANAGER_ID,
  memberships: [
    { accessId: 'acc-manager', organizationId: ORG_A, role: 'MANAGER', propertyIds: [] },
  ],
};

/** Le filtre autoriserait-il cette ligne, telle que le SQL l'appliquerait. */
function scopeAllows(
  scopes: readonly PropertyScope[],
  organizationId: string,
  propertyId: string,
): boolean {
  return scopes.some(
    (scope) =>
      scope.organizationId === organizationId &&
      (scope.propertyIds === 'all' || scope.propertyIds.includes(propertyId)),
  );
}

/** Toutes les ressources imaginables du jeu de test, dans les deux organisations. */
const RESOURCES: { organizationId: string; propertyId: string }[] = [
  { organizationId: ORG_A, propertyId: PROPERTY_A1 },
  { organizationId: ORG_A, propertyId: PROPERTY_A2 },
  { organizationId: ORG_B, propertyId: PROPERTY_B1 },
];

const NON_TENANT_CONTEXTS: { label: string; context: AccessContext }[] = [
  { label: 'propriétaire', context: owner },
  { label: 'gestionnaire', context: manager },
  { label: 'gestionnaire sans périmètre', context: managerWithoutScope },
  { label: 'propriétaire et gestionnaire', context: ownerAndManager },
];

describe('Équivalence entre le filtre de liste et le point de décision', () => {
  for (const { label, context } of NON_TENANT_CONTEXTS) {
    for (const permission of PERMISSIONS) {
      it(`rend le même verdict pour ${label} sur ${permission}`, () => {
        const scopes = readablePropertyScopes(context, permission);

        for (const resource of RESOURCES) {
          expect(
            scopeAllows(scopes, resource.organizationId, resource.propertyId),
            `${permission} sur ${resource.propertyId}`,
          ).toBe(can(context, permission, resource));
        }
      });
    }
  }
});

describe('Périmètres de lecture', () => {
  it("donne au propriétaire toute son organisation, et rien d'une autre", () => {
    expect(readablePropertyScopes(owner, 'property.read')).toEqual([
      { organizationId: ORG_A, propertyIds: 'all' },
    ]);
  });

  it('limite le gestionnaire aux immeubles de son périmètre', () => {
    expect(readablePropertyScopes(manager, 'property.read')).toEqual([
      { organizationId: ORG_A, propertyIds: [PROPERTY_A1] },
    ]);
  });

  it('ne donne aucun périmètre pour une permission que le rôle ne porte pas', () => {
    expect(readablePropertyScopes(manager, 'property.archive')).toEqual([]);
    expect(readablePropertyScopes(manager, 'audit.read')).toEqual([]);
  });

  it('retient le périmètre le plus large en cas de cumul de rôles', () => {
    expect(readablePropertyScopes(ownerAndManager, 'property.read')).toEqual([
      { organizationId: ORG_A, propertyIds: 'all' },
    ]);
  });

  /**
   * Un périmètre vide ne doit produire AUCUN périmètre, et non un périmètre vide :
   * un `IN ()` serait invalide en SQL, et un filtre absent ouvrirait la liste
   * entière.
   */
  it('ne produit rien pour un gestionnaire sans immeuble affecté', () => {
    expect(readablePropertyScopes(managerWithoutScope, 'property.read')).toEqual([]);
  });

  /**
   * Le locataire est la divergence assumée : ses données ne sont pas rattachées à un
   * immeuble mais à lui-même, et se filtreront par `ownerUserId` au lot Contrats.
   */
  it("ne donne au locataire aucun périmètre d'immeuble", () => {
    for (const permission of PERMISSIONS) {
      expect(readablePropertyScopes(tenant, permission)).toEqual([]);
    }
  });
});

describe('Organisations où une permission de niveau organisation est portée', () => {
  it('autorise le propriétaire à créer un immeuble dans son organisation', () => {
    expect(organizationsWhereAllowed(owner, 'property.create')).toEqual([ORG_A]);
  });

  /**
   * Conséquence documentée de DEC-025 et d'ADR-007 : une ressource sans immeuble
   * sort du périmètre d'un gestionnaire, donc la création lui est fermée.
   */
  it("n'autorise le gestionnaire à créer aucun immeuble", () => {
    expect(organizationsWhereAllowed(manager, 'property.create')).toEqual([]);
  });

  it("n'autorise pas le locataire non plus", () => {
    const permissions: Permission[] = ['property.create', 'property.archive'];

    for (const permission of permissions) {
      expect(organizationsWhereAllowed(tenant, permission)).toEqual([]);
    }
  });
});
