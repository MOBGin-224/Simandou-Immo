import { z } from 'zod';

import {
  RENT_LIST_DEFAULT_PAGE_SIZE,
  RENT_LIST_FILTERS,
  RENT_LIST_MAX_PAGE_SIZE,
} from './constants';

/**
 * Schémas de validation du module Loyers (MVP-ENG-027, API section 18).
 *
 * Frontière entre le monde extérieur et le domaine : requête HTTP comme
 * soumission de formulaire passent par ici, et les mêmes conventions
 * qu'ailleurs s'appliquent, notamment qu'un formulaire HTML ne transmet que des
 * chaînes.
 *
 * Une particularité de ce lot : la PÉRIODE. Elle s'écrit `AAAA-MM`, un mois, et
 * non une date complète. C'est ce qu'une personne désigne quand elle parle du
 * « loyer d'octobre », et accepter un jour laisserait croire qu'une période peut
 * commencer le 15. Le schéma la normalise en premier jour du mois, ce que la
 * colonne `period_start` attend et ce qu'une contrainte de base vérifie.
 */

const UUID_MESSAGE = 'Identifiant invalide.';
const PERIOD_MESSAGE = 'Utilisez un mois réel, au format AAAA-MM.';

/** Identifiant facultatif, qu'il soit absent, vide ou nul. */
const optionalUuid = z.string().nullish().pipe(z.uuid(UUID_MESSAGE).nullish());

/**
 * Période de facturation, donnée en `AAAA-MM` et rendue en `AAAA-MM-01`.
 *
 * La transformation est faite ICI et non dans le service : une période arrive de
 * trois endroits, la liste, la génération manuelle et le job, et trois
 * normalisations séparées finiraient par diverger d'un jour.
 *
 * Le mois est vérifié, pas seulement le motif : `2026-13` respecte le format et
 * n'existe pas.
 */
const periodSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, PERIOD_MESSAGE)
  .transform((value) => `${value}-01`);

/**
 * Filtres de la liste (API section 18).
 *
 * `period` filtre sur la période exacte, puisqu'une échéance en porte une seule.
 * `tenantId` est un `users.id`, l'identité métier de la personne (DEC-051) :
 * c'est ce que la colonne référence, donc aucune traduction n'est nécessaire, et
 * un locataire sans accès au produit reste filtrable.
 */
export const listRentsQuerySchema = z.object({
  page: z.coerce.number('Numéro de page invalide.').int().min(1).default(1),
  pageSize: z.coerce
    .number('Taille de page invalide.')
    .int()
    .min(1)
    .max(RENT_LIST_MAX_PAGE_SIZE)
    .default(RENT_LIST_DEFAULT_PAGE_SIZE),
  propertyId: optionalUuid,
  apartmentId: optionalUuid,
  /** `users.id` de la personne locataire (DEC-051). */
  tenantId: optionalUuid,
  leaseId: optionalUuid,
  period: periodSchema.nullish(),
  status: z.enum(RENT_LIST_FILTERS, 'Statut invalide.').default('OUTSTANDING'),
});

export type ListRentsQuery = z.output<typeof listRentsQuerySchema>;

/**
 * Génération manuelle (API section 18, « Génération manuelle »).
 *
 * Les deux champs sont FACULTATIFS, et leurs défauts disent la règle d'usage :
 * sans période, c'est le mois en cours, le seul que le job traite de lui-même
 * (DEC-053 règle 1) ; sans immeuble, c'est tout le périmètre lisible de
 * l'appelant.
 *
 * Une période PASSÉE est acceptée ici, et c'est la seule porte par laquelle elle
 * entre : réclamer un mois déjà écoulé est une décision humaine, prise mois par
 * mois, jamais un rattrapage automatique.
 */
export const generateRentsSchema = z.object({
  period: periodSchema.nullish(),
  propertyId: optionalUuid,
});

export type GenerateRentsInput = z.output<typeof generateRentsSchema>;
