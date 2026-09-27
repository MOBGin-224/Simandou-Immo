/**
 * Catalogue des permissions et association statique aux rôles (DEC-025,
 * ADR-007).
 *
 * Le catalogue est défini EN CODE, et non en base : aucune table `permissions`
 * ni `access_permissions` n'existe au MVP. Un catalogue en code est vérifié par
 * le compilateur, ce que des lignes en base ne permettent pas.
 *
 * La liste est exhaustive pour le MVP, telle qu'arrêtée par
 * `docs/04-technical/database.md` section 11. Ajouter une permission suppose
 * qu'elle corresponde à une capacité déjà dans le périmètre, qu'elle rejoigne ce
 * catalogue, et qu'elle soit couverte par un test positif et un test négatif.
 * Une permission ne crée jamais une fonctionnalité.
 */

/** Rôle porté par `user_access.role`. Aucune table `roles` au MVP. */
export type Role = 'OWNER' | 'MANAGER' | 'TENANT';

/**
 * Catalogue complet, au format `resource.action`.
 *
 * L'ordre reproduit celui du document de référence, pour qu'une comparaison
 * entre les deux reste immédiate.
 */
export const PERMISSIONS = [
  'property.create',
  'property.read',
  'property.update',
  'property.archive',

  'apartment.create',
  'apartment.read',
  'apartment.update',

  'manager.invite',
  'manager.read',
  'manager.update',
  'manager.revoke',

  'tenant.create',
  'tenant.read',
  'tenant.update',
  'tenant.invite',

  'lease.create',
  'lease.read',
  'lease.update',
  'lease.terminate',

  'rent.read',
  'rent.generate',

  'payment.create',
  'payment.read',
  'payment.cancel',

  'receipt.read',

  'charge.create',
  'charge.read',
  'charge.publish',

  'incident.create',
  'incident.read',
  'incident.update',

  'intervention.create',
  'intervention.update',

  'expense.create',
  'expense.read',
  'expense.update',

  'document.upload',
  'document.read',

  'report.read',
  'activity.read',
  'audit.read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Propriétaire : autorité maximale sur les ressources de son organisation.
 *
 * Énumérée explicitement, et non déduite du catalogue. Une permission doit être
 * accordée par décision, jamais par défaut : une future permission réservée à un
 * autre rôle ne doit pas atterrir ici par le simple fait d'exister.
 */
const OWNER_PERMISSIONS: readonly Permission[] = [
  'property.create',
  'property.read',
  'property.update',
  'property.archive',
  'apartment.create',
  'apartment.read',
  'apartment.update',
  'manager.invite',
  'manager.read',
  'manager.update',
  'manager.revoke',
  'tenant.create',
  'tenant.read',
  'tenant.update',
  'tenant.invite',
  'lease.create',
  'lease.read',
  'lease.update',
  'lease.terminate',
  'rent.read',
  'rent.generate',
  'payment.create',
  'payment.read',
  'payment.cancel',
  'receipt.read',
  'charge.create',
  'charge.read',
  'charge.publish',
  'incident.create',
  'incident.read',
  'incident.update',
  'intervention.create',
  'intervention.update',
  'expense.create',
  'expense.read',
  'expense.update',
  'document.upload',
  'document.read',
  'report.read',
  'activity.read',
  'audit.read',
];

/**
 * Gestionnaire : les opérations quotidiennes, sur son périmètre d'immeubles.
 *
 * Quatre exclusions, chacune fondée sur un document :
 *
 *   1. `property.create` et `property.archive`. Créer ou archiver un immeuble
 *      est un acte patrimonial : la liste des capacités du gestionnaire dans
 *      `roles-permissions.md` section 10 ne les contient pas, celle du
 *      propriétaire en section 6 les contient.
 *   2. Toutes les permissions `manager.*`, `manager.read` comprise. La matrice
 *      globale refuse au gestionnaire chaque ligne concernant les
 *      gestionnaires, et la section 7 lui interdit de modifier l'autorité du
 *      propriétaire.
 *   3. `audit.read`. Le journal d'audit est une donnée de sécurité et aucun
 *      document ne l'ouvre au gestionnaire. En l'absence de règle explicite, le
 *      moindre privilège décide.
 *
 * Ces quatre exclusions sont des interprétations de la matrice, pas des
 * citations : la mention « selon droits » qu'elle portait visait la délégation
 * fine abandonnée par DEC-025. Elles sont à confirmer par le fondateur, et se
 * modifient en ajoutant une ligne ici.
 */
const MANAGER_PERMISSIONS: readonly Permission[] = [
  'property.read',
  'property.update',
  'apartment.create',
  'apartment.read',
  'apartment.update',
  'tenant.create',
  'tenant.read',
  'tenant.update',
  'tenant.invite',
  'lease.create',
  'lease.read',
  'lease.update',
  'lease.terminate',
  'rent.read',
  'rent.generate',
  'payment.create',
  'payment.read',
  'payment.cancel',
  'receipt.read',
  'charge.create',
  'charge.read',
  'charge.publish',
  'incident.create',
  'incident.read',
  'incident.update',
  'intervention.create',
  'intervention.update',
  'expense.create',
  'expense.read',
  'expense.update',
  'document.upload',
  'document.read',
  'report.read',
  'activity.read',
];

/**
 * Locataire : ses propres données, et rien d'autre.
 *
 * Il consulte son contrat, ses loyers, ses paiements, ses quittances, ses
 * charges, déclare et suit ses incidents. Il ne voit ni les autres locataires,
 * ni les finances de l'immeuble.
 *
 * `tenant.update` lui est accordée pour ses données de contact, niveau 4 de la
 * portée. La restriction aux seuls champs modifiables, l'appartement et le loyer
 * contractuel en étant exclus, appartient au module Locataires : une permission
 * décide d'un accès à une ressource, pas d'un champ.
 *
 * Aucune permission de paiement en écriture : le paiement numérique dépend de
 * DEC-034, encore OUVERTE. Le catalogue étant exhaustif pour le MVP, aucune
 * permission n'est inventée pour un parcours non décidé.
 */
const TENANT_PERMISSIONS: readonly Permission[] = [
  'tenant.read',
  'tenant.update',
  'lease.read',
  'rent.read',
  'payment.read',
  'receipt.read',
  'charge.read',
  'incident.create',
  'incident.read',
  'document.read',
];

/** Association statique, figée au démarrage. */
export const ROLE_PERMISSIONS: Readonly<Record<Role, ReadonlySet<Permission>>> = Object.freeze({
  OWNER: new Set(OWNER_PERMISSIONS),
  MANAGER: new Set(MANAGER_PERMISSIONS),
  TENANT: new Set(TENANT_PERMISSIONS),
});

/** Le rôle porte-t-il cette permission, indépendamment de toute ressource. */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}
