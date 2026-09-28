import { z } from 'zod';

import {
  PROPERTY_ADDRESS_MAX_LENGTH,
  PROPERTY_CITY_MAX_LENGTH,
  PROPERTY_DESCRIPTION_MAX_LENGTH,
  PROPERTY_DISTRICT_MAX_LENGTH,
  PROPERTY_LIST_DEFAULT_PAGE_SIZE,
  PROPERTY_LIST_FILTERS,
  PROPERTY_LIST_MAX_PAGE_SIZE,
  PROPERTY_NAME_MAX_LENGTH,
} from './constants';

/**
 * Schémas de validation du module Immeubles (MVP-ENG-027, API section 47).
 *
 * Ils sont la frontière entre le monde extérieur et le domaine : tout ce qui
 * entre, requête HTTP comme soumission de formulaire, passe par ici.
 *
 * Trois particularités tiennent aux formulaires HTML et à la sémantique de
 * PATCH, non au goût.
 *
 * 1. Un champ facultatif laissé vide arrive comme une CHAÎNE VIDE, jamais comme
 *    `undefined`. Sans conversion, la base stockerait des chaînes vides à la
 *    place de NULL, et « ville inconnue » deviendrait indistinguable de « ville
 *    renseignée avec rien ».
 *
 * 2. À la création, un champ absent vaut `null`. À la modification, un champ
 *    ABSENT signifie « ne pas y toucher » et un champ VIDE signifie « effacer ».
 *    Confondre les deux rendrait impossible soit l'effacement, soit la
 *    modification partielle.
 *
 * 3. Les espaces sont normalisés. « Immeuble  Camayenne » et « Immeuble
 *    Camayenne » désignent le même bâtiment : sans normalisation, la contrainte
 *    d'unicité du nom accepterait les deux.
 */

/** Réduit toute suite d'espaces à un seul, et retire ceux des extrémités. */
export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Ramène une saisie facultative à une valeur utile, ou à `null`. */
function emptyToNull(value: string | null): string | null {
  if (value === null) return null;

  const collapsed = collapseWhitespace(value);

  return collapsed.length === 0 ? null : collapsed;
}

/** Texte obligatoire, normalisé avant vérification de sa longueur. */
function requiredText(max: number, missing: string, tooLong: string) {
  return z
    .string(missing)
    .transform(collapseWhitespace)
    .refine((value) => value.length > 0, missing)
    .refine((value) => value.length <= max, tooLong);
}

/** Texte facultatif à la création : absent ou vide valent `null`. */
function creationText(max: number, tooLong: string) {
  return z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => emptyToNull(value ?? null))
    .refine((value) => value === null || value.length <= max, tooLong);
}

/**
 * Texte facultatif à la modification.
 *
 * Absent reste `undefined`, donc intouché. Vide devient `null`, donc effacé. La
 * différence est exactement ce que PATCH doit exprimer.
 */
function patchText(max: number, tooLong: string) {
  return z
    .union([z.string(), z.null()])
    .transform(emptyToNull)
    .refine((value) => value === null || value.length <= max, tooLong)
    .optional();
}

const NAME_MISSING = "Le nom de l'immeuble est obligatoire.";
const NAME_TOO_LONG = `Le nom ne peut pas dépasser ${PROPERTY_NAME_MAX_LENGTH} caractères.`;
const ADDRESS_TOO_LONG = `L'adresse ne peut pas dépasser ${PROPERTY_ADDRESS_MAX_LENGTH} caractères.`;
const CITY_TOO_LONG = `La ville ne peut pas dépasser ${PROPERTY_CITY_MAX_LENGTH} caractères.`;
const DISTRICT_TOO_LONG = `Le quartier ne peut pas dépasser ${PROPERTY_DISTRICT_MAX_LENGTH} caractères.`;
const DESCRIPTION_TOO_LONG = `La description ne peut pas dépasser ${PROPERTY_DESCRIPTION_MAX_LENGTH} caractères.`;

/**
 * Création d'un immeuble (MVP-BACKLOG-017, PRD 10.3).
 *
 * `organizationId` est exigé explicitement : un utilisateur peut être rattaché à
 * plusieurs organisations (BR-010), et la deviner serait un choix arbitraire sur
 * la frontière d'isolation du produit. L'interface préremplit la seule
 * organisation disponible lorsqu'il n'y en a qu'une.
 */
export const createPropertySchema = z.object({
  organizationId: z.string().uuid("L'organisation est obligatoire."),
  name: requiredText(PROPERTY_NAME_MAX_LENGTH, NAME_MISSING, NAME_TOO_LONG),
  address: creationText(PROPERTY_ADDRESS_MAX_LENGTH, ADDRESS_TOO_LONG),
  city: creationText(PROPERTY_CITY_MAX_LENGTH, CITY_TOO_LONG),
  district: creationText(PROPERTY_DISTRICT_MAX_LENGTH, DISTRICT_TOO_LONG),
  description: creationText(PROPERTY_DESCRIPTION_MAX_LENGTH, DESCRIPTION_TOO_LONG),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;

/**
 * Modification d'un immeuble.
 *
 * Tous les champs sont facultatifs, mais au moins un doit être présent : une
 * requête vide écrirait `updated_at` sans rien changer, et ferait apparaître une
 * modification inexistante dans le futur journal d'activité.
 *
 * `organizationId` est absent à dessein : un immeuble ne change pas
 * d'organisation. Le déplacer franchirait la frontière d'isolation (BR-006).
 */
export const updatePropertySchema = z
  .object({
    name: requiredText(PROPERTY_NAME_MAX_LENGTH, NAME_MISSING, NAME_TOO_LONG).optional(),
    address: patchText(PROPERTY_ADDRESS_MAX_LENGTH, ADDRESS_TOO_LONG),
    city: patchText(PROPERTY_CITY_MAX_LENGTH, CITY_TOO_LONG),
    district: patchText(PROPERTY_DISTRICT_MAX_LENGTH, DISTRICT_TOO_LONG),
    description: patchText(PROPERTY_DESCRIPTION_MAX_LENGTH, DESCRIPTION_TOO_LONG),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    error: 'Aucune modification fournie.',
    path: ['name'],
  });

export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;

/**
 * Paramètres de liste.
 *
 * `coerce` est nécessaire : une requête HTTP transmet `page=2`, une chaîne. La
 * borne supérieure de `pageSize` est imposée par le serveur, un client ne devant
 * pas pouvoir demander un volume arbitraire.
 */
export const listPropertiesQuerySchema = z.object({
  page: z.coerce.number('Numéro de page invalide.').int().min(1).default(1),
  pageSize: z.coerce
    .number('Taille de page invalide.')
    .int()
    .min(1)
    .max(PROPERTY_LIST_MAX_PAGE_SIZE)
    .default(PROPERTY_LIST_DEFAULT_PAGE_SIZE),
  /** Recherche sur le nom, la ville et le quartier. Vide vaut absence. */
  search: creationText(PROPERTY_NAME_MAX_LENGTH, 'Recherche trop longue.'),
  filter: z.enum(PROPERTY_LIST_FILTERS).default('ACTIVE'),
  /** Restreint la liste à une organisation. Absent, toutes celles de l'utilisateur. */
  organizationId: z
    .union([z.string().uuid('Organisation invalide.'), z.literal(''), z.null()])
    .optional()
    .transform((value) => (value === '' || value === undefined ? null : value)),
});

export type ListPropertiesQuery = z.infer<typeof listPropertiesQuerySchema>;
