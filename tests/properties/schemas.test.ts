import { describe, expect, it } from 'vitest';

import {
  PROPERTY_LIST_DEFAULT_PAGE_SIZE,
  PROPERTY_LIST_MAX_PAGE_SIZE,
  PROPERTY_NAME_MAX_LENGTH,
} from '../../src/modules/properties/constants';
import {
  createPropertySchema,
  listPropertiesQuerySchema,
  updatePropertySchema,
} from '../../src/modules/properties/schemas';

/**
 * Frontière d'entrée du module (MVP-ENG-027).
 *
 * Ces tests portent surtout sur les cas que produisent réellement les formulaires
 * HTML : chaîne vide pour un champ facultatif, espaces parasites, nombres transmis
 * comme des chaînes. Ce sont eux qui cassent en production, pas les cas idéaux.
 */

const ORGANIZATION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';

describe("Création d'un immeuble", () => {
  it('normalise les espaces du nom', () => {
    const result = createPropertySchema.safeParse({
      organizationId: ORGANIZATION,
      name: '  Résidence   Camayenne  ',
    });

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('Résidence Camayenne');
  });

  /**
   * Sans cette conversion, la base stockerait des chaînes vides, et « ville
   * inconnue » deviendrait indistinguable de « ville renseignée avec rien ».
   */
  it('transforme les champs facultatifs vides en null', () => {
    const result = createPropertySchema.safeParse({
      organizationId: ORGANIZATION,
      name: 'Immeuble A',
      address: '',
      city: '   ',
      district: '',
      description: '',
    });

    expect(result.data).toMatchObject({
      address: null,
      city: null,
      district: null,
      description: null,
    });
  });

  it('accepte un formulaire réduit au nom', () => {
    const result = createPropertySchema.safeParse({
      organizationId: ORGANIZATION,
      name: 'Immeuble A',
    });

    expect(result.success).toBe(true);
    expect(result.data?.city).toBeNull();
  });

  it('refuse un nom vide, absent, ou fait d espaces', () => {
    for (const name of ['', '    ', undefined, null]) {
      expect(createPropertySchema.safeParse({ organizationId: ORGANIZATION, name }).success).toBe(
        false,
      );
    }
  });

  it('refuse un nom trop long pour la colonne', () => {
    const result = createPropertySchema.safeParse({
      organizationId: ORGANIZATION,
      name: 'x'.repeat(PROPERTY_NAME_MAX_LENGTH + 1),
    });

    expect(result.success).toBe(false);
  });

  it("refuse une organisation qui n'est pas un identifiant", () => {
    expect(createPropertySchema.safeParse({ organizationId: 'org-1', name: 'A' }).success).toBe(
      false,
    );
  });
});

describe("Modification d'un immeuble", () => {
  it('laisse intact un champ absent', () => {
    const result = updatePropertySchema.safeParse({ name: 'Nouveau nom' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'Nouveau nom' });
  });

  it('interprète un champ vide comme un effacement', () => {
    const result = updatePropertySchema.safeParse({ city: '' });

    expect(result.data).toEqual({ city: null });
  });

  it('refuse une requête sans aucune modification', () => {
    expect(updatePropertySchema.safeParse({}).success).toBe(false);
  });

  it('refuse un nom vidé : le nom est obligatoire', () => {
    expect(updatePropertySchema.safeParse({ name: '' }).success).toBe(false);
  });
});

describe('Paramètres de liste', () => {
  it('applique ses valeurs par défaut sur une requête nue', () => {
    const result = listPropertiesQuerySchema.safeParse({});

    expect(result.data).toEqual({
      page: 1,
      pageSize: PROPERTY_LIST_DEFAULT_PAGE_SIZE,
      search: null,
      filter: 'ACTIVE',
      organizationId: null,
    });
  });

  it('accepte les nombres transmis comme des chaînes', () => {
    expect(listPropertiesQuerySchema.safeParse({ page: '3', pageSize: '5' }).data).toMatchObject({
      page: 3,
      pageSize: 5,
    });
  });

  /** Le serveur impose la borne : un client ne demande pas un volume arbitraire. */
  it('refuse une page plus grande que la borne du serveur', () => {
    expect(
      listPropertiesQuerySchema.safeParse({ pageSize: String(PROPERTY_LIST_MAX_PAGE_SIZE + 1) })
        .success,
    ).toBe(false);
  });

  it('refuse une page nulle ou négative', () => {
    expect(listPropertiesQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(listPropertiesQuerySchema.safeParse({ page: '-1' }).success).toBe(false);
  });

  it('refuse un filtre inconnu', () => {
    expect(listPropertiesQuerySchema.safeParse({ filter: 'SUPPRIMES' }).success).toBe(false);
  });
});
