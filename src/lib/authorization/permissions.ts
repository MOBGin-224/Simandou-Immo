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
  'apartment.archive',

  'manager.invite',
  'manager.read',
  'manager.update',
  'manager.revoke',

  'tenant.create',
  'tenant.read',
  'tenant.update',
  'tenant.invite',
  'tenant.revoke',

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
  'apartment.archive',
  'manager.invite',
  'manager.read',
  'manager.update',
  'manager.revoke',
  'tenant.create',
  'tenant.read',
  'tenant.update',
  'tenant.invite',
  'tenant.revoke',
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
 * Trois familles d'exclusions, cinq permissions, chacune fondée sur un
 * document :
 *
 *   1. `property.create`, `property.archive` et `apartment.archive`. Créer ou
 *      retirer un bien de l'exploitation est un acte patrimonial : la liste des
 *      capacités du gestionnaire dans `roles-permissions.md` section 10 n'en
 *      contient aucun, celle du propriétaire en section 6 les contient. La
 *      troisième a été ajoutée le 28 septembre 2026 par DEC-039, le Lot 5 ayant
 *      découvert qu'elle manquait au catalogue.
 *   2. Toutes les permissions `manager.*`, `manager.read` comprise. La matrice
 *      globale refuse au gestionnaire chaque ligne concernant les
 *      gestionnaires, et la section 7 lui interdit de modifier l'autorité du
 *      propriétaire.
 *   3. `audit.read`. Le journal d'audit est une donnée de sécurité et aucun
 *      document ne l'ouvre au gestionnaire. En l'absence de règle explicite, le
 *      moindre privilège décide.
 *
 * Ces exclusions étaient des interprétations de la matrice, pas des citations :
 * la mention « selon droits » qu'elle portait visait la délégation fine
 * abandonnée par DEC-025. Elles sont CONFIRMÉES depuis le 27 septembre 2026, et
 * `property.create`, `property.archive` et `apartment.archive` sont donc
 * réservées au propriétaire. Le PRD section 10.3 parle d'un « gestionnaire autorisé » : cette
 * formulation désignait la délégation abandonnée, et ne rouvre rien.
 *
 * Une exclusion se lève en ajoutant une ligne ici, ce qui fait échouer le test
 * qui la fige : le changement est donc toujours visible en revue.
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
  'tenant.revoke',
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
 * `tenant.update` lui est accordée pour ses propres données, niveau 4 de la
 * portée. DEC-048 la réduit à son NOM seulement : le téléphone et l'email ne
 * sont modifiables par personne au MVP, faute du mécanisme de vérification
 * qu'exigent SEC-049 et SEC-050. Cette restriction de champs appartient au
 * module Locataires : une permission décide d'un accès à une ressource, pas
 * d'un champ.
 *
 * `tenant.revoke` ne lui est pas accordée : un locataire ne révoque l'accès de
 * personne, pas même le sien (DEC-047).
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
