import { eq } from 'drizzle-orm';

import { sessions } from '@/db/schema';

import type { AuthDatabase } from './instance';

/**
 * Met fin à TOUTES les sessions d'une personne, dans une transaction fournie
 * (BR-019, DEC-041).
 *
 * Pourquoi une écriture directe et pas l'API de Better Auth : la révocation d'un
 * accès est une opération métier atomique. Retirer l'accès et couper les sessions
 * doivent réussir ou échouer ENSEMBLE, ce que l'adaptateur de la bibliothèque, qui
 * ouvre sa propre connexion, ne peut pas garantir.
 *
 * Elle reste dans le module d'authentification, seul à connaître la forme de
 * `sessions` : le code métier ne touche jamais ces tables (DEC-032).
 *
 * C'est une COUPURE SUPPLÉMENTAIRE, pas la révocation elle-même. La révocation
 * est déjà effective à la requête suivante, parce que le contexte d'accès est relu
 * en base à chaque requête. Couper les sessions évite seulement qu'un navigateur
 * reste « connecté » à un produit qui ne lui montre plus rien.
 *
 * L'appelant ne doit l'employer que pour une personne qui n'a PLUS aucun accès
 * actif nulle part : les sessions ne sont pas propres à une organisation, et couper
 * celles d'une personne qui travaille encore pour un autre propriétaire la
 * déconnecterait à tort.
 */
export async function endAllSessionsOf(database: AuthDatabase, userId: string): Promise<void> {
  await database.delete(sessions).where(eq(sessions.userId, userId));
}
