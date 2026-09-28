import { describe, expect, it } from 'vitest';

import type { Property } from '../../src/db/schema';
import {
  changedFields,
  describeLocation,
  hasChanges,
  isArchived,
  toPropertyView,
} from '../../src/modules/properties/domain';

/**
 * Règles du domaine Immeuble (MVP-BACKLOG-016).
 *
 * Aucune base de données ici : ces fonctions n'en ont pas besoin, et c'est
 * précisément ce qui permet de les couvrir exhaustivement (MVP-ENG-034).
 */

const BASE: Property = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa101',
  organizationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  name: 'Immeuble Camayenne',
  address: 'Corniche Nord',
  city: 'Conakry',
  district: 'Camayenne',
  description: null,
  createdAt: new Date('2026-09-01T10:00:00.000Z'),
  updatedAt: new Date('2026-09-01T10:00:00.000Z'),
  archivedAt: null,
};

describe("État d'archivage", () => {
  it('considère actif un immeuble dont archived_at est nul (DEC-020)', () => {
    expect(isArchived(BASE)).toBe(false);
  });

  it('considère archivé un immeuble daté', () => {
    expect(isArchived({ ...BASE, archivedAt: new Date() })).toBe(true);
  });
});

describe('Localisation lisible', () => {
  it('place le quartier avant la ville', () => {
    expect(describeLocation(BASE)).toBe('Camayenne, Conakry');
  });

  it("n'affiche que ce qui est renseigné", () => {
    expect(describeLocation({ city: 'Conakry', district: null })).toBe('Conakry');
    expect(describeLocation({ city: null, district: 'Camayenne' })).toBe('Camayenne');
  });

  it('renvoie null quand rien ne situe l immeuble', () => {
    expect(describeLocation({ city: null, district: null })).toBeNull();
  });
});

describe('Différence réelle avant écriture', () => {
  it('ne retient que les champs qui changent vraiment', () => {
    const changes = changedFields(BASE, { name: 'Immeuble Camayenne', city: 'Kindia' });

    expect(changes).toEqual({ city: 'Kindia' });
    expect(hasChanges(changes)).toBe(true);
  });

  it('ignore un champ absent, qui signifie « ne pas y toucher »', () => {
    expect(changedFields(BASE, { description: undefined })).toEqual({});
  });

  /**
   * Sans cette distinction, vider un champ serait impossible : l'effacement et
   * l'absence de modification seraient la même requête.
   */
  it('retient un effacement explicite', () => {
    expect(changedFields(BASE, { city: null })).toEqual({ city: null });
  });

  it("ne retient rien quand la soumission est identique à l'existant", () => {
    const changes = changedFields(BASE, {
      name: 'Immeuble Camayenne',
      address: 'Corniche Nord',
      city: 'Conakry',
      district: 'Camayenne',
      description: null,
    });

    expect(hasChanges(changes)).toBe(false);
  });
});

describe("Vue d'un immeuble", () => {
  it('expose des dates ISO et une occupation, sans colonne technique', () => {
    const view = toPropertyView(BASE, {
      apartmentCount: 3,
      occupiedCount: 1,
      vacantCount: 1,
      maintenanceCount: 1,
    });

    expect(view.createdAt).toBe('2026-09-01T10:00:00.000Z');
    expect(view.archivedAt).toBeNull();
    expect(view.archived).toBe(false);
    expect(view.location).toBe('Camayenne, Conakry');
    expect(view.occupancy.apartmentCount).toBe(3);
  });

  it('rend une occupation vide par défaut', () => {
    expect(toPropertyView(BASE).occupancy.apartmentCount).toBe(0);
  });
});
