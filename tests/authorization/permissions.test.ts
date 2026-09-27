import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  type Permission,
  type Role,
} from '../../src/lib/authorization/permissions';

/**
 * Le catalogue en code doit rester identique à celui du document de référence.
 *
 * `docs/` est la source de vérité du projet. Un catalogue défini en code peut en
 * diverger sans que rien ne le signale : une permission ajoutée au code sans le
 * document, ou l'inverse, passerait inaperçue jusqu'à une revue humaine. Ce test
 * lit la liste dans `docs/04-technical/database.md` et la compare, ce qui rend
 * la dérive impossible dans les deux sens.
 */
function catalogueFromDocumentation(): string[] {
  const document = readFileSync(resolve(process.cwd(), 'docs/04-technical/database.md'), 'utf8');

  const section = document.slice(document.indexOf('# 11. Permissions'));
  const start = section.indexOf('```text');
  const end = section.indexOf('```', start + 7);

  return section
    .slice(start + 7, end)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

const ROLES: Role[] = ['OWNER', 'MANAGER', 'TENANT'];

describe('Catalogue des permissions', () => {
  it('est identique à celui du document de référence', () => {
    expect([...PERMISSIONS]).toEqual(catalogueFromDocumentation());
  });

  it('ne contient aucun doublon', () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });

  it("n'accorde que des permissions du catalogue", () => {
    const catalogue = new Set<string>(PERMISSIONS);

    for (const role of ROLES) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(catalogue, `${role} porte une permission inconnue : ${permission}`).toContain(
          permission,
        );
      }
    }
  });

  it("n'oublie aucune permission du catalogue", () => {
    // Une permission qu'aucun rôle ne porte est du code mort qui donne
    // l'illusion d'une capacité existante.
    const granted = new Set<string>(ROLES.flatMap((role) => [...ROLE_PERMISSIONS[role]]));

    for (const permission of PERMISSIONS) {
      expect(granted, `aucun rôle ne porte ${permission}`).toContain(permission);
    }
  });
});

describe('Association des rôles', () => {
  it('donne au propriétaire la totalité du catalogue', () => {
    expect(ROLE_PERMISSIONS.OWNER.size).toBe(PERMISSIONS.length);
  });

  /**
   * Ces exclusions résolvaient la mention « selon droits » de la matrice, qui ne
   * parle pas en `resource.action`. Elles sont confirmées depuis le 27 septembre
   * 2026 (DEC-025). Les figer ici rend tout changement visible en revue plutôt
   * que silencieux.
   */
  const MANAGER_MUST_NOT_HAVE: Permission[] = [
    'property.create',
    'property.archive',
    'manager.invite',
    'manager.read',
    'manager.update',
    'manager.revoke',
    'audit.read',
  ];

  for (const permission of MANAGER_MUST_NOT_HAVE) {
    it(`refuse ${permission} au gestionnaire`, () => {
      expect(ROLE_PERMISSIONS.MANAGER.has(permission)).toBe(false);
    });
  }

  it('donne au gestionnaire les opérations quotidiennes', () => {
    for (const permission of [
      'property.read',
      'property.update',
      'apartment.create',
      'lease.create',
      'payment.create',
      'charge.publish',
      'expense.create',
    ] as Permission[]) {
      expect(ROLE_PERMISSIONS.MANAGER.has(permission)).toBe(true);
    }
  });

  it('limite le locataire à la lecture de ses données et à ses incidents', () => {
    const tenant = ROLE_PERMISSIONS.TENANT;

    for (const permission of [
      'lease.read',
      'rent.read',
      'payment.read',
      'receipt.read',
      'charge.read',
      'incident.create',
      'incident.read',
    ] as Permission[]) {
      expect(tenant.has(permission)).toBe(true);
    }

    for (const permission of [
      'property.read',
      'property.update',
      'apartment.read',
      'tenant.create',
      'tenant.invite',
      'lease.create',
      'rent.generate',
      'payment.create',
      'payment.cancel',
      'charge.create',
      'expense.read',
      'report.read',
      'activity.read',
      'audit.read',
    ] as Permission[]) {
      expect(tenant.has(permission), `le locataire ne doit pas porter ${permission}`).toBe(false);
    }
  });
});
