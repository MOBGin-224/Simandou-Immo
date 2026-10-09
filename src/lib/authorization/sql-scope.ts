import { and, eq, inArray, or, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

import type { PropertyScope } from './list-scope';

/**
 * Traduction d'un périmètre de lecture en CONDITION SQL (ADR-007, API section
 * 67).
 *
 * `readablePropertyScopes` dit ce qu'une personne peut lire ; cette fonction
 * l'écrit en SQL. Les deux vivent dans le service d'autorisation et non dans
 * chaque module métier, et pour la même raison que `can()` : deux traductions
 * séparées finiraient par diverger, et une divergence ICI est une fuite entre
 * organisations, pas un simple défaut d'affichage.
 *
 * Elle s'applique à toute table qui porte `organization_id` et `property_id` en
 * propre. C'est le cas des baux, des échéances de loyer, des charges et des
 * créances de charge : ces colonnes y sont dénormalisées précisément pour que le
 * périmètre s'écrive SANS JOINTURE, ce qu'exige un contrôle d'accès
 * systématique.
 *
 * Une liste d'immeubles VIDE ne produit aucune condition pour ce rattachement :
 * `readablePropertyScopes` n'en émet jamais, et un `IN ()` serait de toute façon
 * invalide en SQL.
 */
export function propertyScopeCondition(
  scopes: readonly PropertyScope[],
  columns: { organizationId: PgColumn; propertyId: PgColumn },
): SQL | undefined {
  return or(
    ...scopes.map((scope) =>
      scope.propertyIds === 'all'
        ? eq(columns.organizationId, scope.organizationId)
        : and(
            eq(columns.organizationId, scope.organizationId),
            inArray(columns.propertyId, [...scope.propertyIds]),
          ),
    ),
  );
}
