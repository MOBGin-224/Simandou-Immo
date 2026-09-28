import { z } from 'zod';

import {
  APARTMENT_AREA_MAX,
  APARTMENT_BULK_MAX,
  APARTMENT_FLOOR_MAX,
  APARTMENT_FLOOR_MIN,
  APARTMENT_LIST_DEFAULT_PAGE_SIZE,
  APARTMENT_LIST_FILTERS,
  APARTMENT_LIST_MAX_PAGE_SIZE,
  APARTMENT_NUMBER_MAX_LENGTH,
  APARTMENT_RENT_MAX,
  APARTMENT_STATUSES,
  APARTMENT_TYPE_MAX_LENGTH,
} from './constants';

/**
 * Schémas de validation du module Appartements (MVP-ENG-027, API section 47).
 *
 * Ils sont la frontière entre le monde extérieur et le domaine : requête HTTP
 * comme soumission de formulaire passent par ici.
 *
 * Les trois particularités du module Immeubles s'appliquent telles quelles : un
 * champ facultatif vide vaut `null` et non chaîne vide, un champ absent en PATCH
 * signifie « ne pas y toucher » là où un champ vide signifie « effacer », et les
 * espaces sont normalisés avant toute vérification d'unicité.
 *
 * Deux particularités lui sont propres, toutes deux venues des nombres.
 *
 * 1. Un formulaire HTML transmet des CHAÎNES, et `Number('')` vaut zéro. Sans
 *    précaution, un étage laissé vide deviendrait le rez-de-chaussée et une
 *    surface vide un zéro que la base refuserait. Chaque champ numérique est
 *    donc ramené à `null` AVANT toute conversion.
 *
 * 2. La virgule décimale est celle du français. « 78,5 » est ce qu'un
 *    utilisateur guinéen tape pour une surface : le refuser serait un défaut de
 *    localisation, pas une rigueur.
 *
 * D'où la construction en deux temps de chaque champ : une base commune qui
 * porte la conversion et les bornes, puis deux variantes. `atCreation` ramène
 * l'absence à `null`, `atUpdate` la laisse `undefined`. Confondre les deux
 * rendrait impossible soit l'effacement, soit la modification partielle.
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

/** Texte facultatif à la modification : absent intouché, vide effacé. */
function patchText(max: number, tooLong: string) {
  return z
    .union([z.string(), z.null()])
    .transform(emptyToNull)
    .refine((value) => value === null || value.length <= max, tooLong)
    .optional();
}

/**
 * Nombre facultatif, PRÉSENT dans l'entrée.
 *
 * Une chaîne vide, une chaîne d'espaces et `null` valent tous `null`. La virgule
 * française est acceptée pour les décimales.
 */
function nullableNumber(invalid: string) {
  return z
    .union([z.string(), z.number(), z.null()])
    .transform((value) => {
      if (value === null) return null;
      if (typeof value === 'number') return value;

      const text = value.replace(',', '.').trim();

      return text.length === 0 ? null : Number(text);
    })
    .refine((value) => value === null || Number.isFinite(value), invalid);
}

/** Variante création d'un champ facultatif : l'absence vaut `null`. */
function atCreation<Schema extends z.ZodType>(schema: Schema) {
  return schema.optional().transform((value) => (value === undefined ? null : value));
}

const NUMBER_MISSING = "La référence de l'appartement est obligatoire.";
const NUMBER_TOO_LONG = `La référence ne peut pas dépasser ${APARTMENT_NUMBER_MAX_LENGTH} caractères.`;
const TYPE_TOO_LONG = `Le type ne peut pas dépasser ${APARTMENT_TYPE_MAX_LENGTH} caractères.`;
const FLOOR_INVALID = "L'étage doit être un nombre entier.";
const FLOOR_OUT_OF_RANGE = `L'étage doit être compris entre ${APARTMENT_FLOOR_MIN} et ${APARTMENT_FLOOR_MAX}.`;
const AREA_INVALID = 'La surface doit être un nombre.';
const AREA_OUT_OF_RANGE = `La surface doit être supérieure à 0 et ne pas dépasser ${APARTMENT_AREA_MAX} m².`;
const RENT_INVALID = 'Le loyer doit être un nombre entier.';
const RENT_OUT_OF_RANGE = `Le loyer doit être positif et ne pas dépasser ${APARTMENT_RENT_MAX}.`;
const CURRENCY_INVALID = 'La devise doit être un code de trois lettres, par exemple GNF.';
const STATUS_INVALID = 'Statut inconnu.';

/** Étage : entier, borné, facultatif. Le sous-sol est recevable. */
const floorBase = nullableNumber(FLOOR_INVALID)
  .refine((value) => value === null || Number.isInteger(value), FLOOR_INVALID)
  .refine(
    (value) => value === null || (value >= APARTMENT_FLOOR_MIN && value <= APARTMENT_FLOOR_MAX),
    FLOOR_OUT_OF_RANGE,
  );

/**
 * Surface : strictement positive, arrondie à deux décimales.
 *
 * La contrainte `apartments_area_positive` refuse déjà zéro côté base. La
 * vérifier ici permet un message qui désigne le champ, au lieu d'une erreur de
 * contrainte illisible. L'arrondi correspond à la précision de la colonne :
 * accepter une troisième décimale pour la perdre en base serait mentir à
 * l'utilisateur.
 */
const areaBase = nullableNumber(AREA_INVALID)
  .refine(
    (value) => value === null || (value > 0 && value <= APARTMENT_AREA_MAX),
    AREA_OUT_OF_RANGE,
  )
  .transform((value) => (value === null ? null : Math.round(value * 100) / 100));

/** Montant de loyer : entier positif, dans la plus petite unité (DEC-014). */
const rentAmountBase = nullableNumber(RENT_INVALID)
  .refine((value) => value === null || Number.isInteger(value), RENT_INVALID)
  .refine(
    (value) => value === null || (value >= 0 && value <= APARTMENT_RENT_MAX),
    RENT_OUT_OF_RANGE,
  );

/** Devise ISO 4217, normalisée en majuscules (DEC-014). */
const currencyBase = z
  .union([z.string(), z.null()])
  .transform((value) => {
    const text = emptyToNull(value);

    return text === null ? null : text.toUpperCase();
  })
  .refine((value) => value === null || /^[A-Z]{3}$/.test(value), CURRENCY_INVALID);

/**
 * Loyer de référence, montant et devise ensemble (DEC-014).
 *
 * L'objet entier vaut `null` quand le montant est absent : la base refuse un
 * montant sans devise comme une devise sans montant, et laisser passer un couple
 * à moitié rempli produirait une violation de contrainte au lieu d'un message
 * lisible.
 *
 * La devise est facultative EN ENTRÉE seulement. Le cas d'usage la remplit
 * depuis l'organisation, qui porte sa devise par défaut : au MVP il n'y en a
 * qu'une, et demander « GNF » à chaque saisie serait une friction sans contenu.
 * En stockage, elle reste toujours explicite.
 */
const referenceRentBase = z
  .object({
    amount: atCreation(rentAmountBase),
    currency: atCreation(currencyBase),
  })
  .nullable()
  .transform((value) => (value === null || value.amount === null ? null : value));

/**
 * Statut d'occupation (DEC-019).
 *
 * Une chaîne vide vaut absence et non erreur : un `select` non renseigné la
 * transmet, et refuser la saisie pour cette raison serait incompréhensible.
 */
const statusBase = z
  .union([z.string(), z.null()])
  .transform((value) => emptyToNull(value))
  .pipe(z.enum(APARTMENT_STATUSES, STATUS_INVALID).nullable());

/**
 * Création d'un appartement (MVP-BACKLOG-021, API section 12, parcours 3).
 *
 * `propertyId` n'est PAS dans le corps : il vient du chemin de la route, ce qui
 * rend impossible de créer un logement dans un immeuble différent de celui que
 * l'URL désigne. L'organisation n'y est pas non plus, elle est dérivée de
 * l'immeuble : la déduire est ici sans ambiguïté, contrairement à l'immeuble
 * dont l'organisation était un choix réel.
 *
 * Le statut vaut VACANT par défaut : un logement qui vient d'être déclaré n'a
 * pas de bail, et c'est l'état que BR-028 lui reconnaît.
 */
export const createApartmentSchema = z.object({
  number: requiredText(APARTMENT_NUMBER_MAX_LENGTH, NUMBER_MISSING, NUMBER_TOO_LONG),
  floor: atCreation(floorBase),
  type: creationText(APARTMENT_TYPE_MAX_LENGTH, TYPE_TOO_LONG),
  area: atCreation(areaBase),
  status: atCreation(statusBase).transform((value) => value ?? 'VACANT'),
  referenceRent: atCreation(referenceRentBase),
});

export type CreateApartmentInput = z.infer<typeof createApartmentSchema>;

/**
 * Modification d'un appartement (API section 12).
 *
 * Tous les champs sont facultatifs, mais au moins un doit être présent : une
 * requête vide écrirait `updated_at` sans rien changer, et ferait apparaître une
 * modification inexistante dans le futur journal d'activité.
 *
 * `propertyId` est absent à dessein : un appartement appartient à un seul
 * immeuble et n'en change pas (BR-026).
 *
 * Le statut ne peut pas être effacé, seulement changé : c'est une colonne
 * NOT NULL, et « sans statut » ne veut rien dire pour un logement.
 */
export const updateApartmentSchema = z
  .object({
    number: requiredText(APARTMENT_NUMBER_MAX_LENGTH, NUMBER_MISSING, NUMBER_TOO_LONG).optional(),
    floor: floorBase.optional(),
    type: patchText(APARTMENT_TYPE_MAX_LENGTH, TYPE_TOO_LONG),
    area: areaBase.optional(),
    status: z.enum(APARTMENT_STATUSES, STATUS_INVALID).optional(),
    referenceRent: referenceRentBase.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    error: 'Aucune modification fournie.',
    path: ['number'],
  });

export type UpdateApartmentInput = z.infer<typeof updateApartmentSchema>;

/**
 * Création groupée (API section 12, parcours 3).
 *
 * Elle existe pour une raison précise, écrite dans le parcours : pour un
 * immeuble de vingt appartements, le produit ne doit pas imposer vingt
 * formulaires. Chaque entrée ne porte que sa référence, l'utilisateur complétant
 * les détails ensuite.
 *
 * Les doublons DANS L'ENVOI sont refusés ici, avant toute écriture : la base les
 * refuserait de toute façon, mais au milieu d'une transaction et avec un message
 * qui ne désignerait pas la ligne fautive.
 */
export const createApartmentsBulkSchema = z.object({
  apartments: z
    .array(
      z.object({
        number: requiredText(APARTMENT_NUMBER_MAX_LENGTH, NUMBER_MISSING, NUMBER_TOO_LONG),
      }),
    )
    .min(1, 'Indiquez au moins une référence.')
    .max(APARTMENT_BULK_MAX, `Pas plus de ${APARTMENT_BULK_MAX} appartements à la fois.`)
    .refine((entries) => {
      const seen = new Set(entries.map((entry) => entry.number.toUpperCase()));

      return seen.size === entries.length;
    }, 'Deux références de la liste sont identiques.'),
});

export type CreateApartmentsBulkInput = z.infer<typeof createApartmentsBulkSchema>;

/**
 * Paramètres de liste (API section 12).
 *
 * `coerce` est nécessaire : une requête HTTP transmet `page=2`, une chaîne. La
 * borne supérieure de `pageSize` est imposée par le serveur, un client ne devant
 * pas pouvoir demander un volume arbitraire.
 *
 * Le filtre porte sur le STATUT et non sur l'archivage, contrairement à celui
 * des immeubles : c'est le statut d'occupation qui structure la lecture d'un
 * parc. Les logements archivés sont exclus par défaut et réunis sous leur propre
 * option, l'archive ne se consultant qu'intentionnellement.
 */
export const listApartmentsQuerySchema = z.object({
  page: z.coerce.number('Numéro de page invalide.').int().min(1).default(1),
  pageSize: z.coerce
    .number('Taille de page invalide.')
    .int()
    .min(1)
    .max(APARTMENT_LIST_MAX_PAGE_SIZE)
    .default(APARTMENT_LIST_DEFAULT_PAGE_SIZE),
  /** Recherche sur la référence et le type. Vide vaut absence. */
  search: creationText(APARTMENT_NUMBER_MAX_LENGTH, 'Recherche trop longue.'),
  status: z.enum(APARTMENT_LIST_FILTERS, STATUS_INVALID).default('ALL'),
  /** Inclure les logements archivés. Faux par défaut. */
  includeArchived: z
    .union([z.string(), z.boolean(), z.null()])
    .optional()
    .transform((value) => value === true || value === 'true' || value === '1'),
});

export type ListApartmentsQuery = z.infer<typeof listApartmentsQuerySchema>;

/**
 * Description d'une numérotation, telle que l'écran la demande (parcours 3).
 *
 * Trois valeurs remplacent vingt saisies : un préfixe, un premier numéro et un
 * nombre de logements. Le préfixe peut être vide, certains immeubles numérotant
 * simplement de 1 à 12.
 *
 * Le total engendré est borné par `APARTMENT_BULK_MAX`, comme l'envoi explicite,
 * et pour la même raison : garder la transaction courte et le message d'erreur
 * lisible.
 */
export const generateApartmentsSchema = z.object({
  prefix: creationText(APARTMENT_NUMBER_MAX_LENGTH, NUMBER_TOO_LONG),
  start: z.coerce
    .number('Le premier numéro doit être un nombre entier.')
    .int('Le premier numéro doit être un nombre entier.')
    .min(0, 'Le premier numéro ne peut pas être négatif.')
    .default(1),
  count: z.coerce
    .number('Le nombre de logements doit être un nombre entier.')
    .int('Le nombre de logements doit être un nombre entier.')
    .min(1, 'Indiquez au moins un logement.')
    .max(APARTMENT_BULK_MAX, `Pas plus de ${APARTMENT_BULK_MAX} appartements à la fois.`),
});

export type GenerateApartmentsInput = z.infer<typeof generateApartmentsSchema>;
