import { z } from 'zod';

import { IncidentValidationError } from './errors';
import type { IncidentListFilters, UpdateIncidentFields } from './repository';

/** Cinq valeurs, en texte libre côté base (DEC-021, DEC-059, 3.1). */
const INCIDENT_CATEGORIES = [
  'PLUMBING',
  'ELECTRICITY',
  'AIR_CONDITIONING',
  'LOCKS_AND_KEYS',
  'OTHER',
] as const;

const INCIDENT_PRIORITIES = ['LOW', 'NORMAL', 'URGENT'] as const;

const INCIDENT_STATUSES = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'ON_HOLD',
  'RESOLVED',
  'CLOSED',
] as const;

function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new IncidentValidationError(
      z.flattenError(result.error).fieldErrors as Record<string, string[]>,
    );
  }

  return result.data;
}

export const createIncidentSchema = z.object({
  title: z.string('Le titre est obligatoire.').min(3).max(200),
  description: z.string('La description est obligatoire.').min(1).max(5000),
  priority: z.enum(INCIDENT_PRIORITIES, 'Priorité invalide.'),
  category: z.enum(INCIDENT_CATEGORIES, 'Catégorie invalide.'),
  apartmentId: z.uuid('Identifiant de logement invalide.'),
});

export type CreateIncidentInput = z.output<typeof createIncidentSchema>;

export function parseCreateIncident(input: unknown): CreateIncidentInput {
  return parseOrThrow(createIncidentSchema, input);
}

/** DEC-059, 4.5 : au moins un champ, sinon rien à modifier. */
export const updateIncidentSchema = z
  .object({
    title: z.string().min(3).max(200).optional(),
    description: z.string().min(1).max(5000).optional(),
    priority: z.enum(INCIDENT_PRIORITIES).optional(),
    category: z.enum(INCIDENT_CATEGORIES).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Au moins un champ doit être renseigné.',
  });

export type UpdateIncidentInput = z.output<typeof updateIncidentSchema>;

export function parseUpdateIncident(input: unknown): UpdateIncidentFields {
  return parseOrThrow(updateIncidentSchema, input);
}

export const transitionStatusSchema = z.object({
  toStatus: z.enum(INCIDENT_STATUSES, 'Statut invalide.'),
  reason: z.string().max(1000).optional(),
});

export type TransitionStatusInput = z.output<typeof transitionStatusSchema>;

export function parseTransitionStatus(input: unknown): TransitionStatusInput {
  return parseOrThrow(transitionStatusSchema, input);
}

export const assignIncidentSchema = z.object({
  assignedToUserId: z.uuid('Identifiant invalide.'),
});

export type AssignIncidentInput = z.output<typeof assignIncidentSchema>;

export function parseAssignIncident(input: unknown): AssignIncidentInput {
  return parseOrThrow(assignIncidentSchema, input);
}

export const addCommentSchema = z.object({
  content: z.string('Le commentaire est obligatoire.').min(1).max(2000),
});

export type AddCommentInput = z.output<typeof addCommentSchema>;

export function parseAddComment(input: unknown): AddCommentInput {
  return parseOrThrow(addCommentSchema, input);
}

/** Filtres de DEC-059, section 10.1. Accepte `status` répété ou unique. */
export const listIncidentsQuerySchema = z.object({
  page: z.coerce.number('Numéro de page invalide.').int().min(1).default(1),
  pageSize: z.coerce.number('Taille de page invalide.').int().min(1).max(100).default(20),
  status: z
    .preprocess(
      (value) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]),
      z.array(z.enum(INCIDENT_STATUSES, 'Statut invalide.')),
    )
    .optional(),
  priority: z.enum(INCIDENT_PRIORITIES, 'Priorité invalide.').optional(),
  category: z.enum(INCIDENT_CATEGORIES, 'Catégorie invalide.').optional(),
  propertyId: z.uuid('Identifiant invalide.').optional(),
  apartmentId: z.uuid('Identifiant invalide.').optional(),
  assignedToUserId: z.uuid('Identifiant invalide.').optional(),
  toProcess: z.coerce.boolean().optional(),
});

export type ListIncidentsQuery = z.output<typeof listIncidentsQuerySchema>;

export function parseListIncidentsQuery(input: unknown): IncidentListFilters {
  return parseOrThrow(listIncidentsQuerySchema, input);
}
