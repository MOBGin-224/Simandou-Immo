'use server';

import { revalidatePath } from 'next/cache';

import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { PermissionDeniedError, ResourceOutOfScopeError } from '@/lib/authorization';
import { RentGenerationLimitError, RentValidationError, generateRents } from '@/modules/rents';

/**
 * Server Actions des écrans Loyers (MVP-BACKLOG-037 et 039).
 *
 * Elles ne contiennent AUCUNE règle : elles lisent le formulaire, appellent le
 * cas d'usage, et traduisent l'échec en état affichable. La route HTTP
 * équivalente appelle exactement la même fonction, ce qui rend impossible qu'un
 * contrôle existe d'un côté et pas de l'autre (API-001).
 *
 * L'autorisation est vérifiée ICI malgré l'écran qui masque déjà l'action : une
 * Server Action est joignable par une requête POST directe, indépendamment de
 * l'interface. Un bouton caché n'est pas une sécurité.
 *
 * **Une seule action dans ce fichier, et c'est voulu.** Une échéance ne se crée
 * pas à la main, ne se modifie pas et ne se supprime pas : son montant vient du
 * contrat (BR-036) et son statut de sa situation financière (BR-037). Le seul
 * geste que l'écran offre est de GÉNÉRER ce que les baux impliquent déjà. Le
 * paiement, qui est l'autre geste attendu, arrive au Lot 11.
 */
export type RentGenerationState = {
  /** Message de réussite, affiché en vert. */
  success?: string;
  /** Message d'échec, affiché en rouge. */
  message?: string;
};

/**
 * Génère les échéances du mois en cours, dans le périmètre de l'appelant.
 *
 * **Sans aucun champ**, et la décision se lit là : la période est le mois en
 * cours (DEC-053), et aucun écran ne propose de la choisir. Réclamer un mois
 * écoulé reste possible par l'API, délibérément, parce que c'est une opération
 * rare qui mérite d'être explicite plutôt qu'à un clic d'un bouton quotidien.
 *
 * **Idempotente**, donc sans danger à double-cliquer : la contrainte d'unicité
 * arbitre, et le compte rendu distingue ce qui a été créé de ce qui existait
 * déjà. C'est précisément ce que le message dit, au lieu d'annoncer un succès
 * qui laisserait croire à un travail refait.
 */
export async function generateRentsAction(
  _previousState: RentGenerationState,
  formData: FormData,
): Promise<RentGenerationState> {
  const context = await requireAccessContextOrSignIn();
  const propertyId = formData.get('propertyId');

  try {
    const result = await generateRents(getDb(), context, {
      propertyId: typeof propertyId === 'string' && propertyId.length > 0 ? propertyId : null,
    });

    revalidatePath('/loyers');
    revalidatePath('/mon-logement');

    if (result.expected === 0) {
      return {
        success: 'Aucun bail en cours à facturer ce mois-ci.',
      };
    }

    if (result.created === 0) {
      return {
        success: `Les ${result.expected} loyers du mois étaient déjà générés : rien n'a été recréé.`,
      };
    }

    return {
      success:
        result.skipped === 0
          ? `${result.created} loyers générés pour ce mois.`
          : `${result.created} loyers générés, ${result.skipped} déjà présents.`,
    };
  } catch (error) {
    if (error instanceof RentGenerationLimitError) return { message: error.message };

    // Une validation ne peut venir ici que d'un appel direct : l'écran n'envoie
    // aucun champ libre. Le message reste utile à qui exerce l'action hors
    // interface.
    if (error instanceof RentValidationError) {
      return { message: 'La demande de génération est invalide.' };
    }

    if (error instanceof PermissionDeniedError) {
      return { message: "Vous n'avez pas le droit de générer les loyers." };
    }

    if (error instanceof ResourceOutOfScopeError) {
      return { message: 'Cet élément est introuvable.' };
    }

    throw error;
  }
}
