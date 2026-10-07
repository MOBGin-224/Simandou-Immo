import { z } from 'zod';

import {
  LEASE_AMOUNT_MAX,
  LEASE_DUE_DAY_MAX,
  LEASE_DUE_DAY_MIN,
  LEASE_LIST_DEFAULT_PAGE_SIZE,
  LEASE_LIST_FILTERS,
  LEASE_LIST_MAX_PAGE_SIZE,
  LEASE_TERMINATION_REASON_MAX_LENGTH,
} from './constants';

/**
 * Schémas de validation du module Contrats (MVP-ENG-027, API section 17).
 *
 * Ils sont la frontière entre le monde extérieur et le domaine : requête HTTP
 * comme soumission de formulaire passent par ici.
 *
 * Les conventions du module Appartements s'appliquent telles quelles, et pour les
 * mêmes raisons : un champ facultatif vide vaut `null` et non chaîne vide, un
 * champ absent en modification signifie « ne pas y toucher » là où un champ vide
 * signifie « effacer », et un formulaire HTML ne transmet que des chaînes.
 *
 * D'où la construction en deux temps de chaque champ facultatif : une variante de
 * création, qui ramène l'absence à une valeur par défaut, et une variante de
 * modification, qui la laisse `undefined`. Confondre les deux rendrait impossible
 * soit l'effacement, soit la modification partielle.
 */

const UUID_MESSAGE = 'Identifiant invalide.';
const DATE_MESSAGE = 'Utilisez une date réelle, au format AAAA-MM-JJ.';

/**
 * La chaîne est-elle une date CIVILE qui existe ?
 *
 * Le motif ne suffit pas : `2026-02-31` le respecte et n'existe pas. On
 * reconstruit donc la date et on vérifie qu'elle se relit à l'identique.
 *
 * Une date civile et non un instant : un bail commence un jour, et le convertir
 * en `Date` ferait dépendre la date enregistrée du fuseau du serveur. La chaîne
 * validée part telle quelle vers une colonne `date`.
 */
function isCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Ramène une saisie facultative à une valeur utile, ou à `null`. */
function emptyToNull(value: string | null): string | null {
  const trimmed = (value ?? '').trim();

  return trimmed.length === 0 ? null : trimmed;
}

/** Date obligatoire. */
function requiredDate(missing: string) {
  return z
    .string(missing)
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, missing)
    .refine(isCivilDate, DATE_MESSAGE);
}

/** Date facultative à la création : absente ou vide valent `null`. */
function creationDate() {
  return z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => emptyToNull(value ?? null))
    .refine((value) => value === null || isCivilDate(value), DATE_MESSAGE);
}

/** Date facultative à la modification : absente intouchée, vide effacée. */
function patchDate() {
  return z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => (value === undefined ? undefined : emptyToNull(value)))
    .refine((value) => value === undefined || value === null || isCivilDate(value), DATE_MESSAGE);
}

/**
 * Nombre entier facultatif, ramené à `null` avant toute conversion.
 *
 * `Number('')` vaut zéro : sans cette précaution, une caution laissée vide
 * deviendrait zéro par accident plutôt que par décision, et un champ numérique
 * vide d'une modification effacerait la valeur au lieu de la laisser.
 */
function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim().length === 0) return null;

  return Number(value);
}

/** Montant entier dans la plus petite unité de la devise (DEC-014). */
function amountRules(field: string) {
  return z
    .number(`${field} doit être un nombre.`)
    .int(`${field} doit être un nombre entier, sans décimale.`)
    .min(0, `${field} ne peut pas être négatif.`)
    .max(LEASE_AMOUNT_MAX, `${field} est trop élevé.`);
}

function requiredAmount(field: string, missing: string) {
  return z
    .unknown()
    .optional()
    .transform(toNullableNumber)
    .refine((value) => value !== null, missing)
    .refine((value) => value === null || Number.isFinite(value), `${field} doit être un nombre.`)
    .transform((value) => value as number)
    .pipe(amountRules(field));
}

function creationAmount(field: string, fallback: number) {
  return z
    .unknown()
    .optional()
    .transform((value) => toNullableNumber(value) ?? fallback)
    .refine((value) => Number.isFinite(value), `${field} doit être un nombre.`)
    .pipe(amountRules(field));
}

function patchAmount(field: string) {
  return z
    .unknown()
    .optional()
    .transform((value) => (value === undefined ? undefined : toNullableNumber(value)))
    .refine(
      (value) => value === undefined || (value !== null && Number.isFinite(value)),
      `${field} doit être un nombre.`,
    )
    .transform((value) => value as number | undefined)
    .pipe(amountRules(field).optional());
}

const DUE_DAY_MESSAGE = `Le jour d'échéance va de ${LEASE_DUE_DAY_MIN} à ${LEASE_DUE_DAY_MAX}.`;

function dueDayRules() {
  return z
    .number(DUE_DAY_MESSAGE)
    .int(DUE_DAY_MESSAGE)
    .min(LEASE_DUE_DAY_MIN, DUE_DAY_MESSAGE)
    .max(LEASE_DUE_DAY_MAX, DUE_DAY_MESSAGE);
}

/** Devise sur trois lettres majuscules, comme la colonne l'exige (DEC-014). */
function currencyRules(missing: string) {
  return z
    .string(missing)
    .transform((value) => value.trim().toUpperCase())
    .refine((value) => value.length > 0, missing)
    .refine(
      (value) => /^[A-Z]{3}$/.test(value),
      'La devise se note sur trois lettres, par exemple GNF.',
    );
}

/**
 * Création d'un bail (API section 17, MVP-BACKLOG-032).
 *
 * `tenantId` est un `users.id`, l'identité métier de la personne (DEC-051) : le
 * bail rattache une PERSONNE à un logement, et cette personne n'a pas forcément
 * d'accès au produit. L'organisation et l'immeuble ne sont PAS demandés : ils se
 * déduisent du logement, et les recevoir de l'appelant ouvrirait la porte à un
 * couple incohérent.
 *
 * `endDate` est facultative : sur ce marché, un bail à durée indéterminée est le
 * cas courant (BR-030). `depositAmount` vaut zéro par défaut, une caution
 * absente étant une caution de zéro.
 */
export const createLeaseSchema = z.object({
  apartmentId: z.string('Logement requis.').pipe(z.uuid(UUID_MESSAGE)),
  tenantId: z.string('Locataire requis.').pipe(z.uuid(UUID_MESSAGE)),
  startDate: requiredDate('La date de début est requise.'),
  endDate: creationDate(),
  rentAmount: requiredAmount('Le loyer', 'Le montant du loyer est requis.'),
  currency: currencyRules('La devise est requise.'),
  dueDay: requiredAmount("Le jour d'échéance", "Le jour d'échéance est requis.").pipe(
    dueDayRules(),
  ),
  depositAmount: creationAmount('La caution', 0),
});

export type CreateLeaseInput = z.output<typeof createLeaseSchema>;

/**
 * Modification d'un bail (API section 17).
 *
 * Ni le logement ni le locataire : ils DÉFINISSENT la relation locative, et en
 * changer un ferait un autre bail. Pour déplacer un locataire, on clôture et on
 * recrée, ce qui conserve l'historique du logement (BR-027).
 *
 * Tous les champs sont facultatifs, c'est une modification partielle. Un champ
 * absent n'est pas touché ; `endDate` à vide retire le terme prévu.
 */
export const updateLeaseSchema = z.object({
  startDate: z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => (value === undefined ? undefined : emptyToNull(value)))
    .refine((value) => value === undefined || (value !== null && isCivilDate(value)), DATE_MESSAGE)
    .transform((value) => value as string | undefined),
  endDate: patchDate(),
  rentAmount: patchAmount('Le loyer'),
  currency: currencyRules('La devise est requise.').optional(),
  dueDay: patchAmount("Le jour d'échéance").pipe(dueDayRules().optional()),
  depositAmount: patchAmount('La caution'),
});

export type UpdateLeaseInput = z.output<typeof updateLeaseSchema>;

/**
 * Clôture d'un bail (API section 17).
 *
 * `terminationDate` devient la date de fin du bail : c'est elle qui empêchera la
 * génération d'échéances au-delà, au Lot 9. `reason` est libre et facultative
 * (BR-033) : la documentation n'en donne qu'un exemple, « move_out », et
 * inventer la liste des autres serait décider d'un vocabulaire métier.
 */
export const terminateLeaseSchema = z.object({
  terminationDate: requiredDate('La date de clôture est requise.'),
  reason: z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => emptyToNull(value ?? null))
    .refine(
      (value) => value === null || value.length <= LEASE_TERMINATION_REASON_MAX_LENGTH,
      `La raison ne peut pas dépasser ${LEASE_TERMINATION_REASON_MAX_LENGTH} caractères.`,
    ),
});

export type TerminateLeaseInput = z.output<typeof terminateLeaseSchema>;

/**
 * Paramètres de liste (API section 17).
 *
 * `apartmentId`, `propertyId` et `tenantId` filtrent sans élargir : ils se
 * combinent au périmètre de l'appelant, ils ne le remplacent pas. Un immeuble
 * hors périmètre ne donne donc aucune ligne, et ne se distingue pas d'un
 * immeuble inexistant (ADR-007).
 */
export const listLeasesQuerySchema = z.object({
  page: z.coerce.number('Numéro de page invalide.').int().min(1).default(1),
  pageSize: z.coerce
    .number('Taille de page invalide.')
    .int()
    .min(1)
    .max(LEASE_LIST_MAX_PAGE_SIZE)
    .default(LEASE_LIST_DEFAULT_PAGE_SIZE),
  propertyId: z.string().nullish().pipe(z.uuid(UUID_MESSAGE).nullish()),
  apartmentId: z.string().nullish().pipe(z.uuid(UUID_MESSAGE).nullish()),
  /** `users.id` de la personne locataire (DEC-051). */
  tenantId: z.string().nullish().pipe(z.uuid(UUID_MESSAGE).nullish()),
  status: z.enum(LEASE_LIST_FILTERS, 'Statut invalide.').default('ALL'),
});

export type ListLeasesQuery = z.output<typeof listLeasesQuerySchema>;
