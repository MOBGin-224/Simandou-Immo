import { z } from 'zod';

import { normalizePhone } from '@/lib/phone';

import {
  MANAGER_EMAIL_MAX_LENGTH,
  MANAGER_NAME_MAX_LENGTH,
  MANAGER_PROPERTIES_MAX,
} from './constants';

/**
 * Schémas de validation du module Gestionnaires (MVP-ENG-027, API section 13).
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
    (value) => value.length <= MANAGER_NAME_MAX_LENGTH,
    `Le nom ne peut pas dépasser ${MANAGER_NAME_MAX_LENGTH} caractères.`,
  );

/**
 * Téléphone au format international, normalisé (DEC-032).
 *
 * Aucun indicatif n'est deviné : voir `normalizePhone`. Le message donne un
 * exemple, parce que « format invalide » ne dit pas quoi taper.
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
 * (ADR-008). Un champ laissé vide n'est donc pas une erreur.
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
    (value) => value === null || value.length <= MANAGER_EMAIL_MAX_LENGTH,
    `L'adresse email ne peut pas dépasser ${MANAGER_EMAIL_MAX_LENGTH} caractères.`,
  );

/**
 * Périmètre : au moins un immeuble, sans doublon (DEC-042).
 *
 * Les doublons sont retirés et non refusés : cocher deux fois la même case n'est
 * pas une faute. Le tableau vide est refusé : une invitation sans immeuble
 * n'ouvrirait l'accès à rien, et un gestionnaire sans périmètre n'a aucun sens.
 */
const propertyIds = z
  .array(z.string(UUID_MESSAGE).pipe(z.uuid(UUID_MESSAGE)), 'Sélectionnez au moins un immeuble.')
  .min(1, 'Sélectionnez au moins un immeuble.')
  .max(
    MANAGER_PROPERTIES_MAX,
    `Vous ne pouvez pas attribuer plus de ${MANAGER_PROPERTIES_MAX} immeubles à la fois.`,
  )
  .transform((ids) => [...new Set(ids)]);

/** Invitation d'un gestionnaire (API section 13). */
export const inviteManagerSchema = z.object({
  organizationId: z.string('Organisation requise.').pipe(z.uuid(UUID_MESSAGE)),
  name,
  phone,
  email,
  propertyIds,
});

export type InviteManagerInput = z.output<typeof inviteManagerSchema>;

/**
 * Acceptation d'une invitation (API section 14).
 *
 * Le mot de passe est FACULTATIF au schéma : un invité qui possède déjà un compte
 * actif n'en fournit aucun, et son éventuel envoi est ignoré (DEC-041). C'est le
 * cas d'usage qui l'exige quand l'invité n'a pas encore de compte, parce que lui
 * seul connaît l'état du compte.
 */
export const acceptInvitationSchema = z.object({
  password: z.string().nullish(),
});

export type AcceptInvitationInput = z.output<typeof acceptInvitationSchema>;
