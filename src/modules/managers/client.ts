/**
 * Surface du module Gestionnaires réservée à l'interface.
 *
 * Ce fichier ne réexporte QUE des constantes et des types, jamais le service ni le
 * dépôt. Un composant client qui importerait `index.ts` entraînerait derrière lui
 * le pilote PostgreSQL, ce qu'un navigateur ne doit jamais recevoir.
 */
import type { ManagerListKind, ManagerListStatus } from './constants';

export type { ManagerListKind, ManagerListStatus } from './constants';
export {
  MANAGER_EMAIL_MAX_LENGTH,
  MANAGER_LIST_STATUSES,
  MANAGER_NAME_MAX_LENGTH,
  MANAGER_PROPERTIES_MAX,
} from './constants';

/**
 * Élément de `GET /api/v1/managers`, forme minimale pour un sélecteur.
 *
 * `id` est `user_access.id` pour un accès et `invitations.id` pour une
 * invitation (DEC-041) : ni l'un ni l'autre n'est `users.id`. L'API ne publie
 * aucun champ `userId`, le domaine du module l'arrêtant volontairement à la
 * frontière de l'accès.
 */
export type ManagerListItem = {
  kind: ManagerListKind;
  id: string;
  organizationId: string;
  organizationName: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: ManagerListStatus;
};

/**
 * Appelle l'API GET /api/v1/managers, réservée au propriétaire
 * (`manager.read`) : un gestionnaire reçoit une ressource hors périmètre.
 */
export async function listManagersRequest(): Promise<Response> {
  return fetch('/api/v1/managers', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
}
