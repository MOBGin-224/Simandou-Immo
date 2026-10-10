import { z } from 'zod';

import { RECEIVABLE_LIST_FILTERS } from '@/modules/receivables/client';

import {
  ALLOCATION_METHODS,
  CHARGE_LIST_DEFAULT_PAGE_SIZE,
  CHARGE_LIST_FILTERS,
  CHARGE_LIST_MAX_PAGE_SIZE,
  CHARGE_SUPPLIER_NAME_MAX_LENGTH,
  CHARGE_TOTAL_AMOUNT_MAX,
  CHARGE_TYPES,
} from './constants';

/**
 * Schémas de validation du module Charges (MVP-ENG-027, API sections 27 à 31).
 *
 * Frontière entre le monde extérieur et le domaine : requête HTTP comme
 * soumission de formulaire passent par ici, et les conventions des lots
 * précédents s'appliquent telles quelles, notamment qu'un formulaire HTML ne
 * transmet que des chaînes et qu'un champ facultatif vide vaut `null`.
 *
 * Deux particularités de ce lot.
 *
 * **La PÉRIODE accepte deux écritures.** L'API documente `periodStart` en date
 * complète, `"2026-09-01"` (section 27), tandis qu'un formulaire de mois
 * transmet `"2026-09"`. Les deux sont acceptées et normalisées en premier jour
 * du mois, ce que la colonne attend et qu'une contrainte de base vérifie. Une
 * date qui n'est pas un premier du mois est en revanche REFUSÉE plutôt que
 * rabattue : « charge du 15 septembre » signifierait que la période commence le
 * 15, ce qui n'existe pas dans le modèle.
 *
 * **La MÉTHODE est validée contre une liste d'une seule valeur.** `EQUAL` est
 * seule au MVP (DEC-029), et le refus des deux autres est explicite : les
 * accepter en les traitant comme `EQUAL` produirait des créances fausses sous un
 * nom juste.
 */

const UUID_MESSAGE = 'Identifiant invalide.';
const PERIOD_MESSAGE = 'Utilisez un mois réel, au format AAAA-MM.';
const DATE_MESSAGE = 'Utilisez une date réelle, au format AAAA-MM-JJ.';

/** Identifiant facultatif, qu'il soit absent, vide ou nul. */
const optionalUuid = z.string().nullish().pipe(z.uuid(UUID_MESSAGE).nullish());

/**
 * La chaîne est-elle une date CIVILE qui existe ?
 *
 * Même contrôle que pour un bail : le motif ne suffit pas, `2026-02-31` le
 * respecte et n'existe pas. La date est donc reconstruite et relue.
 */
function isCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Période d'une charge, donnée en `AAAA-MM` ou `AAAA-MM-01`, rendue en
 * `AAAA-MM-01`.
 *
 * Le mois est vérifié et pas seulement le motif : `2026-13` respecte le format
 * et n'existe pas.
 */
const periodSchema = z
  .string(PERIOD_MESSAGE)
  .transform((value) => value.trim())
  .refine(
    (value) => MONTH_PATTERN.test(value) || (isCivilDate(value) && value.endsWith('-01')),
    'Utilisez un mois réel, au format AAAA-MM, ou son premier jour.',
  )
  .transform((value) => (MONTH_PATTERN.test(value) ? `${value}-01` : value));

/** Période de filtrage, en `AAAA-MM` seulement : un filtre désigne un mois. */
const periodFilterSchema = z
  .string()
  .regex(MONTH_PATTERN, PERIOD_MESSAGE)
  .transform((value) => `${value}-01`);

/** Ramène une saisie facultative à une valeur utile, ou à `null`. */
function emptyToNull(value: string | null): string | null {
  const trimmed = (value ?? '').trim();

  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Montant entier, dans la plus petite unité de la devise (DEC-014).
 *
 * `Number('')` vaut zéro : un montant laissé vide doit donc être écarté AVANT
 * la conversion, faute de quoi une facture sans montant deviendrait une charge
 * de zéro franc, que la base refuserait avec un message incompréhensible.
 */
const totalAmountSchema = z
  .unknown()
  .optional()
  .transform((value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && value.trim().length === 0) return null;

    return Number(value);
  })
  .refine((value) => value !== null, 'Le montant total est obligatoire.')
  .refine((value) => value === null || Number.isFinite(value), 'Le montant doit être un nombre.')
  .transform((value) => value as number)
  .pipe(
    z
      .number('Le montant doit être un nombre.')
      .int('Le montant doit être un nombre entier, sans décimale.')
      .positive('Le montant total doit être supérieur à zéro.')
      .max(CHARGE_TOTAL_AMOUNT_MAX, 'Le montant est trop élevé.'),
  );

/**
 * Création d'une charge (API section 27).
 *
 * La charge naît en `DRAFT` : ce schéma ne porte donc aucun statut, aucune date
 * de publication et aucune part. Ce sont des conséquences de la publication, et
 * les recevoir de l'appelant permettrait d'écrire une charge publiée qui n'a
 * jamais réparti un franc.
 *
 * `currency` est facultative : absente, le cas d'usage prend la devise par
 * défaut de l'organisation (DEC-014), comme le fait le loyer de référence d'un
 * appartement. La donner explicitement reste possible pour un client d'API.
 */
export const createChargeSchema = z.object({
  propertyId: z.string("L'immeuble est obligatoire.").pipe(z.uuid(UUID_MESSAGE)),
  type: z.enum(CHARGE_TYPES, 'Choisissez une nature de charge.'),
  periodStart: periodSchema,
  dueDate: z
    .string("La date d'échéance est obligatoire.")
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, "La date d'échéance est obligatoire.")
    .refine(isCivilDate, DATE_MESSAGE),
  totalAmount: totalAmountSchema,
  currency: z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => emptyToNull(value ?? null))
    .refine(
      (value) => value === null || /^[A-Za-z]{3}$/.test(value),
      'La devise s’écrit sur trois lettres, par exemple GNF.',
    )
    .transform((value) => (value === null ? null : value.toUpperCase())),
  allocationMethod: z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => emptyToNull(value ?? null))
    .refine(
      (value) => value === null || (ALLOCATION_METHODS as readonly string[]).includes(value),
      'Seule la répartition égale est disponible pour le moment.',
    )
    .transform((value) => (value === null ? 'EQUAL' : (value as 'EQUAL'))),
  supplierName: z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => emptyToNull(value ?? null))
    .refine(
      (value) => value === null || value.length <= CHARGE_SUPPLIER_NAME_MAX_LENGTH,
      `Le nom du fournisseur ne peut pas dépasser ${CHARGE_SUPPLIER_NAME_MAX_LENGTH} caractères.`,
    ),
});

/**
 * L'échéance ne précède jamais la période réglée.
 *
 * Même règle que la contrainte de base, et ce n'est pas une redondance inutile :
 * ici l'appelant reçoit un message sur le CHAMP fautif, là la base garantit
 * qu'aucun autre chemin d'écriture ne s'en affranchit.
 */
export const createChargeInputSchema = createChargeSchema.refine(
  (input) => input.dueDate >= input.periodStart,
  {
    path: ['dueDate'],
    message: "La date d'échéance ne peut pas précéder la période couverte.",
  },
);

export type CreateChargeInput = z.output<typeof createChargeInputSchema>;

/**
 * Filtres de la liste des charges (API section 30).
 *
 * `period` filtre sur la période exacte, puisqu'une charge n'en porte qu'une.
 * `status` admet `ALL` par défaut, à la différence de la liste des loyers qui
 * montre les impayés d'abord : une charge n'a pas de situation financière
 * propre, et un brouillon masqué par défaut serait un brouillon oublié.
 */
export const listChargesQuerySchema = z.object({
  page: z.coerce.number('Numéro de page invalide.').int().min(1).default(1),
  pageSize: z.coerce
    .number('Taille de page invalide.')
    .int()
    .min(1)
    .max(CHARGE_LIST_MAX_PAGE_SIZE)
    .default(CHARGE_LIST_DEFAULT_PAGE_SIZE),
  propertyId: optionalUuid,
  period: periodFilterSchema.nullish(),
  type: z.enum(CHARGE_TYPES, 'Nature de charge invalide.').nullish(),
  status: z.enum(CHARGE_LIST_FILTERS, 'Statut invalide.').default('ALL'),
});

export type ListChargesQuery = z.output<typeof listChargesQuerySchema>;

/**
 * Filtres de la liste des créances de charge (API section 26,
 * `GET /charge-allocations`).
 *
 * Les six filtres documentés sont servis. `status` porte les mêmes valeurs que
 * sur les loyers, l'énumération de statut étant commune aux deux créances
 * (DEC-015) : une seule liste de filtres pour les deux évite qu'un même état se
 * filtre différemment selon le type de créance.
 */
export const listChargeAllocationsQuerySchema = z.object({
  page: z.coerce.number('Numéro de page invalide.').int().min(1).default(1),
  pageSize: z.coerce
    .number('Taille de page invalide.')
    .int()
    .min(1)
    .max(CHARGE_LIST_MAX_PAGE_SIZE)
    .default(CHARGE_LIST_DEFAULT_PAGE_SIZE),
  propertyId: optionalUuid,
  apartmentId: optionalUuid,
  /** `users.id` de la personne redevable (DEC-051). */
  tenantId: optionalUuid,
  chargeId: optionalUuid,
  period: periodFilterSchema.nullish(),
  status: z.enum(RECEIVABLE_LIST_FILTERS, 'Statut invalide.').default('ALL'),
});

export type ListChargeAllocationsQuery = z.output<typeof listChargeAllocationsQuerySchema>;
