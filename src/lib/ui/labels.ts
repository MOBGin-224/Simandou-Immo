import type { Role } from '@/lib/authorization';

/**
 * Libellés français des valeurs d'énumération affichées.
 *
 * Centralisés parce qu'ils apparaîtront dans plusieurs écrans : un rôle traduit
 * « Gestionnaire » ici et « Manager » ailleurs donnerait l'impression de deux
 * notions distinctes.
 */
export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Propriétaire',
  MANAGER: 'Gestionnaire',
  TENANT: 'Locataire',
};

/**
 * Point de vue de l'utilisateur, à afficher dans le chrome.
 *
 * C'est le rôle qui est montré, et non le nom de la personne : ce qui sert en
 * permanence est le point de vue depuis lequel les données se lisent, puisqu'il
 * commande le périmètre visible. Un cumul est possible, un propriétaire pouvant
 * gérer lui-même son patrimoine (DEC-003).
 */
export function describeRoles(roles: readonly Role[]): string {
  const unique = [...new Set(roles)];
  const labels = unique.map((role) => ROLE_LABELS[role]);

  if (labels.length === 0) return 'Aucun accès';
  if (labels.length === 1) return labels[0] ?? '';

  const last = labels[labels.length - 1];

  return `${labels.slice(0, -1).join(', ')} et ${(last ?? '').toLowerCase()}`;
}
