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

/** Ce qu'un navigateur envoie pour le formulaire d'appartement complet. */
const FULL_FORM = {
  number: '  C 01  ',
  floor: '-1',
  type: 'Studio',
  area: '62,75',
  status: 'OCCUPIED',
  referenceRentAmount: '1800000',
};

describe('Formulaire d appartement', () => {
  it('présente au schéma de création une saisie complète, qui la valide', () => {
    const result = createApartmentSchema.safeParse(apartmentFields(formOf(FULL_FORM)));

    expect(result.success && result.data).toEqual({
      number: 'C 01',
      floor: -1,
      type: 'Studio',
      area: 62.75,
      status: 'OCCUPIED',
      referenceRent: { amount: 1800000, currency: null },
    });
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
          status: '',
          referenceRentAmount: '',
        }),
      ),
    );

    expect(result.success && result.data).toEqual({
      number: 'D01',
      floor: null,
      type: null,
      area: null,
      status: 'VACANT',
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
          status: 'VACANT',
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
