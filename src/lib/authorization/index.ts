import { getDb } from '@/db/client';
import { requireAuthenticatedUser } from '@/lib/auth';

import { loadAccessContext, type AccessContext } from './access-context';

/**
 * Service d'autorisation du produit (ADR-007, DEC-025).
 *
 * C'est la surface que le code métier importe. Elle lie le contexte d'accès à
 * l'utilisateur authentifié de la requête en cours ; la décision elle-même vit
 * dans `service.ts`, sans base de données, donc testable exhaustivement.
 *
 * Réservé au serveur : l'autorisation est évaluée côté serveur, jamais dans le
 * navigateur, et ce module lit les en-têtes de la requête.
 */

export type { AccessContext, Membership } from './access-context';
export { membershipsIn, organizationsOf } from './access-context';

export type { Permission, Role } from './permissions';
export { PERMISSIONS, ROLE_PERMISSIONS, roleHasPermission } from './permissions';

export type { Decision, DenialReason, ResourceRef } from './service';
export {
  PermissionDeniedError,
  ResourceOutOfScopeError,
  can,
  canAccessProperty,
  evaluate,
  requirePermission,
  requirePropertyAccess,
} from './service';

/**
 * Contexte d'accès de l'utilisateur courant.
 *
 * Échoue si personne n'est authentifié, par `UnauthenticatedError`. À charger une
 * fois par requête : les vérifications suivantes n'accèdent plus à la base.
 */
export async function requireAccessContext(): Promise<AccessContext> {
  const user = await requireAuthenticatedUser();

  return loadAccessContext(getDb(), user.id);
}
