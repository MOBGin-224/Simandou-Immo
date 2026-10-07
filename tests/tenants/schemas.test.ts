import { describe, expect, it } from 'vitest';

import {
  TENANT_LIST_DEFAULT_PAGE_SIZE,
  TENANT_LIST_MAX_PAGE_SIZE,
  TENANT_NAME_MAX_LENGTH,
} from '../../src/modules/tenants/constants';
import {
  INVITE_FIELD_NAMES,
  inviteFields,
  renameFields,
  submittedInviteValues,
} from '../../src/modules/tenants/form';
import {
  inviteTenantSchema,
  listTenantsQuerySchema,
  updateTenantSchema,
} from '../../src/modules/tenants/schemas';

/**
 * Schémas et traduction des formulaires du module Locataires (MVP-ENG-027).
 *
 * Purs, donc testables sans base : c'est précisément là que se logent les
 * défauts de saisie, un formulaire HTML ne transmettant que des chaînes.
 *
 * Deux absences y sont vérifiées explicitement, parce qu'elles sont des
 * DÉCISIONS et non des oublis : aucun champ de loyer ni de date d'entrée
 * (DEC-046), et aucun champ de téléphone ni d'email à la modification (DEC-048).
 */

/** Construit un FormData à partir de paires, comme un navigateur l'enverrait. */
function form(entries: [string, string][]): FormData {
  const data = new FormData();

  for (const [key, value] of entries) data.append(key, value);

  return data;
}

const APARTMENT = '0a000000-0000-4000-8000-000000000031';

describe("Schéma d'invitation d'un locataire", () => {
  const valid = {
    apartmentId: APARTMENT,
    name: 'Mamadou Diallo',
    phone: '+224620000010',
    email: '',
  };

  it('accepte une saisie minimale et normalise le nom', () => {
    const result = inviteTenantSchema.parse({ ...valid, name: '  Mamadou   Diallo  ' });

    expect(result.name).toBe('Mamadou Diallo');
    expect(result.apartmentId).toBe(APARTMENT);
    expect(result.email).toBeNull();
  });

  it('exige le logement', () => {
    expect(inviteTenantSchema.safeParse({ ...valid, apartmentId: undefined }).success).toBe(false);
    expect(inviteTenantSchema.safeParse({ ...valid, apartmentId: 'pas-un-uuid' }).success).toBe(
      false,
    );
  });

  it('exige un numéro au format international', () => {
    expect(inviteTenantSchema.safeParse({ ...valid, phone: '620000010' }).success).toBe(false);
    expect(inviteTenantSchema.parse({ ...valid, phone: ' +224 620 000 010 ' }).phone).toBe(
      '+224620000010',
    );
  });

  it('refuse un nom vide ou trop long', () => {
    expect(inviteTenantSchema.safeParse({ ...valid, name: '   ' }).success).toBe(false);
    expect(
      inviteTenantSchema.safeParse({ ...valid, name: 'a'.repeat(TENANT_NAME_MAX_LENGTH + 1) })
        .success,
    ).toBe(false);
  });

  it('traite un email absent, vide ou en espaces comme nul', () => {
    for (const email of [undefined, null, '', '   ']) {
      expect(inviteTenantSchema.parse({ ...valid, email }).email).toBeNull();
    }
  });

  it('refuse un email mal formé', () => {
    expect(inviteTenantSchema.safeParse({ ...valid, email: 'pas-un-email' }).success).toBe(false);
  });

  /** DEC-046 : la date d'entrée et le loyer appartiennent au bail, au Lot 8. */
  it("ne retient ni date d'entrée ni montant de loyer, même fournis", () => {
    const result = inviteTenantSchema.parse({
      ...valid,
      startDate: '2026-10-01',
      rentAmount: 1500000,
      currency: 'GNF',
    });

    expect(Object.keys(result).sort()).toEqual(['apartmentId', 'email', 'name', 'phone']);
  });

  /** DEC-026 : aucun canal d'envoi, seulement un lien de partage. */
  it('ne retient aucun champ `channel`', () => {
    const result = inviteTenantSchema.parse({ ...valid, channel: 'WHATSAPP' });

    expect(result).not.toHaveProperty('channel');
  });

  /** L'organisation se déduit du logement : l'annoncer ne doit rien changer. */
  it('ne retient aucun `organizationId`', () => {
    const result = inviteTenantSchema.parse({
      ...valid,
      organizationId: '0b000000-0000-4000-8000-000000000001',
    });

    expect(result).not.toHaveProperty('organizationId');
  });
});

describe('Schéma de modification d un locataire (DEC-048)', () => {
  it('accepte le nom, et le normalise', () => {
    expect(updateTenantSchema.parse({ name: '  Aïssatou   Barry ' }).name).toBe('Aïssatou Barry');
  });

  it('exige le nom', () => {
    expect(updateTenantSchema.safeParse({}).success).toBe(false);
    expect(updateTenantSchema.safeParse({ name: '  ' }).success).toBe(false);
  });

  /** Le cœur de DEC-048 : le téléphone et l'email ne passent pas, même fournis. */
  it('ne retient ni téléphone ni email, même fournis', () => {
    const result = updateTenantSchema.parse({
      name: 'Nouveau nom',
      phone: '+224620009999',
      email: 'change@example.com',
    });

    expect(Object.keys(result)).toEqual(['name']);
  });
});

describe('Paramètres de liste des locataires', () => {
  it('applique les valeurs par défaut du serveur', () => {
    const result = listTenantsQuerySchema.parse({});

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(TENANT_LIST_DEFAULT_PAGE_SIZE);
    expect(result.status).toBe('ALL');
    expect(result.search).toBeNull();
    expect(result.propertyId ?? null).toBeNull();
    expect(result.apartmentId ?? null).toBeNull();
  });

  it('convertit les nombres transmis en chaînes par une requête HTTP', () => {
    const result = listTenantsQuerySchema.parse({ page: '3', pageSize: '50' });

    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(50);
  });

  it('refuse une taille de page au-delà de la borne du serveur', () => {
    expect(
      listTenantsQuerySchema.safeParse({ pageSize: TENANT_LIST_MAX_PAGE_SIZE + 1 }).success,
    ).toBe(false);
  });

  it('refuse un statut inconnu', () => {
    expect(listTenantsQuerySchema.safeParse({ status: 'INCONNU' }).success).toBe(false);
  });

  it('accepte chacun des statuts dérivés', () => {
    for (const status of [
      'ALL',
      'INVITED',
      'INVITATION_EXPIRED',
      'ACTIVE',
      'SUSPENDED',
      'REVOKED',
    ]) {
      expect(listTenantsQuerySchema.safeParse({ status }).success).toBe(true);
    }
  });

  it('traite une recherche vide comme une absence de recherche', () => {
    expect(listTenantsQuerySchema.parse({ search: '   ' }).search).toBeNull();
  });

  it('refuse un identifiant de filtre mal formé', () => {
    expect(listTenantsQuerySchema.safeParse({ propertyId: 'pas-un-uuid' }).success).toBe(false);
  });
});

describe("Champs du formulaire d'invitation", () => {
  it('lit les quatre champs de l écran, et aucun autre', () => {
    const data = form([
      ['apartmentId', APARTMENT],
      ['name', 'Mamadou'],
      ['phone', '+224620000010'],
      ['email', ''],
      ['rentAmount', '1500000'],
    ]);

    const fields = inviteFields(data);

    expect(Object.keys(fields).sort()).toEqual([...INVITE_FIELD_NAMES].sort());
    expect(fields).not.toHaveProperty('rentAmount');
  });

  it('renvoie la saisie textuelle pour la réafficher après un refus', () => {
    const values = submittedInviteValues(
      form([
        ['apartmentId', APARTMENT],
        ['name', 'Mamadou'],
        ['phone', '620000010'],
        ['email', 'test@example.com'],
      ]),
    );

    expect(Object.keys(values).sort()).toEqual([...INVITE_FIELD_NAMES].sort());
    expect(values.phone).toBe('620000010');
  });

  it('ne lit que le nom pour une modification (DEC-048)', () => {
    const fields = renameFields(
      form([
        ['name', 'Aïssatou'],
        ['phone', '+224620009999'],
      ]),
    );

    expect(Object.keys(fields)).toEqual(['name']);
    expect(fields.name).toBe('Aïssatou');
  });
});
