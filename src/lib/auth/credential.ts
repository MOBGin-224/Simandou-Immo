import { and, eq } from 'drizzle-orm';

import { accounts } from '@/db/schema';

import { CREDENTIAL_PROVIDER_ID, type AuthDatabase } from './instance';

/**
 * Écriture du mot de passe d'un compte, DANS une transaction fournie (DEC-041).
 *
 * `definePassword` écrit par l'adaptateur de Better Auth, qui ouvre sa propre
 * connexion : il ne peut pas participer à la transaction d'un appelant. Pour
 * l'activation d'un compte, c'est un défaut sérieux, pour deux raisons.
 *
 *   1. ATOMICITÉ. Mot de passe écrit puis transaction échouée : le compte a un
 *      mot de passe sans accès. Transaction réussie puis mot de passe non écrit :
 *      un compte actif sans mot de passe, et une invitation déjà consommée qui ne
 *      peut plus le réparer.
 *   2. COURSE. Deux visiteurs avec le même lien : si le mot de passe s'écrit hors
 *      de la transaction qui consomme le lien, le perdant peut écraser le mot de
 *      passe du gagnant avant d'échouer, et connaître alors le mot de passe d'un
 *      compte qu'il n'a pas obtenu.
 *
 * Cette fonction écrit donc dans la transaction de l'appelant, APRÈS que celui-ci
 * a réclamé son invitation. Elle reste ici, dans le module d'authentification : il
 * est le seul à connaître la forme de `accounts`, et le code métier ne touche
 * jamais ces tables (DEC-032).
 *
 * Le hachage est calculé AVANT la transaction, par `hashPassword` : il est lent
 * volontairement, et le faire pendant que des verrous sont tenus les prolongerait
 * d'autant.
 *
 * Ne vérifie aucune autorisation, comme `definePassword` : c'est à l'appelant
 * d'avoir prouvé le droit de l'appeler. Elle ne doit servir qu'à un compte qui
 * n'a jamais été activé.
 */
export async function writeCredential(
  database: AuthDatabase,
  input: { userId: string; passwordHash: string },
): Promise<void> {
  const [existing] = await database
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, input.userId), eq(accounts.providerId, CREDENTIAL_PROVIDER_ID)))
    .limit(1);

  if (existing) {
    await database
      .update(accounts)
      .set({ password: input.passwordHash, updatedAt: new Date() })
      .where(eq(accounts.id, existing.id));

    return;
  }

  await database.insert(accounts).values({
    userId: input.userId,
    providerId: CREDENTIAL_PROVIDER_ID,
    // Pour un mot de passe, Better Auth utilise l'identifiant de l'utilisateur
    // comme identifiant de compte chez le « fournisseur » (voir `definePassword`).
    accountId: input.userId,
    password: input.passwordHash,
  });
}
