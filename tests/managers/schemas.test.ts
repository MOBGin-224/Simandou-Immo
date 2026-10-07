import { describe, expect, it } from 'vitest';

import { MANAGER_PROPERTIES_MAX } from '../../src/modules/managers/constants';
import { passwordConfirmationError } from '../../src/modules/invitations/form';
import {
  INVITE_FIELD_NAMES,
  inviteFields,
  submittedInviteValues,
  submittedPropertyIds,
} from '../../src/modules/managers/form';
import { acceptInvitationSchema, inviteManagerSchema } from '../../src/modules/managers/schemas';

/**
 * MVP-ENG-027 : la frontière entre le monde extérieur et le domaine.
 *
 * Requête HTTP comme soumission de formulaire passent par ces schémas, donc un
 * défaut ici est un défaut partout.
 */
describe("Validation d'une invitation de gestionnaire", () => {
  const ORG = '0a000000-0000-4000-8000-000000000001';
  const PROPERTY = '0a000000-0000-4000-8000-000000000020';

  const valid = {
    organizationId: ORG,
    name: 'Ibrahima Sow',
    phone: '+224620000010',
    email: '',
    propertyIds: [PROPERTY],
  };

  const fieldErrors = (input: unknown) => {
    const result = inviteManagerSchema.safeParse(input);

    return result.success ? null : Object.keys(result.error.flatten().fieldErrors);
  };

  it('accepte une entrée valide', () => {
    expect(inviteManagerSchema.safeParse(valid).success).toBe(true);
  });

  describe('Nom', () => {
    it('réduit les espaces multiples et retire ceux des extrémités', () => {
      const parsed = inviteManagerSchema.parse({ ...valid, name: '  Ibrahima    Sow  ' });

      expect(parsed.name).toBe('Ibrahima Sow');
    });

    it('refuse un nom vide ou fait d espaces, ou absent', () => {
      expect(fieldErrors({ ...valid, name: '' })).toContain('name');
      expect(fieldErrors({ ...valid, name: '   ' })).toContain('name');
      expect(fieldErrors({ ...valid, name: undefined })).toContain('name');
    });

    it('refuse un nom plus long que la colonne', () => {
      expect(fieldErrors({ ...valid, name: 'a'.repeat(201) })).toContain('name');
      expect(inviteManagerSchema.safeParse({ ...valid, name: 'a'.repeat(200) }).success).toBe(true);
    });
  });

  describe('Téléphone', () => {
    it('normalise le numéro', () => {
      expect(inviteManagerSchema.parse({ ...valid, phone: '+224 620 00 00 10' }).phone).toBe(
        '+224620000010',
      );
    });

    it('refuse un numéro local, en donnant un exemple de format', () => {
      const result = inviteManagerSchema.safeParse({ ...valid, phone: '620 00 00 10' });

      expect(result.success).toBe(false);
      expect(JSON.stringify(result.error?.flatten().fieldErrors.phone)).toContain('+224');
    });

    it('refuse un numéro absent', () => {
      expect(fieldErrors({ ...valid, phone: undefined })).toContain('phone');
    });
  });

  describe('Email', () => {
    it('est facultatif : absent, null, vide et espaces valent null', () => {
      for (const email of [undefined, null, '', '   ']) {
        expect(inviteManagerSchema.parse({ ...valid, email }).email).toBeNull();
      }
    });

    it('accepte une adresse valable, sans ses espaces de bord', () => {
      expect(inviteManagerSchema.parse({ ...valid, email: ' ibrahima@example.com ' }).email).toBe(
        'ibrahima@example.com',
      );
    });

    it('refuse une adresse mal formée', () => {
      for (const email of ['pas-un-email', 'a@', '@b.com', 'a b@c.com']) {
        expect(fieldErrors({ ...valid, email }), email).toContain('email');
      }
    });
  });

  describe('Immeubles (DEC-042)', () => {
    it('exige au moins un immeuble', () => {
      expect(fieldErrors({ ...valid, propertyIds: [] })).toContain('propertyIds');
      expect(fieldErrors({ ...valid, propertyIds: undefined })).toContain('propertyIds');
    });

    it('retire les doublons au lieu de les refuser', () => {
      const parsed = inviteManagerSchema.parse({ ...valid, propertyIds: [PROPERTY, PROPERTY] });

      expect(parsed.propertyIds).toEqual([PROPERTY]);
    });

    it('refuse un identifiant qui n est pas un UUID', () => {
      expect(fieldErrors({ ...valid, propertyIds: ['pas-un-uuid'] })).toContain('propertyIds');
      expect(fieldErrors({ ...valid, propertyIds: [42] })).toContain('propertyIds');
    });

    it('borne le nombre d immeubles d une même demande', () => {
      const many = Array.from(
        { length: MANAGER_PROPERTIES_MAX + 1 },
        (_, index) => `0a000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      );

      expect(fieldErrors({ ...valid, propertyIds: many })).toContain('propertyIds');
      expect(
        inviteManagerSchema.safeParse({
          ...valid,
          propertyIds: many.slice(0, MANAGER_PROPERTIES_MAX),
        }).success,
      ).toBe(true);
    });
  });

  describe('Organisation', () => {
    it('exige un identifiant valable', () => {
      expect(fieldErrors({ ...valid, organizationId: 'pas-un-uuid' })).toContain('organizationId');
      expect(fieldErrors({ ...valid, organizationId: undefined })).toContain('organizationId');
    });
  });

  it('ne laisse passer aucun champ de permission : la délégation fine est hors MVP (DEC-025)', () => {
    const parsed = inviteManagerSchema.parse({ ...valid, permissions: ['property.archive'] });

    expect(parsed).not.toHaveProperty('permissions');
  });

  it("cite tous les champs fautifs d'un coup", () => {
    expect(
      fieldErrors({ organizationId: 'x', name: '', phone: 'x', email: 'x', propertyIds: [] }),
    ).toEqual(expect.arrayContaining(['organizationId', 'name', 'phone', 'email', 'propertyIds']));
  });
});

describe("Validation de l'acceptation", () => {
  it('accepte un mot de passe, une absence ou null : le service décide selon le compte', () => {
    expect(acceptInvitationSchema.safeParse({ password: 'quelque-chose' }).success).toBe(true);
    expect(acceptInvitationSchema.safeParse({}).success).toBe(true);
    expect(acceptInvitationSchema.safeParse({ password: null }).success).toBe(true);
  });

  it("refuse un mot de passe qui n'est pas du texte", () => {
    expect(acceptInvitationSchema.safeParse({ password: 12345 }).success).toBe(false);
    expect(acceptInvitationSchema.safeParse({ password: { a: 1 } }).success).toBe(false);
  });
});

describe('Traduction des formulaires', () => {
  function form(entries: [string, string][]): FormData {
    const data = new FormData();

    for (const [key, value] of entries) data.append(key, value);

    return data;
  }

  it('réunit les cases à cocher de même nom', () => {
    const data = form([
      ['name', 'Ibrahima'],
      ['propertyIds', 'a'],
      ['propertyIds', 'b'],
    ]);

    expect(inviteFields(data).propertyIds).toEqual(['a', 'b']);
    expect(submittedPropertyIds(data)).toEqual(['a', 'b']);
  });

  it('ne convertit aucune valeur : les schémas sont le point unique de conversion', () => {
    const data = form([
      ['name', '  Ibrahima  '],
      ['phone', '+224 620 00 00 10'],
    ]);

    expect(inviteFields(data).name).toBe('  Ibrahima  ');
    expect(inviteFields(data).phone).toBe('+224 620 00 00 10');
  });

  it("renvoie un tableau vide quand aucun immeuble n'est coché", () => {
    expect(inviteFields(form([['name', 'x']])).propertyIds).toEqual([]);
  });

  it('réaffiche la saisie textuelle après un refus', () => {
    const values = submittedInviteValues(
      form([
        ['organizationId', 'org'],
        ['name', 'Ibrahima'],
        ['phone', '+224620000010'],
        ['email', ''],
        ['propertyIds', 'a'],
      ]),
    );

    expect(Object.keys(values).sort()).toEqual([...INVITE_FIELD_NAMES].sort());
    expect(values.name).toBe('Ibrahima');
    expect(values).not.toHaveProperty('propertyIds');
  });

  describe('Confirmation du mot de passe', () => {
    it('ne dit rien quand les deux saisies sont identiques', () => {
      expect(
        passwordConfirmationError(
          form([
            ['password', 'mot-de-passe-solide'],
            ['passwordConfirmation', 'mot-de-passe-solide'],
          ]),
        ),
      ).toBeNull();
    });

    it('signale deux saisies différentes', () => {
      expect(
        passwordConfirmationError(
          form([
            ['password', 'mot-de-passe-solide'],
            ['passwordConfirmation', 'mot-de-passe-solidf'],
          ]),
        ),
      ).toMatch(/pas identiques/);
    });

    it("ne juge pas un formulaire sans confirmation, qui est celui d'un compte actif", () => {
      expect(passwordConfirmationError(form([['x', 'y']]))).toBeNull();
    });
  });
});
