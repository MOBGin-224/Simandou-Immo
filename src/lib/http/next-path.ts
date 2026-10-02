/**
 * Destination d'une redirection demandée par l'URL, ou `null`.
 *
 * Un paramètre qui décide où l'on atterrit après la connexion est un classique de
 * l'hameçonnage : un lien `…/connexion?suivant=https://site-pirate` conduirait la
 * victime, juste après qu'elle a saisi son mot de passe, sur une page qui imite
 * le produit. La règle n'est donc pas « refuser les adresses externes » mais
 * l'inverse : n'accepter que ce qui figure sur une LISTE FERMÉE.
 *
 * Aujourd'hui une seule forme y figure, le lien d'une invitation. Elle sert un
 * invité qui possède déjà un compte : il doit se connecter, puis revenir à son
 * invitation. Le jeton y est d'une forme exacte, 43 caractères en base64url.
 *
 * Toute autre valeur, absolue, relative à un autre protocole, avec une barre
 * oblique doublée, un retour à la ligne ou un résidu après le jeton, vaut `null`.
 */
const ALLOWED_NEXT_PATHS: readonly RegExp[] = [/^\/invitation\/[A-Za-z0-9_-]{43}$/];

export function safeNextPath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;

  return ALLOWED_NEXT_PATHS.some((pattern) => pattern.test(raw)) ? raw : null;
}
