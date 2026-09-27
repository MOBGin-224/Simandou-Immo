import { and, eq, isNull } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import * as schema from '@/db/schema';
import { managerPropertyAccess, userAccess } from '@/db/schema';

import type { Role } from './permissions';

/**
 * Contexte d'accès d'un utilisateur (MVP-BACKLOG-011, MVP-BACKLOG-014).
 *
 * Chaque requête métier doit pouvoir répondre à « cet utilisateur, dans quelle
 * organisation, avec quel rôle, sur quels immeubles ». Ce module produit cette
 * réponse en UNE lecture, et le service de décision travaille ensuite sans
 * toucher à la base.
 *
 * Deux bénéfices concrets à cette séparation :
 *
 *   1. `can()` reste une fonction pure, donc testable exhaustivement. C'est la
 *      barrière unique d'isolation du produit, faute de RLS (ADR-005, ADR-007) :
 *      sa couverture n'est pas négociable.
 *   2. Une requête qui vérifie vingt autorisations ne fait pas vingt requêtes.
 */

/** Instance Drizzle, quel que soit son pilote. */
export type AuthorizationDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * Un rattachement actif à une organisation, avec son rôle et son périmètre.
 *
 * Le périmètre est porté par le rattachement et non par la personne : révoquer
 * un accès révoque son périmètre avec lui, sans écriture supplémentaire.
 */
export type Membership = {
  /** `user_access.id`. Le périmètre d'immeubles s'y rattache. */
  accessId: string;
  organizationId: string;
  role: Role;
  /**
   * Immeubles du périmètre, pour un MANAGER.
   *
   * Vide pour un OWNER, dont l'autorité porte sur toute l'organisation, et pour
   * un TENANT, dont le rattachement à un immeuble passera par son bail au lot
   * Contrats. Un périmètre vide n'élargit jamais un accès : il le referme.
   */
  propertyIds: readonly string[];
};

export type AccessContext = {
  userId: string;
  memberships: readonly Membership[];
};

/**
 * Charge le contexte d'accès d'un utilisateur.
 *
 * Ne retient qu'un accès `ACTIVE` et non révoqué. Les deux conditions sont
 * vérifiées, bien que la seconde soit en principe redondante : si un jour une
 * révocation renseignait `revoked_at` sans changer le statut, l'accès resterait
 * refusé. Sur la barrière unique d'isolation, la redondance est un choix.
 *
 * Le périmètre exclut de même les rattachements d'immeuble révoqués.
 */
export async function loadAccessContext(
  db: AuthorizationDatabase,
  userId: string,
): Promise<AccessContext> {
  const rows = await db
    .select({
      accessId: userAccess.id,
      organizationId: userAccess.organizationId,
      role: userAccess.role,
      propertyId: managerPropertyAccess.propertyId,
    })
    .from(userAccess)
    .leftJoin(
      managerPropertyAccess,
      and(
        eq(managerPropertyAccess.userAccessId, userAccess.id),
        isNull(managerPropertyAccess.revokedAt),
      ),
    )
    .where(
      and(
        eq(userAccess.userId, userId),
        eq(userAccess.status, 'ACTIVE'),
        isNull(userAccess.revokedAt),
      ),
    );

  const byAccessId = new Map<string, Membership & { propertyIds: string[] }>();

  for (const row of rows) {
    let membership = byAccessId.get(row.accessId);

    if (!membership) {
      membership = {
        accessId: row.accessId,
        organizationId: row.organizationId,
        role: row.role,
        propertyIds: [],
      };
      byAccessId.set(row.accessId, membership);
    }

    if (row.propertyId) membership.propertyIds.push(row.propertyId);
  }

  return { userId, memberships: [...byAccessId.values()] };
}

/** Organisations auxquelles l'utilisateur est rattaché, sans doublon. */
export function organizationsOf(context: AccessContext): string[] {
  return [...new Set(context.memberships.map((membership) => membership.organizationId))];
}

/**
 * Rattachements de l'utilisateur dans une organisation donnée.
 *
 * Il peut y en avoir plusieurs : un propriétaire peut aussi être gestionnaire de
 * son propre patrimoine, sans créer un second compte (DEC-003).
 */
export function membershipsIn(context: AccessContext, organizationId: string): Membership[] {
  return context.memberships.filter((membership) => membership.organizationId === organizationId);
}
