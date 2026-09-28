import { membershipsIn, type AccessContext, type Membership } from './access-context';
import { roleHasPermission, type Permission } from './permissions';

/**
 * Point de décision unique de l'autorisation (MVP-BACKLOG-013, ADR-007).
 *
 * Toute l'autorisation du produit passe par `evaluate`. Ni `can`, ni
 * `requirePermission`, ni `canAccessProperty` ne raisonnent par eux-mêmes : ils
 * traduisent son verdict. Une vérification écrite au cas par cas dans chaque
 * route garantirait l'oubli, et une seule route non protégée suffit à ouvrir le
 * produit.
 *
 * L'évaluation combine deux dimensions, et deux seulement :
 *
 * ```text
 * le rôle possède la permission
 * ET la ressource appartient à l'organisation de l'utilisateur
 * ET si MANAGER : la ressource est rattachée à un immeuble de son périmètre
 * ET si TENANT  : la ressource est la sienne
 * ```
 *
 * Faute de RLS (ADR-005), ce module est la barrière UNIQUE d'isolation entre
 * organisations. Connaître un identifiant ne doit jamais donner un accès.
 */

/**
 * Ressource visée par une décision.
 *
 * Les tables métier dénormalisent `organization_id` et `property_id`
 * précisément pour que cette description se construise sans jointure (ADR-007).
 */
export type ResourceRef = {
  /** Organisation propriétaire de la ressource. Toujours connue. */
  organizationId: string;

  /**
   * Immeuble de rattachement, lorsque la ressource en a un.
   *
   * Son absence ferme l'accès à un gestionnaire : ADR-007 borne son autorité à
   * un périmètre d'immeubles sans condition, donc une ressource sans immeuble en
   * sort. Conséquence assumée : un gestionnaire qui viserait une ressource de
   * niveau organisation obtient « inexistant ». Aucune permission qu'il porte au
   * MVP ne s'applique à ce niveau ; le jour où un rapport global apparaîtra, au
   * lot Dashboards, il faudra décider s'il le voit restreint à son périmètre
   * plutôt que d'ouvrir cette porte.
   */
  propertyId?: string | null;

  /**
   * Utilisateur auquel la ressource appartient en propre, le cas échéant : le
   * locataire d'un bail, le déclarant d'un incident.
   *
   * C'est ce qui permet au locataire d'atteindre ses données, et seulement les
   * siennes.
   */
  ownerUserId?: string | null;
};

/**
 * Pourquoi un accès est refusé.
 *
 * La distinction n'est pas cosmétique. `out-of-scope` doit se traduire par un
 * `NOT_FOUND` côté HTTP, jamais par un `FORBIDDEN` : une ressource hors
 * périmètre doit se comporter comme une ressource inexistante, sinon un
 * identifiant deviné révèle l'existence de données d'une autre organisation.
 */
export type DenialReason = 'out-of-scope' | 'permission-denied';

export type Decision =
  { allowed: true; membership: Membership } | { allowed: false; reason: DenialReason };

/** Le rattachement couvre-t-il cette ressource, permission mise à part. */
function coversResource(membership: Membership, resource: ResourceRef, userId: string): boolean {
  switch (membership.role) {
    case 'OWNER':
      // Autorité sur toute l'organisation, déjà vérifiée par l'appelant.
      return true;

    case 'MANAGER':
      if (!resource.propertyId) return false;
      return membership.propertyIds.includes(resource.propertyId);

    case 'TENANT':
      // Ses propres données uniquement. Un `ownerUserId` absent refuse, ce qui
      // est le comportement attendu : un locataire n'atteint pas un immeuble.
      return resource.ownerUserId === userId;
  }
}

/**
 * Évalue une demande d'accès.
 *
 * Le périmètre est examiné AVANT la permission, à dessein : un gestionnaire qui
 * vise un immeuble hors de son périmètre obtient `out-of-scope`, même s'il lui
 * manquait aussi la permission. La réponse la moins informative gagne.
 */
export function evaluate(
  context: AccessContext,
  permission: Permission,
  resource: ResourceRef,
): Decision {
  const memberships = membershipsIn(context, resource.organizationId);

  if (memberships.length === 0) return { allowed: false, reason: 'out-of-scope' };

  let withinScope = false;

  for (const membership of memberships) {
    if (!coversResource(membership, resource, context.userId)) continue;

    withinScope = true;

    if (roleHasPermission(membership.role, permission)) {
      return { allowed: true, membership };
    }
  }

  return { allowed: false, reason: withinScope ? 'permission-denied' : 'out-of-scope' };
}

/** `can(user, permission, resource)`, la forme attendue par ADR-007. */
export function can(
  context: AccessContext,
  permission: Permission,
  resource: ResourceRef,
): boolean {
  return evaluate(context, permission, resource).allowed;
}

/**
 * Levée lorsque le rôle ne porte pas la permission demandée, sur une ressource
 * que l'utilisateur peut par ailleurs atteindre. À traduire en `FORBIDDEN`.
 */
export class PermissionDeniedError extends Error {
  constructor(readonly permission: Permission) {
    super(`Permission refusée : ${permission}.`);
    this.name = 'PermissionDeniedError';
  }
}

/**
 * Levée lorsque la ressource est hors de l'organisation ou du périmètre de
 * l'utilisateur.
 *
 * À traduire en `NOT_FOUND` côté HTTP, et non en `FORBIDDEN` : répondre
 * « interdit » confirmerait l'existence de la ressource.
 */
export class ResourceOutOfScopeError extends Error {
  constructor() {
    super("Ressource inexistante ou hors du périmètre de l'utilisateur.");
    this.name = 'ResourceOutOfScopeError';
  }
}

/**
 * Exige une permission, ou échoue.
 *
 * À préférer à `can` dans une mutation : l'oubli d'un `if (!autorise)` devient
 * impossible, puisque le chemin refusé ne rend pas la main.
 */
export function requirePermission(
  context: AccessContext,
  permission: Permission,
  resource: ResourceRef,
): Membership {
  const decision = evaluate(context, permission, resource);

  if (decision.allowed) return decision.membership;
  if (decision.reason === 'out-of-scope') throw new ResourceOutOfScopeError();

  throw new PermissionDeniedError(permission);
}

/**
 * Accès à un immeuble, indépendamment de toute permission.
 *
 * C'est le `canAccessProperty(user, propertyId)` exigé avant toute opération sur
 * un immeuble, un appartement, un locataire, un contrat, un incident ou une
 * dépense. Un propriétaire couvre tous les immeubles de son organisation, un
 * gestionnaire ceux de son périmètre, un locataire aucun.
 */
export function canAccessProperty(
  context: AccessContext,
  target: { organizationId: string; propertyId: string },
): boolean {
  return membershipsIn(context, target.organizationId).some((membership) =>
    coversResource(membership, target, context.userId),
  );
}

/** `canAccessProperty`, en version qui échoue. */
export function requirePropertyAccess(
  context: AccessContext,
  target: { organizationId: string; propertyId: string },
): void {
  if (!canAccessProperty(context, target)) throw new ResourceOutOfScopeError();
}
