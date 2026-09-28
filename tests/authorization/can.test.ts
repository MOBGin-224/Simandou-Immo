import { describe, expect, it } from 'vitest';

import type { AccessContext } from '../../src/lib/authorization/access-context';
import {
  PermissionDeniedError,
  ResourceOutOfScopeError,
  can,
  canAccessProperty,
  evaluate,
  requirePermission,
  requirePropertyAccess,
} from '../../src/lib/authorization/service';

/**
 * MVP-BACKLOG-015 : tests de sécurité du point de décision unique.
 *
 * Faute de RLS (ADR-005), ce service est la barrière UNIQUE d'isolation entre
 * organisations. Sa couverture n'est pas négociable, et les refus y comptent
 * davantage que les autorisations : une fonctionnalité non sécurisée ne fait pas
 * partie du MVP.
 *
 * Les trois refus exigés par le ticket sont vérifiés nommément plus bas :
 * organisation A vers organisation B, gestionnaire hors périmètre, locataire
 * vers un immeuble.
 */

const ORG_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const ORG_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';

const PROPERTY_A1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa101';
const PROPERTY_A2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa102';
const PROPERTY_B1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb101';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const MANAGER_ID = '22222222-2222-4222-8222-222222222222';
const TENANT_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_TENANT_ID = '33333333-3333-4333-8333-333333333334';

const owner: AccessContext = {
  userId: OWNER_ID,
  memberships: [{ accessId: 'acc-owner', organizationId: ORG_A, role: 'OWNER', propertyIds: [] }],
};

/** Gestionnaire de l'organisation A, avec un seul immeuble à son périmètre. */
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

/** Un propriétaire qui gère aussi son patrimoine, sans second compte (DEC-003). */
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

describe('Les trois refus exigés par MVP-BACKLOG-015', () => {
  it('organisation A vers organisation B : REFUS', () => {
    expect(can(owner, 'property.read', { organizationId: ORG_B })).toBe(false);
    expect(can(owner, 'property.read', { organizationId: ORG_B, propertyId: PROPERTY_B1 })).toBe(
      false,
    );

    // Et le motif doit être « inexistant », jamais « interdit » : répondre
    // « interdit » confirmerait l'existence de l'organisation B.
    expect(evaluate(owner, 'property.read', { organizationId: ORG_B })).toEqual({
      allowed: false,
      reason: 'out-of-scope',
    });
  });

  it('gestionnaire vers un immeuble hors périmètre : REFUS', () => {
    expect(
      can(manager, 'apartment.update', { organizationId: ORG_A, propertyId: PROPERTY_A1 }),
    ).toBe(true);

    expect(
      can(manager, 'apartment.update', { organizationId: ORG_A, propertyId: PROPERTY_A2 }),
    ).toBe(false);

    expect(
      evaluate(manager, 'apartment.update', {
        organizationId: ORG_A,
        propertyId: PROPERTY_A2,
      }),
    ).toEqual({ allowed: false, reason: 'out-of-scope' });
  });

  it('locataire vers un immeuble : REFUS', () => {
    expect(can(tenant, 'property.read', { organizationId: ORG_A, propertyId: PROPERTY_A1 })).toBe(
      false,
    );

    expect(canAccessProperty(tenant, { organizationId: ORG_A, propertyId: PROPERTY_A1 })).toBe(
      false,
    );
  });
});

describe('Propriétaire', () => {
  it('agit sur toute son organisation, immeuble par immeuble ou non', () => {
    expect(can(owner, 'property.create', { organizationId: ORG_A })).toBe(true);
    expect(can(owner, 'property.archive', { organizationId: ORG_A, propertyId: PROPERTY_A2 })).toBe(
      true,
    );
    expect(can(owner, 'audit.read', { organizationId: ORG_A })).toBe(true);
  });

  it('atteint la donnée personnelle de ses locataires', () => {
    expect(
      can(owner, 'tenant.update', {
        organizationId: ORG_A,
        propertyId: PROPERTY_A1,
        ownerUserId: TENANT_ID,
      }),
    ).toBe(true);
  });

  it('couvre tous les immeubles de son organisation', () => {
    expect(canAccessProperty(owner, { organizationId: ORG_A, propertyId: PROPERTY_A1 })).toBe(true);
    expect(canAccessProperty(owner, { organizationId: ORG_A, propertyId: PROPERTY_A2 })).toBe(true);
    expect(canAccessProperty(owner, { organizationId: ORG_B, propertyId: PROPERTY_B1 })).toBe(
      false,
    );
  });
});

describe('Gestionnaire', () => {
  it('mène les opérations quotidiennes sur son périmètre', () => {
    const resource = { organizationId: ORG_A, propertyId: PROPERTY_A1 };

    expect(can(manager, 'apartment.create', resource)).toBe(true);
    expect(can(manager, 'lease.create', resource)).toBe(true);
    expect(can(manager, 'payment.create', resource)).toBe(true);
    expect(can(manager, 'charge.publish', resource)).toBe(true);
  });

  it('est refusé sur un acte patrimonial, dans son périmètre même', () => {
    const resource = { organizationId: ORG_A, propertyId: PROPERTY_A1 };

    // Ici la ressource EST dans son périmètre : le motif doit donc être
    // « interdit » et non « inexistant ». L'immeuble existe et il le connaît.
    expect(evaluate(manager, 'property.archive', resource)).toEqual({
      allowed: false,
      reason: 'permission-denied',
    });

    expect(can(manager, 'manager.invite', resource)).toBe(false);
    expect(can(manager, 'manager.read', resource)).toBe(false);
    expect(can(manager, 'audit.read', resource)).toBe(false);
  });

  it("n'atteint aucune ressource sans immeuble", () => {
    // ADR-007 borne son autorité à un périmètre d'immeubles sans condition. Une
    // ressource de niveau organisation sort donc de ce périmètre.
    expect(can(manager, 'property.read', { organizationId: ORG_A })).toBe(false);
    expect(can(manager, 'report.read', { organizationId: ORG_A })).toBe(false);
  });

  it('perd tout accès lorsque son périmètre est vide', () => {
    const withoutScope: AccessContext = {
      userId: MANAGER_ID,
      memberships: [{ accessId: 'acc', organizationId: ORG_A, role: 'MANAGER', propertyIds: [] }],
    };

    expect(
      can(withoutScope, 'apartment.read', {
        organizationId: ORG_A,
        propertyId: PROPERTY_A1,
      }),
    ).toBe(false);
  });
});

describe('Locataire', () => {
  const ownResource = {
    organizationId: ORG_A,
    propertyId: PROPERTY_A1,
    ownerUserId: TENANT_ID,
  };

  it('consulte ses propres données', () => {
    expect(can(tenant, 'lease.read', ownResource)).toBe(true);
    expect(can(tenant, 'rent.read', ownResource)).toBe(true);
    expect(can(tenant, 'payment.read', ownResource)).toBe(true);
    expect(can(tenant, 'receipt.read', ownResource)).toBe(true);
    expect(can(tenant, 'incident.create', ownResource)).toBe(true);
  });

  it("n'atteint pas les données d'un autre locataire du même immeuble", () => {
    const otherResource = {
      organizationId: ORG_A,
      propertyId: PROPERTY_A1,
      ownerUserId: OTHER_TENANT_ID,
    };

    expect(can(tenant, 'lease.read', otherResource)).toBe(false);
    expect(can(tenant, 'payment.read', otherResource)).toBe(false);
    expect(evaluate(tenant, 'lease.read', otherResource)).toEqual({
      allowed: false,
      reason: 'out-of-scope',
    });
  });

  it("ne voit pas les finances de l'immeuble", () => {
    expect(can(tenant, 'expense.read', ownResource)).toBe(false);
    expect(can(tenant, 'report.read', ownResource)).toBe(false);
    expect(can(tenant, 'activity.read', ownResource)).toBe(false);
  });

  it('ne modifie ni son loyer ni son appartement', () => {
    expect(can(tenant, 'lease.update', ownResource)).toBe(false);
    expect(can(tenant, 'apartment.update', ownResource)).toBe(false);
    expect(can(tenant, 'rent.generate', ownResource)).toBe(false);
  });
});

describe('Plusieurs rôles dans une même organisation', () => {
  it('cumule les capacités sans que le périmètre du gestionnaire ne bride le propriétaire', () => {
    const outOfManagerScope = { organizationId: ORG_A, propertyId: PROPERTY_A2 };

    expect(can(ownerAndManager, 'apartment.update', outOfManagerScope)).toBe(true);
    expect(can(ownerAndManager, 'property.create', { organizationId: ORG_A })).toBe(true);
  });
});

describe('Formes qui échouent', () => {
  it('lève ResourceOutOfScopeError hors organisation', () => {
    expect(() => requirePermission(owner, 'property.read', { organizationId: ORG_B })).toThrow(
      ResourceOutOfScopeError,
    );
  });

  it('lève ResourceOutOfScopeError hors périmètre', () => {
    expect(() =>
      requirePermission(manager, 'apartment.read', {
        organizationId: ORG_A,
        propertyId: PROPERTY_A2,
      }),
    ).toThrow(ResourceOutOfScopeError);
  });

  it('lève PermissionDeniedError dans le périmètre, sans la permission', () => {
    expect(() =>
      requirePermission(manager, 'property.archive', {
        organizationId: ORG_A,
        propertyId: PROPERTY_A1,
      }),
    ).toThrow(PermissionDeniedError);
  });

  it('renvoie le rattachement retenu lorsque l accès est accordé', () => {
    const membership = requirePermission(manager, 'apartment.read', {
      organizationId: ORG_A,
      propertyId: PROPERTY_A1,
    });

    expect(membership.role).toBe('MANAGER');
    expect(membership.accessId).toBe('acc-manager');
  });

  it('requirePropertyAccess échoue hors périmètre et passe dedans', () => {
    expect(() =>
      requirePropertyAccess(manager, { organizationId: ORG_A, propertyId: PROPERTY_A2 }),
    ).toThrow(ResourceOutOfScopeError);

    expect(() =>
      requirePropertyAccess(manager, { organizationId: ORG_A, propertyId: PROPERTY_A1 }),
    ).not.toThrow();
  });
});

describe('Utilisateur sans aucun rattachement', () => {
  it('ne peut rien, sur rien', () => {
    const orphan: AccessContext = { userId: 'orphelin', memberships: [] };

    expect(can(orphan, 'property.read', { organizationId: ORG_A })).toBe(false);
    expect(
      can(orphan, 'incident.create', {
        organizationId: ORG_A,
        propertyId: PROPERTY_A1,
        ownerUserId: 'orphelin',
      }),
    ).toBe(false);
  });
});
