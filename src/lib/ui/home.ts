import type { Role } from '@/lib/authorization';

/**
 * Où commence le travail de chacun (DEC-046).
 *
 * Centralisé parce que trois endroits en ont besoin et doivent s'accorder : la
 * racine du produit, le logo de l'en-tête, et la redirection qui suit
 * l'acceptation d'une invitation. Trois réponses différentes à la même question
 * finiraient par diverger.
 *
 * Pure : ni base, ni HTTP, ni React, donc testable sans monter de serveur.
 */

/** Destination d'un gestionnaire ou d'un propriétaire : le patrimoine. */
export const MANAGEMENT_HOME = '/immeubles';

/** Destination d'un locataire : son logement (Information Architecture 7.3). */
export const TENANT_HOME = '/mon-logement';

/**
 * Accueil correspondant à un ensemble de rôles.
 *
 * Le rôle de GESTION gagne en cas de cumul : une personne qui est à la fois
 * propriétaire et locataire dans le produit vient d'abord y travailler, et son
 * espace locataire reste à un clic. Un locataire SEUL va à son logement, car
 * `/immeubles` lui répondrait « inexistant » (ADR-007).
 *
 * Sans aucun rôle, la gestion reste la destination : l'enveloppe authentifiée
 * affiche alors « aucun accès actif », ce qui est le message juste, plutôt qu'un
 * espace locataire vide.
 */
export function homeForRoles(roles: readonly Role[]): string {
  const onlyTenant = roles.length > 0 && roles.every((role) => role === 'TENANT');

  return onlyTenant ? TENANT_HOME : MANAGEMENT_HOME;
}
