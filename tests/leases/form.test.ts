import { describe, expect, it } from 'vitest';

import { createFields, updateFields } from '../../src/modules/leases/form';
import { createLeaseSchema } from '../../src/modules/leases/schemas';

/**
 * Le chemin formulaire vers cas d'usage du bail, testé sans navigateur.
 *
 * Ce fichier existe pour la raison qui vaut partout ailleurs : un formulaire HTML
 * ne transmet que des CHAÎNES, et c'est exactement là que les défauts se logent.
 *
 * Il porte en plus une règle propre au Lot 8b : l'écran de création offre DEUX
 * façons de désigner le locataire, et les champs des deux panneaux restent dans
 * la page, le dévoilement étant en CSS. C'est donc `createFields` qui ne retient
 * que le panneau choisi, et une erreur ici créerait une personne que l'utilisateur
 * n'a pas voulue.
 */
function formOf(entries: Record<string, string>): FormData {
  const formData = new FormData();

  for (const [key, value] of Object.entries(entries)) formData.append(key, value);

  return formData;
}

/** Ce que l'écran envoie toujours, quel que soit le mode choisi. */
const COMMON = {
  apartmentId: '11111111-1111-4111-8111-111111111111',
  startDate: '2026-10-01',
  endDate: '',
  rentAmount: '2500000',
  currency: 'GNF',
  dueDay: '5',
  depositAmount: '5000000',
};

const KNOWN_PERSON = '22222222-2222-4222-8222-222222222222';

describe('Formulaire de création d un bail', () => {
  describe('Deux panneaux dans la page, un seul retenu', () => {
    it('retient la personne choisie, et IGNORE la nouvelle personne ébauchée', () => {
      const fields = createFields(
        formOf({
          ...COMMON,
          tenantMode: 'known',
          tenantId: KNOWN_PERSON,
          // Saisie laissée dans l'autre panneau : elle ne doit rien créer.
          tenantName: 'Ebauche Abandonnee',
          tenantPhone: '+224620999999',
          tenantEmail: '',
        }),
      );

      expect(fields.tenantId).toBe(KNOWN_PERSON);
      expect(fields.tenant).toBeUndefined();
    });

    it('retient la nouvelle personne, et IGNORE la personne sélectionnée', () => {
      const fields = createFields(
        formOf({
          ...COMMON,
          tenantMode: 'new',
          tenantId: KNOWN_PERSON,
          tenantName: 'Mariama Camara',
          tenantPhone: '+224620111222',
          tenantEmail: '',
        }),
      );

      expect(fields.tenantId).toBeUndefined();
      expect(fields.tenant).toEqual({
        name: 'Mariama Camara',
        phone: '+224620111222',
        email: '',
      });
    });

    /**
     * Les deux ensemble sont refusés par le schéma, à dessein. Ce test vérifie
     * que le formulaire ne peut PAS produire cette situation : sinon l'écran
     * afficherait un refus que l'utilisateur ne peut pas comprendre.
     */
    it('ne produit jamais les deux à la fois, quel que soit le mode', () => {
      for (const tenantMode of ['known', 'new']) {
        const fields = createFields(
          formOf({
            ...COMMON,
            tenantMode,
            tenantId: KNOWN_PERSON,
            tenantName: 'Les Deux',
            tenantPhone: '+224620333444',
            tenantEmail: '',
          }),
        );

        expect(fields.tenantId === undefined || fields.tenant === undefined).toBe(true);
      }
    });
  });

  describe('Ce que le schéma en fait', () => {
    it('valide le mode « personne connue »', () => {
      const result = createLeaseSchema.safeParse(
        createFields(formOf({ ...COMMON, tenantMode: 'known', tenantId: KNOWN_PERSON })),
      );

      expect(result.success).toBe(true);
      expect(result.success && result.data.tenantId).toBe(KNOWN_PERSON);
      expect(result.success && result.data.tenant).toBeUndefined();
    });

    it('valide le mode « nouvelle personne », en normalisant le numéro', () => {
      const result = createLeaseSchema.safeParse(
        createFields(
          formOf({
            ...COMMON,
            tenantMode: 'new',
            tenantName: '  Mariama   Camara  ',
            tenantPhone: '+224 620 11 12 22',
            tenantEmail: '',
          }),
        ),
      );

      expect(result.success).toBe(true);
      expect(result.success && result.data.tenant).toEqual({
        name: 'Mariama Camara',
        phone: '+224620111222',
        email: null,
      });
    });

    /**
     * Un `select` sur son choix vide envoie une CHAÎNE VIDE, pas une absence.
     * Sans la ramener à une absence, le refus dirait « identifiant invalide » là
     * où la vraie situation est « aucun locataire choisi ».
     */
    it('dit « locataire requis » quand aucune personne n est choisie', () => {
      const result = createLeaseSchema.safeParse(
        createFields(formOf({ ...COMMON, tenantMode: 'known', tenantId: '' })),
      );

      expect(result.success).toBe(false);

      const message = result.success ? '' : result.error.issues[0]?.message;

      expect(message).toMatch(/Locataire requis/i);
    });
  });

  describe('Modification', () => {
    it('ne porte ni logement ni locataire, même envoyés', () => {
      const fields = updateFields(
        formOf({
          apartmentId: '11111111-1111-4111-8111-111111111111',
          tenantId: KNOWN_PERSON,
          rentAmount: '3000000',
        }),
      );

      expect(fields.apartmentId).toBeUndefined();
      expect(fields.tenantId).toBeUndefined();
      expect(fields.rentAmount).toBe('3000000');
    });
  });
});
