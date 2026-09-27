import { asc, inArray } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import * as schema from '@/db/schema';
import { organizations } from '@/db/schema';
import {
  organizationsWhereAllowed,
  type AccessContext,
  type Permission,
} from '@/lib/authorization';

/**
 * Module Organisations, réduit à ce dont les écrans ont besoin (MVP-ENG-002).
 *
 * Le module existe parce qu'un formulaire de création d'immeuble doit NOMMER
 * l'organisation de destination : un identifiant technique dans une liste
 * déroulante n'est pas utilisable. Sa surface reste volontairement minuscule ; la
 * gestion complète d'une organisation n'appartient pas à ce lot.
 */
export type OrganizationsDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

export type OrganizationOption = {
  id: string;
  name: string;
};

/**
 * Organisations dans lesquelles l'utilisateur peut exercer une permission de
 * niveau organisation, avec leur nom.
 *
 * Les identifiants viennent du service d'autorisation, pas d'une requête : la
 * lecture ne fait que NOMMER ce que la décision a déjà autorisé. Sans
 * organisation autorisée, aucune requête n'est émise.
 */
export async function listAllowedOrganizations(
  db: OrganizationsDatabase,
  context: AccessContext,
  permission: Permission,
): Promise<OrganizationOption[]> {
  const allowed = organizationsWhereAllowed(context, permission);

  if (allowed.length === 0) return [];

  return db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(inArray(organizations.id, allowed))
    .orderBy(asc(organizations.name));
}
