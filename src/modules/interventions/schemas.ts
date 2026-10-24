import { z } from 'zod';

import { InterventionValidationError } from './errors';
import type { InterventionListFilters, UpdateInterventionFields } from './repository';

const INTERVENTION_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new InterventionValidationError(
      z.flattenError(result.error).fieldErrors as Record<string, string[]>,
    );
  }

  return result.data;
}

export const createInterventionSchema = z.object({
  title: z.string('Le titre est obligatoire.').min(3).max(200),
  description: z.string('La description est obligatoire.').min(1).max(5000),
  propertyId: z.uuid("Identifiant d'immeuble invalide."),
  apartmentId: z.uuid('Identifiant de logement invalide.').nullable(),
  incidentId: z.uuid("Identifiant d'incident invalide.").nullable(),
  providerName: z.string().min(1).max(200).nullable(),
  providerPhone: z.string().min(1).max(30).nullable(),
  plannedFor: z.iso.date('Date invalide.').nullable(),
  estimatedCost: z.number('Montant invalide.').int().min(0).nullable(),
  assignedToUserId: z.uuid('Identifiant invalide.').nullable(),
});

export type CreateInterventionInput = z.output<typeof createInterventionSchema>;

export function parseCreateIntervention(input: unknown): CreateInterventionInput {
  return parseOrThrow(createInterventionSchema, input);
}

/**
 * DEC-060, 8.3 : au moins un champ, sinon rien à modifier. `actualCost` en
 * est volontairement absent : il n'est reçu QUE par la transition vers
 * COMPLETED (DEC-060, 4.5 et 7.4), jamais par cette modification de champs.
 */
export const updateInterventionSchema = z
  .object({
    title: z.string().min(3).max(200).optional(),
    description: z.string().min(1).max(5000).optional(),
    providerName: z.string().min(1).max(200).nullable().optional(),
    providerPhone: z.string().min(1).max(30).nullable().optional(),
    plannedFor: z.iso.date('Date invalide.').nullable().optional(),
    estimatedCost: z.number('Montant invalide.').int().min(0).nullable().optional(),
    apartmentId: z.uuid('Identifiant de logement invalide.').nullable().optional(),
    assignedToUserId: z.uuid('Identifiant invalide.').nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Au moins un champ doit être renseigné.',
  });

export type UpdateInterventionInput = z.output<typeof updateInterventionSchema>;

export function parseUpdateIntervention(input: unknown): UpdateInterventionFields {
  return parseOrThrow(updateInterventionSchema, input);
}

/**
 * `reason` et `actualCost` restent optionnels ICI : leur caractère
 * obligatoire dépend de `toStatus` (CANCELLED, COMPLETED), ce que ce schéma
 * ne connaît pas encore. Le contrôle fin est fait par le service
 * (DEC-060, 4.4 et 4.5), qui lève `MissingReasonError` ou
 * `MissingActualCostError`.
 */
export const transitionStatusSchema = z.object({
  toStatus: z.enum(INTERVENTION_STATUSES, 'Statut invalide.'),
  reason: z.string().min(1).max(1000).optional(),
  actualCost: z.number('Montant invalide.').int().min(0).optional(),
});

export type TransitionStatusInput = z.output<typeof transitionStatusSchema>;

export function parseTransitionStatus(input: unknown): TransitionStatusInput {
  return parseOrThrow(transitionStatusSchema, input);
}

/** Filtres de DEC-060, section 11.1. */
export const listInterventionsQuerySchema = z.object({
  page: z.coerce.number('Numéro de page invalide.').int().min(1).default(1),
  pageSize: z.coerce.number('Taille de page invalide.').int().min(1).max(100).default(20),
  status: z
    .preprocess(
      (value) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]),
      z.array(z.enum(INTERVENTION_STATUSES, 'Statut invalide.')),
    )
    .optional(),
  propertyId: z.uuid('Identifiant invalide.').optional(),
  apartmentId: z.uuid('Identifiant invalide.').optional(),
  incidentId: z.uuid('Identifiant invalide.').optional(),
  assignedToUserId: z.uuid('Identifiant invalide.').optional(),
});

export type ListInterventionsQuery = z.output<typeof listInterventionsQuerySchema>;

export function parseListInterventionsQuery(input: unknown): InterventionListFilters {
  return parseOrThrow(listInterventionsQuerySchema, input);
}
