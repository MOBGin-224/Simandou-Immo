/**
 * Redirection après une soumission de formulaire, cookies compris.
 *
 * Statut 303 et non 302 : après un POST, il impose au navigateur de suivre la
 * redirection en GET. Avec un 302, un rechargement de la page rejouerait la
 * soumission, ce qui créerait deux fois la même ressource.
 *
 * Les `Set-Cookie` sont AJOUTÉS un par un : plusieurs cookies ne peuvent pas
 * tenir dans un seul en-tête, et écraser au lieu d'ajouter perdrait la session.
 */
export function redirectWithCookies(
  request: Request,
  path: string,
  cookies: readonly string[],
): Response {
  const headers = new Headers({ location: new URL(path, request.url).toString() });

  for (const cookie of cookies) headers.append('set-cookie', cookie);

  return new Response(null, { status: 303, headers });
}
