import { describe, expect, it } from 'vitest';

import {
  createApartmentSchema,
  createApartmentsBulkSchema,
  generateApartmentsSchema,
  listApartmentsQuerySchema,
  updateApartmentSchema,
} from '../../src/modules/apartments/schemas';

/**
 * MVP-ENG-027 : la frontière d'entrée du module Appartements.
 *
 * Ces tests visent les pièges que le typage ne voit pas. Un formulaire HTML
 * transmet des CHAÎNES, et `Number('')` vaut zéro : sans précaution, un étage
 * laissé vide deviendrait le rez-de-chaussée et une surface vide un zéro que la
 * base refuserait. C'est exactement le genre de défaut qui ne se révèle qu'à
 * l'exécution réelle.
 */
describe('Création', () => {
  const create = (input: Record<string, unknown>) =>
    createApartmentSchema.safeParse({ number: 'A01', ...input });

  it('normalise les espaces de la référence', () => {
    const result = create({ number: '  A 01  ' });

    expect(result.success && result.data.number).toBe('A 01');
  });

  it('refuse une référence vide, en désignant le champ fautif', () => {
    const result = createApartmentSchema.safeParse({ number: '   ' });

    expect(result.success).toBe(false);
    expect(result.success === false && result.error.issues[0]?.path).toEqual(['number']);
  });

  /** Le piège central : une chaîne vide ne doit jamais devenir un nombre. */
  it('ne transforme pas un étage vide en rez-de-chaussée', () => {
    expect(create({ floor: '' }).success && create({ floor: '' }).data?.floor).toBeNull();
  });

  it('ne transforme pas une surface vide en zéro', () => {
    const result = create({ area: '' });

    expect(result.success && result.data.area).toBeNull();
  });

  it('accepte la virgule décimale française pour la surface', () => {
    const result = create({ area: '78,5' });

    expect(result.success && result.data.area).toBe(78.5);
  });

  it('arrondit la surface à la précision de la colonne', () => {
    const result = create({ area: '78,567' });

    expect(result.success && result.data.area).toBe(78.57);
  });

  it('refuse une surface nulle ou négative', () => {
    expect(create({ area: '0' }).success).toBe(false);
    expect(create({ area: '-3' }).success).toBe(false);
  });

  it('refuse un étage décimal', () => {
    expect(create({ floor: '1,5' }).success).toBe(false);
  });

  it('accepte un sous-sol', () => {
    const result = create({ floor: '-1' });

    expect(result.success && result.data.floor).toBe(-1);
  });

  it('retient VACANT par défaut, comme pour un logement sans bail', () => {
    const result = create({});

    expect(result.success && result.data.status).toBe('VACANT');
  });

  it('traite un statut vide comme une absence et non comme une erreur', () => {
    const result = create({ status: '' });

    expect(result.success && result.data.status).toBe('VACANT');
  });

  it('refuse un statut inconnu', () => {
    expect(create({ status: 'RESERVED' }).success).toBe(false);
  });
});

describe('Loyer de référence', () => {
  const create = (input: Record<string, unknown>) =>
    createApartmentSchema.safeParse({ number: 'A01', ...input });

  /**
   * DEC-014 : montant et devise sont indissociables. Un couple à moitié rempli
   * produirait une violation de contrainte au lieu d'un message lisible.
   */
  it('annule le couple entier quand aucun montant n est saisi', () => {
    const result = create({ referenceRent: { amount: '', currency: 'GNF' } });

    expect(result.success && result.data.referenceRent).toBeNull();
  });

  it('laisse la devise vide, que le cas d usage remplira', () => {
    const result = create({ referenceRent: { amount: '2500000', currency: '' } });

    expect(result.success && result.data.referenceRent).toEqual({
      amount: 2500000,
      currency: null,
    });
  });

  it('normalise la devise en majuscules', () => {
    const result = create({ referenceRent: { amount: '2500000', currency: 'gnf' } });

    expect(result.success && result.data.referenceRent?.currency).toBe('GNF');
  });

  it('refuse une devise qui n est pas un code de trois lettres', () => {
    expect(create({ referenceRent: { amount: '1000', currency: 'FRANC' } }).success).toBe(false);
  });

  it('refuse un montant décimal, la plus petite unité étant entière', () => {
    expect(create({ referenceRent: { amount: '2500000,50', currency: 'GNF' } }).success).toBe(
      false,
    );
  });

  it('refuse un montant négatif', () => {
    expect(create({ referenceRent: { amount: '-1', currency: 'GNF' } }).success).toBe(false);
  });
});

describe('Modification', () => {
  /**
   * La distinction porte tout le PATCH : un champ ABSENT ne doit pas être
   * touché, un champ VIDE doit être effacé. Les confondre rendrait impossible
   * soit l'effacement, soit la modification partielle.
   */
  it('laisse intact un étage absent de la requête', () => {
    const result = updateApartmentSchema.safeParse({ number: 'A02' });

    expect(result.success && 'floor' in result.data).toBe(false);
  });

  it('efface un étage explicitement vidé', () => {
    const result = updateApartmentSchema.safeParse({ floor: '' });

    expect(result.success && result.data.floor).toBeNull();
  });

  it('laisse intact un type absent, et efface un type vidé', () => {
    const untouched = updateApartmentSchema.safeParse({ number: 'A02' });
    const cleared = updateApartmentSchema.safeParse({ type: '' });

    expect(untouched.success && untouched.data.type).toBeUndefined();
    expect(cleared.success && cleared.data.type).toBeNull();
  });

  it('refuse une requête sans aucun champ', () => {
    expect(updateApartmentSchema.safeParse({}).success).toBe(false);
  });

  /** Un logement est toujours dans un état : « sans statut » ne veut rien dire. */
  it('refuse d effacer le statut', () => {
    expect(updateApartmentSchema.safeParse({ status: '' }).success).toBe(false);
  });
});

describe('Création groupée et génération', () => {
  it('refuse deux références identiques dans le même envoi', () => {
    const result = createApartmentsBulkSchema.safeParse({
      apartments: [{ number: 'A01' }, { number: 'a01' }],
    });

    expect(result.success).toBe(false);
  });

  it('refuse un envoi vide', () => {
    expect(createApartmentsBulkSchema.safeParse({ apartments: [] }).success).toBe(false);
  });

  it('accepte une série décrite en trois valeurs', () => {
    const result = generateApartmentsSchema.safeParse({ prefix: 'A', start: '1', count: '20' });

    expect(result.success && result.data).toEqual({ prefix: 'A', start: 1, count: 20 });
  });

  it('accepte un préfixe vide et retient 1 comme premier numéro par défaut', () => {
    const result = generateApartmentsSchema.safeParse({ prefix: '', count: '3' });

    expect(result.success && result.data.prefix).toBeNull();
    expect(result.success && result.data.start).toBe(1);
  });

  it('refuse un nombre de logements nul ou hors borne', () => {
    expect(generateApartmentsSchema.safeParse({ count: '0' }).success).toBe(false);
    expect(generateApartmentsSchema.safeParse({ count: '101' }).success).toBe(false);
  });
});

describe('Paramètres de liste', () => {
  it('retient des valeurs utilisables quand rien n est précisé', () => {
    const result = listApartmentsQuerySchema.safeParse({});

    expect(result.success && result.data).toMatchObject({
      page: 1,
      pageSize: 20,
      status: 'ALL',
      search: null,
      includeArchived: false,
    });
  });

  it('convertit les paramètres transmis en chaîne par une requête HTTP', () => {
    const result = listApartmentsQuerySchema.safeParse({ page: '2', pageSize: '50' });

    expect(result.success && result.data.page).toBe(2);
    expect(result.success && result.data.pageSize).toBe(50);
  });

  /** Un client ne doit pas pouvoir demander un volume arbitraire (API section 44). */
  it('refuse une taille de page au-delà de la borne du serveur', () => {
    expect(listApartmentsQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
  });

  it('reconnaît la demande explicite d afficher les archivés', () => {
    const result = listApartmentsQuerySchema.safeParse({ includeArchived: '1' });

    expect(result.success && result.data.includeArchived).toBe(true);
  });
});
