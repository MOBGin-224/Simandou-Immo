import { organizationsOf, type AccessContext } from './access-context';
import { roleHasPermission, type Permission } from './permissions';
import { can } from './service';

/**
 * Périmètre de lecture d'une COLLECTION, dérivé du contexte d'accès (ADR-007,
 * API section 67).
 *
 * Une route de liste ne doit jamais charger toutes les lignes puis laisser le
 * frontend filtrer : les objets non autorisés ne doivent pas quitter le serveur.
 * Il faut donc traduire le contexte d'accès en CONDITIONS SQL, et non en une
 * suite de vérifications après lecture.
 *
 * Ce module vit dans le service d'autorisation, et non dans chaque module
 * métier, pour la même raison que `can()` : deux endroits qui décident d'un
 * accès finissent par diverger. Le test `list-scope.test.ts` vérifie d'ailleurs
 * que ce filtre et `can()` rendent exactement le même verdict, ressource par
 * ressource.
 */

/**
 * Ce qu'un utilisateur peut lire dans une organisation.
 *
 * `'all'` signifie toute l'organisation, sans restriction d'immeuble. Sinon, la
 * liste est exhaustive : un tableau vide ne signifie pas « aucune restriction »
 * mais « rien de lisible », et l'appelant doit alors ne rien renvoyer.
 */
export type PropertyScope = {
  organizationId: string;
  propertyIds: 'all' | readonly string[];
};

/**
 * Périmètres de lecture des ressources RATTACHÉES À UN IMMEUBLE.
 *
 * Trois comportements, qui reproduisent exactement `coversResource` du service
 * de décision :
 *
 *   - OWNER   : toute son organisation ;
 *   - MANAGER : les immeubles de son périmètre, et rien d'autre ;
 *   - TENANT  : aucun. Ses propres données ne sont pas rattachées à un immeuble
 *               mais à lui-même, et se filtrent donc par `ownerUserId`. Le
 *               filtre correspondant appartiendra au lot Contrats, qui crée la
 *               première ressource de ce genre.
 *
 * Un rôle qui ne porte pas la permission demandée ne contribue aucun périmètre :
 * un gestionnaire n'apparaît pas dans le résultat de `property.archive`.
 */
export function readablePropertyScopes(
  context: AccessContext,
  permission: Permission,
): PropertyScope[] {
  const byOrganization = new Map<string, Set<string> | 'all'>();

  for (const membership of context.memberships) {
    if (!roleHasPermission(membership.role, permission)) continue;
    if (membership.role === 'TENANT') continue;

    const current = byOrganization.get(membership.organizationId);

    if (current === 'all') continue;

    if (membership.role === 'OWNER') {
      byOrganization.set(membership.organizationId, 'all');
      continue;
    }

    // Un propriétaire qui est aussi gestionnaire de son patrimoine cumule les
    // deux rattachements (DEC-003) : le plus large gagne, et c'est bien le
    // comportement de `can()`, qui autorise dès qu'un rattachement suffit.
    const allowed = current ?? new Set<string>();

    for (const propertyId of membership.propertyIds) allowed.add(propertyId);

    byOrganization.set(membership.organizationId, allowed);
  }

  const scopes: PropertyScope[] = [];

  for (const [organizationId, allowed] of byOrganization) {
    if (allowed === 'all') {
      scopes.push({ organizationId, propertyIds: 'all' });
      continue;
    }

    // Un périmètre vide ne referme pas seulement l'accès : il rendrait aussi un
    // `IN ()` invalide en SQL. Ne pas le produire est la seule option sûre.
    if (allowed.size > 0) {
      scopes.push({ organizationId, propertyIds: [...allowed] });
    }
  }

  return scopes;
}

/** Aucun périmètre lisible : l'appelant doit renvoyer une collection vide. */
export function hasNoReadableScope(scopes: readonly PropertyScope[]): boolean {
  return scopes.length === 0;
}

/**
 * Organisations dans lesquelles l'utilisateur peut exercer une permission de
 * NIVEAU ORGANISATION, comme créer un immeuble.
 *
 * Passe par `can()` plutôt que de raisonner sur les rôles : le verdict reste
 * rendu par le point de décision unique, ce module ne faisant qu'énumérer les
 * organisations à lui soumettre.
 *
 * Sert à l'interface autant qu'à l'API : c'est ce qui permet de n'afficher
 * « Ajouter un immeuble » qu'à qui peut réellement le faire, et de ne proposer
 * dans un formulaire que les organisations recevables (composant
 * PermissionGuard, Component Specification section 68).
 */
export function organizationsWhereAllowed(
  context: AccessContext,
  permission: Permission,
): string[] {
  return organizationsOf(context).filter((organizationId) =>
    can(context, permission, { organizationId }),
  );
}
