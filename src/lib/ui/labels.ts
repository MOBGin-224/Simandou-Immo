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

/**
 * Ordre d'autorité des rôles, du plus large au plus étroit.
 *
 * Le même que celui qui commande l'accueil (`homeForRoles`) et la navigation
 * (`navigationForRoles`) : la gestion passe devant la location. Il est écrit ici
 * parce qu'un libellé qui contredirait ces deux-là annoncerait un point de vue
 * que les écrans ne donnent pas.
 */
const ROLE_PRECEDENCE: readonly Role[] = ['OWNER', 'MANAGER', 'TENANT'];

/**
 * Le rôle qui GOUVERNE, en un seul mot, pour le chrome.
 *
 * `describeRoles` énumère, et c'est ce qu'il faut sur une fiche de compte. Dans
 * l'en-tête, c'est une autre question qui se pose : depuis quel point de vue les
 * données affichées sont-elles lues ? Un cumul n'a qu'une réponse, celle que
 * suivent déjà l'accueil et la navigation, et l'énumérer ne renseignerait pas
 * davantage.
 *
 * La raison est aussi une MESURE. « Locataire et gestionnaire » en capitales à
 * +16 % d'interlettrage réclame 215 px, là où un écran de 360 px n'en laisse
 * que 156 à côté de la marque : le libellé y était tronqué en « LOCATAIRE ET
 * GESTIONN... », donc illisible, à toutes les largeurs de téléphone. Un seul
 * mot tient partout.
 *
 * L'énumération complète reste lisible sur l'écran de compte, que la navigation
 * met à un geste.
 */
export function describePrimaryRole(roles: readonly Role[]): string {
  const governing = ROLE_PRECEDENCE.find((role) => roles.includes(role));

  return governing === undefined ? 'Aucun accès' : ROLE_LABELS[governing];
}
