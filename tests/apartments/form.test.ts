import { describe, expect, it } from 'vitest';

import {
  apartmentFields,
  generationFields,
  submittedGenerationValues,
  submittedValues,
} from '../../src/modules/apartments/form';
import {
  createApartmentSchema,
  generateApartmentsSchema,
  updateApartmentSchema,
} from '../../src/modules/apartments/schemas';

/**
 * Le chemin formulaire vers cas d'usage, testé sans navigateur.
 *
 * Ce fichier existe parce que c'est exactement là que les défauts se logent : un
 * formulaire HTML ne transmet que des CHAÎNES, et un champ laissé vide arrive
 * comme une chaîne vide, jamais comme une absence. Les tests de schémas
 * vérifient la conversion, ceux-ci vérifient que le formulaire lui présente bien
 * ce qu'il attend, en construisant le `FormData` tel que le navigateur l'envoie.
 */
function formOf(entries: Record<string, string>): FormData {
  const formData = new FormData();

  for (const [key, value] of Object.entries(entries)) formData.append(key, value);

  return formData;
}

/**
 * Ce qu'un navigateur envoie pour le formulaire d'appartement complet.
 *
 * `underMaintenance` y vaut « on » : c'est la case cochée. Le champ CACHÉ du même
 * nom, qui vaut « false » et qui la précède toujours, est ajouté par
 * `withMaintenancePair` là où le comportement en dépend.
 */
const FULL_FORM = {
  number: '  C 01  ',
  floor: '-1',
  type: 'Studio',
  area: '62,75',
  underMaintenance: 'on',
  referenceRentAmount: '1800000',
};

/**
 * Le formulaire tel que le navigateur l'envoie VRAIMENT pour la maintenance :
 * deux champs du même nom, le champ caché d'abord, la case ensuite.
 *
 * C'est la seule façon de transmettre une case DÉCOCHÉE, un formulaire HTML
 * n'envoyant rien pour elle. D'où la lecture par `getAll(...).at(-1)` dans
 * `form.ts` : `get` rendrait toujours le champ caché.
 */
function withMaintenancePair(entries: Record<string, string>, checked: boolean): FormData {
  const formData = new FormData();

  for (const [key, value] of Object.entries(entries)) {
    if (key === 'underMaintenance') continue;

    formData.append(key, value);
  }

  formData.append('underMaintenance', 'false');

  if (checked) formData.append('underMaintenance', 'on');

  return formData;
}

describe('Formulaire d appartement', () => {
  it('présente au schéma de création une saisie complète, qui la valide', () => {
    const result = createApartmentSchema.safeParse(apartmentFields(formOf(FULL_FORM)));

    expect(result.success && result.data).toEqual({
      number: 'C 01',
      floor: -1,
      type: 'Studio',
      area: 62.75,
      underMaintenance: true,
      referenceRent: { amount: 1800000, currency: null },
    });
  });

  /**
   * Le piège de la case à cocher, et la raison du champ caché.
   *
   * Décochée, une case n'est pas transmise. Sans le champ caché, le formulaire
   * n'enverrait RIEN et la modification ne pourrait jamais terminer des travaux.
   * Avec lui, et en lisant le dernier champ du nom, les deux sens fonctionnent.
   */
  it('transmet une case décochée, grâce au champ caché qui la précède', () => {
    const cleared = createApartmentSchema.safeParse(
      apartmentFields(withMaintenancePair(FULL_FORM, false)),
    );
    const checked = createApartmentSchema.safeParse(
      apartmentFields(withMaintenancePair(FULL_FORM, true)),
    );

    expect(cleared.success && cleared.data.underMaintenance).toBe(false);
    expect(checked.success && checked.data.underMaintenance).toBe(true);
  });

  /** En modification, la même paire doit pouvoir ÉTEINDRE les travaux. */
  it('éteint les travaux en modification quand la case est décochée', () => {
    const result = updateApartmentSchema.safeParse(
      apartmentFields(withMaintenancePair(FULL_FORM, false)),
    );

    expect(result.success && result.data.underMaintenance).toBe(false);
  });

  /**
   * Le piège central de cet écran : tous les champs facultatifs vides arrivent
   * en chaîne vide. Sans conversion, l'étage deviendrait le rez-de-chaussée et
   * la surface un zéro que la base refuse.
   */
  it('ne fabrique aucune valeur à partir de champs laissés vides', () => {
    const result = createApartmentSchema.safeParse(
      apartmentFields(
        formOf({
          number: 'D01',
          floor: '',
          type: '',
          area: '',
          referenceRentAmount: '',
        }),
      ),
    );

    expect(result.success && result.data).toEqual({
      number: 'D01',
      floor: null,
      type: null,
      area: null,
      // Aucune case, aucun champ caché : pas de travaux déclarés (DEC-050).
      underMaintenance: false,
      referenceRent: null,
    });
  });

  /**
   * En modification, un champ vidé doit EFFACER. Le formulaire envoyant toujours
   * tous ses champs, chacun est présent, et la chaîne vide vaut donc `null`.
   */
  it('efface les champs vidés en modification', () => {
    const result = updateApartmentSchema.safeParse(
      apartmentFields(
        formOf({
          number: 'C 01',
          floor: '',
          type: '',
          area: '',
          referenceRentAmount: '',
        }),
      ),
    );

    expect(result.success && result.data).toMatchObject({
      floor: null,
      type: null,
      area: null,
      referenceRent: null,
    });
  });

  it('renvoie la saisie telle quelle pour la réafficher après un refus', () => {
    expect(submittedValues(formOf(FULL_FORM))).toEqual(FULL_FORM);
  });

  /**
   * La saisie réaffichée doit porter la case telle que l'utilisateur l'a laissée,
   * donc le DERNIER champ de son nom, et non le champ caché.
   */
  it('réaffiche la case à cocher et non le champ caché qui la précède', () => {
    expect(submittedValues(withMaintenancePair(FULL_FORM, true)).underMaintenance).toBe('on');
    expect(submittedValues(withMaintenancePair(FULL_FORM, false)).underMaintenance).toBe('false');
  });

  it('ignore un champ absent du formulaire plutôt que d inventer une chaîne', () => {
    expect(submittedValues(formOf({ number: 'A01' }))).toEqual({ number: 'A01' });
  });
});

describe('Formulaire de création rapide', () => {
  it('présente au schéma une série valide', () => {
    const result = generateApartmentsSchema.safeParse(
      generationFields(formOf({ prefix: 'A', start: '1', count: '20' })),
    );

    expect(result.success && result.data).toEqual({ prefix: 'A', start: 1, count: 20 });
  });

  it('accepte un préfixe laissé vide', () => {
    const result = generateApartmentsSchema.safeParse(
      generationFields(formOf({ prefix: '', start: '1', count: '3' })),
    );

    expect(result.success && result.data.prefix).toBeNull();
  });

  it('renvoie la saisie d une série refusée, y compris ses champs absents', () => {
    expect(submittedGenerationValues(formOf({ count: '12' }))).toEqual({
      prefix: '',
      start: '',
      count: '12',
    });
  });
});
