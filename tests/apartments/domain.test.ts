import { describe, expect, it } from 'vitest';

import type { Apartment } from '../../src/db/schema';
import {
  changedFields,
  describeFloor,
  generateNumbers,
  hasChanges,
  isArchived,
  toApartmentView,
  toAreaNumber,
} from '../../src/modules/apartments/domain';
import { ArchivedApartmentError } from '../../src/modules/apartments/errors';
import { assertModifiable } from '../../src/modules/apartments/domain';

/**
 * MVP-BACKLOG-020 : règles et calculs de l'appartement.
 *
 * Le domaine ne connaît ni base ni HTTP : il se teste donc exhaustivement sans
 * rien monter, ce qui est exactement l'intérêt de l'avoir isolé (MVP-ENG-034).
 */
const BASE: Apartment = {
  id: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  propertyId: '33333333-3333-4333-8333-333333333333',
  number: 'A01',
  floor: 1,
  type: 'T3',
  area: '78.50',
  status: 'VACANT',
  underMaintenance: false,
  referenceRentAmount: 2500000,
  currency: 'GNF',
  createdAt: new Date('2026-09-01T08:00:00.000Z'),
  updatedAt: new Date('2026-09-01T08:00:00.000Z'),
  archivedAt: null,
};

describe('Étage lisible', () => {
  it('nomme le rez-de-chaussée plutôt que de l appeler étage 0', () => {
    expect(describeFloor(0)).toBe('Rez-de-chaussée');
  });

  it('accorde le premier étage', () => {
    expect(describeFloor(1)).toBe('1er étage');
    expect(describeFloor(2)).toBe('2e étage');
  });

  it('nomme les sous-sols', () => {
    expect(describeFloor(-1)).toBe('Sous-sol 1');
  });

  it('ne fabrique rien quand l étage est inconnu', () => {
    expect(describeFloor(null)).toBeNull();
  });
});

describe('Références engendrées', () => {
  it('produit la suite du parcours 3', () => {
    expect(generateNumbers('A', 1, 4)).toEqual(['A01', 'A02', 'A03', 'A04']);
  });

  /**
   * Le tri des listes est TEXTUEL : sans largeur constante, « A10 » se placerait
   * entre « A1 » et « A2 ». C'est la raison d'être du remplissage.
   */
  it('élargit le remplissage au plus grand numéro engendré', () => {
    const numbers = generateNumbers('A', 1, 100);

    expect(numbers[0]).toBe('A001');
    expect(numbers[99]).toBe('A100');
  });

  it('garde deux chiffres au minimum, même pour trois logements', () => {
    expect(generateNumbers('B', 1, 3)).toEqual(['B01', 'B02', 'B03']);
  });

  it('accepte un préfixe vide et un départ autre que 1', () => {
    expect(generateNumbers('', 10, 3)).toEqual(['10', '11', '12']);
  });
});

describe('Archivage', () => {
  it('reconnaît un appartement actif et un appartement archivé', () => {
    expect(isArchived(BASE)).toBe(false);
    expect(isArchived({ archivedAt: new Date() })).toBe(true);
  });

  it('refuse de modifier un appartement archivé', () => {
    expect(() => assertModifiable({ archivedAt: new Date() }, { archived: false })).toThrow(
      ArchivedApartmentError,
    );
  });

  /**
   * L'archivage d'un immeuble ne touche pas ses appartements, qui restent
   * individuellement actifs. Sans ce contrôle, on pourrait modifier le logement
   * d'un immeuble sorti de l'exploitation.
   */
  it('refuse de modifier le logement d un immeuble archivé', () => {
    const failure = (() => {
      try {
        assertModifiable({ archivedAt: null }, { archived: true });
      } catch (error) {
        return error;
      }

      return null;
    })();

    expect(failure).toBeInstanceOf(ArchivedApartmentError);
    expect((failure as ArchivedApartmentError).reason).toBe('property-archived');
  });

  it('laisse passer un logement actif dans un immeuble actif', () => {
    expect(() => assertModifiable({ archivedAt: null }, { archived: false })).not.toThrow();
  });
});

describe('Différence réelle avant écriture', () => {
  it('ne retient rien quand la modification reprend les valeurs en place', () => {
    const changes = changedFields(BASE, {
      number: 'A01',
      floor: 1,
      type: 'T3',
      area: 78.5,
      underMaintenance: false,
      referenceRent: { amount: 2500000, currency: 'GNF' },
    });

    expect(hasChanges(changes)).toBe(false);
  });

  /**
   * La surface revient de PostgreSQL sous forme de chaîne. Comparée telle
   * quelle, « 78.50 » différerait de 78,5 et produirait une écriture fantôme à
   * chaque soumission du formulaire.
   */
  it('compare la surface sur sa valeur et non sur son écriture', () => {
    expect(changedFields(BASE, { area: 78.5 })).toEqual({});
    expect(changedFields(BASE, { area: 79 })).toEqual({ area: '79.00' });
  });

  /**
   * L'occupation n'est PAS dans les champs modifiables (DEC-050) : elle se déduit
   * du bail. Seule la déclaration de travaux se change à la main.
   */
  it('retient une déclaration de travaux', () => {
    expect(changedFields(BASE, { underMaintenance: true })).toEqual({ underMaintenance: true });
  });

  it('ne retient rien quand les travaux étaient déjà déclarés', () => {
    expect(changedFields({ ...BASE, underMaintenance: true }, { underMaintenance: true })).toEqual(
      {},
    );
  });

  it('retient la fin des travaux', () => {
    expect(changedFields({ ...BASE, underMaintenance: true }, { underMaintenance: false })).toEqual(
      {
        underMaintenance: false,
      },
    );
  });

  it('efface une surface quand le champ est vidé', () => {
    expect(changedFields(BASE, { area: null })).toEqual({ area: null });
  });

  /**
   * Le montant et la devise vont toujours ensemble (DEC-014), y compris pour
   * être effacés : la base refuse un montant sans devise comme l'inverse.
   */
  it('efface le loyer et sa devise ensemble', () => {
    expect(changedFields(BASE, { referenceRent: null })).toEqual({
      referenceRentAmount: null,
      currency: null,
    });
  });

  it('écrit la devise avec le montant quand le loyer change', () => {
    expect(changedFields(BASE, { referenceRent: { amount: 3000000, currency: 'GNF' } })).toEqual({
      referenceRentAmount: 3000000,
      currency: 'GNF',
    });
  });
});

describe('Vue présentée par l API', () => {
  it('rend la surface numérique et le loyer sous forme de couple', () => {
    const view = toApartmentView(BASE, false);

    expect(view.area).toBe(78.5);
    expect(view.referenceRent).toEqual({ amount: 2500000, currency: 'GNF' });
    expect(view.archived).toBe(false);
    expect(view.createdAt).toBe('2026-09-01T08:00:00.000Z');
  });

  it('ne fabrique pas de loyer quand aucun montant n est connu', () => {
    const view = toApartmentView({ ...BASE, referenceRentAmount: null, currency: null }, false);

    expect(view.referenceRent).toBeNull();
  });

  /**
   * DEC-050 : l'occupation vient du BAIL, et la colonne `status` est gelée.
   *
   * Le logement ci-dessous porte encore `status: 'VACANT'` en base, et la vue
   * l'annonce pourtant occupé : c'est précisément la contradiction que la
   * décision supprime, et la colonne ne doit plus avoir voix au chapitre.
   */
  it('annonce occupé un logement dont la colonne gelée dit « vacant »', () => {
    expect(toApartmentView({ ...BASE, status: 'VACANT' }, true).occupancy).toBe('OCCUPIED');
    expect(toApartmentView({ ...BASE, status: 'OCCUPIED' }, false).occupancy).toBe('VACANT');
  });

  /** Les travaux ne sont pas une occupation : les deux coexistent (DEC-050). */
  it('affiche des travaux SUR un logement occupé, sans les confondre', () => {
    const view = toApartmentView({ ...BASE, underMaintenance: true }, true);

    expect(view.occupancy).toBe('OCCUPIED');
    expect(view.underMaintenance).toBe(true);
  });

  it('convertit une surface absente sans produire zéro', () => {
    expect(toAreaNumber(null)).toBeNull();
    expect(toAreaNumber('95.00')).toBe(95);
  });
});
