import { redirect } from 'next/navigation';

import { requireAccessContext, type AccessContext } from '@/lib/authorization';

import { UnauthenticatedError } from './session';

/**
 * Contexte d'accès d'une page ou d'une Server Action, ou renvoi vers la connexion.
 *
 * Les routes d'API répondent 401, ce qui est correct pour un client programmatique.
 * Un écran, lui, doit conduire l'utilisateur à l'écran de connexion : afficher une
 * page d'erreur reviendrait à lui dire « non » sans lui dire quoi faire.
 *
 * Réservé aux pages et aux Server Actions. Une route d'API ne doit PAS l'utiliser :
 * répondre 303 vers un écran HTML à un appel JSON serait illisible.
 */
export async function requireAccessContextOrSignIn(): Promise<AccessContext> {
  try {
    return await requireAccessContext();
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect('/connexion');

    throw error;
  }
}
