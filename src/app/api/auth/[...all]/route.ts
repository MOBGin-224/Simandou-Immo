import { getAuth } from '@/lib/auth/server';

/**
 * Points d'entrée HTTP de Better Auth (DEC-032, ADR-006).
 *
 * Le code métier passe par `@/lib/auth` ; seuls ce fichier et
 * `src/lib/auth/instance.ts` connaissent la bibliothèque.
 *
 * L'instance est résolue par requête et non au chargement du module :
 * `next build` importe ce fichier pour en collecter les métadonnées, et un
 * secret de session n'a pas à être disponible pour compiler l'application.
 *
 * Ce gestionnaire n'expose que les parcours activés par la configuration :
 * connexion par téléphone et mot de passe, session, déconnexion, changement de
 * mot de passe, révocation de session. La connexion et l'inscription par email
 * sont désactivées (DEC-032, ADR-008), et les parcours OTP échouent faute de
 * fournisseur SMS (DEC-008).
 */
export function GET(request: Request): Promise<Response> {
  return getAuth().handler(request);
}

export function POST(request: Request): Promise<Response> {
  return getAuth().handler(request);
}
