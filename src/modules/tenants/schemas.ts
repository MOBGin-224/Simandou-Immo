import { z } from 'zod';

import { normalizePhone } from '@/lib/phone';

import {
  TENANT_EMAIL_MAX_LENGTH,
  TENANT_LIST_DEFAULT_PAGE_SIZE,
  TENANT_LIST_FILTERS,
  TENANT_LIST_MAX_PAGE_SIZE,
  TENANT_NAME_MAX_LENGTH,
} from './constants';

/**
 * Schémas de validation du module Locataires (MVP-ENG-027, API sections 15 et 16).
 *
 * Ils sont la frontière entre le monde extérieur et le domaine : requête HTTP
 * comme soumission de formulaire passent par ici.
 */

/** Réduit toute suite d'espaces à un seul, et retire ceux des extrémités. */
function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

const UUID_MESSAGE = 'Identifiant invalide.';

/** Nom obligatoire, normalisé avant vérification de sa longueur. */
const name = z
  .string('Le nom est requis.')
  .transform(collapseWhitespace)
  .refine((value) => value.length > 0, 'Le nom est requis.')
  .refine(
    (value) => value.length <= TENANT_NAME_MAX_LENGTH,
    `Le nom ne peut pas dépasser ${TENANT_NAME_MAX_LENGTH} caractères.`,
  );

/**
 * Téléphone au format international, normalisé (DEC-032).
 *
 * Aucun indicatif n'est deviné : voir `normalizePhone`. Le message donne un
 * exemple, parce que « format invalide » ne dit pas quoi taper.
 *
 * C'est l'identifiant de connexion du locataire, et il n'est modifiable par
 * personne après coup (DEC-048) : une faute de frappe se corrige en révoquant
 * l'invitation puis en réinvitant.
 */
const phone = z.string('Le numéro de téléphone est requis.').transform((value, context) => {
  const normalized = normalizePhone(value);

  if (normalized === null) {
    context.addIssue({
      code: 'custom',
      message: 'Saisissez le numéro au format international, par exemple +224620000000.',
    });

    return z.NEVER;
  }

  return normalized;
});

/**
 * Email facultatif : absent, vide ou espaces valent `null`.
 *
 * Il reste un identifiant SECONDAIRE, souvent absent sur le marché visé
 * (ADR-008), et plus encore chez un locataire que chez un gestionnaire. Un champ
 * laissé vide n'est donc pas une erreur.
 */
const email = z
  .string()
  .nullish()
  .transform((value) => {
    if (value === null || value === undefined) return null;

    const trimmed = value.trim();

    return trimmed.length === 0 ? null : trimmed;
  })
  .refine(
    (value) => value === null || z.email().safeParse(value).success,
    "L'adresse email n'est pas valide.",
  )
  .refine(
    (value) => value === null || value.length <= TENANT_EMAIL_MAX_LENGTH,
    `L'adresse email ne peut pas dépasser ${TENANT_EMAIL_MAX_LENGTH} caractères.`,
  );

/**
 * Invitation d'un locataire (API section 16, DEC-046).
 *
 * UN logement, et non une liste d'immeubles : un locataire est invité à l'espace
 * locataire d'un logement désigné. C'est aussi ce logement qui détermine
 * l'organisation, donc aucun `organizationId` n'est demandé : le déduire évite
 * qu'un client puisse annoncer une organisation que le logement contredirait.
 *
 * **Aucun champ `channel`** : DEC-026 n'offre qu'un lien de partage, que
 * l'inviteur transmet par son propre moyen. **Aucune date d'entrée ni montant de
 * loyer** : ils appartiennent au bail, au Lot 8.
 */
export const inviteTenantSchema = z.object({
  apartmentId: z.string('Logement requis.').pipe(z.uuid(UUID_MESSAGE)),
  name,
  phone,
  email,
});

export type InviteTenantInput = z.output<typeof inviteTenantSchema>;

/**
 * Identité d'une personne locataire : son nom, son numéro, son email facultatif.
 *
 * Exporté pour le module Contrats, qui crée la personne depuis le bail depuis le
 * Lot 8b (DEC-051). C'est le pendant de `resolveTenantPerson` : la saisie et la
 * règle d'identité restent définies au même endroit, sinon le bail finirait par
 * accepter un numéro que l'invitation refuse.
 */
export const tenantPersonSchema = z.object({ name, phone, email });

export type TenantPersonInput = z.output<typeof tenantPersonSchema>;

/**
 * Modification d'un locataire (API section 15, DEC-048).
 *
 * **Le nom uniquement.** Le téléphone et l'email ne sont modifiables par
 * personne au MVP, faute du mécanisme de vérification qu'exigent SEC-049 et
 * SEC-050. Le schéma ne les accepte donc pas : un champ ignoré en silence
 * laisserait croire qu'il a été pris en compte.
 */
export const updateTenantSchema = z.object({ name });

export type UpdateTenantInput = z.output<typeof updateTenantSchema>;

/**
 * Acceptation d'une invitation (API section 14).
 *
 * Le mot de passe est FACULTATIF au schéma : un invité qui possède déjà un compte
 * actif n'en fournit aucun, et son éventuel envoi est ignoré (DEC-041). C'est le
 * cas d'usage qui l'exige quand l'invité n'a pas encore de compte, parce que lui
 * seul connaît l'état du compte.
 */
export const acceptTenantInvitationSchema = z.object({
  password: z.string().nullish(),
});

export type AcceptTenantInvitationInput = z.output<typeof acceptTenantInvitationSchema>;

/**
 * Paramètres de liste (API section 15).
 *
 * `coerce` est nécessaire : une requête HTTP transmet `page=2`, une chaîne. La
 * borne supérieure de `pageSize` est imposée par le serveur, un client ne devant
 * pas pouvoir demander un volume arbitraire.
 *
 * `propertyId` et `apartmentId` filtrent sans élargir : ils se combinent au
 * périmètre de l'appelant, ils ne le remplacent pas. Un immeuble hors périmètre
 * ne donne donc aucune ligne, et ne distingue pas un immeuble inexistant
 * (ADR-007).
 */
export const listTenantsQuerySchema = z.object({
  page: z.coerce.number('Numéro de page invalide.').int().min(1).default(1),
  pageSize: z.coerce
    .number('Taille de page invalide.')
    .int()
    .min(1)
    .max(TENANT_LIST_MAX_PAGE_SIZE)
    .default(TENANT_LIST_DEFAULT_PAGE_SIZE),
  propertyId: z.string().nullish().pipe(z.uuid(UUID_MESSAGE).nullish()),
  apartmentId: z.string().nullish().pipe(z.uuid(UUID_MESSAGE).nullish()),
  status: z.enum(TENANT_LIST_FILTERS, 'Statut invalide.').default('ALL'),
  /** Recherche sur le nom et le téléphone. Vide vaut absence. */
  search: z
    .string()
    .nullish()
    .transform((value) => {
      const trimmed = (value ?? '').trim();

      return trimmed.length === 0 ? null : trimmed;
    })
    .refine((value) => value === null || value.length <= TENANT_NAME_MAX_LENGTH, {
      message: 'Recherche trop longue.',
    }),
});

export type ListTenantsQuery = z.output<typeof listTenantsQuerySchema>;
