'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { PermissionDeniedError, ResourceOutOfScopeError } from '@/lib/authorization';
import {
  InvitationNotOpenError,
  InvitationTargetUnavailableError,
  ManagerInvitationConflictError,
  ManagerValidationError,
  inviteManager,
  resendManagerInvitation,
  revokeManagerInvitation,
  type IssuedInvitation,
} from '@/modules/managers';
import { inviteFields, submittedInviteValues, submittedPropertyIds } from '@/modules/managers/form';

/**
 * Server Actions des écrans Gestionnaires (MVP-BACKLOG-026).
 *
 * Elles ne contiennent AUCUNE règle : elles lisent le formulaire, appellent le cas
 * d'usage, et traduisent l'échec en état affichable. La route HTTP équivalente
 * appelle exactement les mêmes fonctions, ce qui rend impossible qu'un contrôle
 * existe d'un côté et pas de l'autre (API-001).
 *
 * L'autorisation est vérifiée ICI malgré l'écran qui masque déjà l'action : une
 * Server Action est joignable par une requête POST directe, indépendamment de
 * l'interface. Un bouton caché n'est pas une sécurité.
 */

/**
 * Invitation qui vient d'être émise, telle que l'écran l'affiche.
 *
 * Le lien n'est dans l'état QUE pour cet affichage, une seule fois : la base ne
 * conserve que le hachage du jeton, donc rien ne permet de le reconstituer. Dates
 * en texte, car l'état d'une action traverse la frontière serveur et navigateur.
 */
export type IssuedInvitationState = {
  invitationId: string;
  link: string;
  expiresAt: string;
  name: string;
  phone: string | null;
};

export type ManagerFormState = {
  /** Message global, affiché en haut du formulaire. */
  message?: string;
  /** Messages par champ, affichés sous le champ concerné. */
  fieldErrors?: Record<string, string[]>;
  /** Valeurs textuelles soumises, renvoyées telles quelles en cas d'échec. */
  values?: Record<string, string>;
  /** Immeubles cochés, à recocher en cas d'échec. */
  selectedPropertyIds?: string[];
  /** Présent après une création ou un renvoi réussi : le lien est alors à afficher. */
  issued?: IssuedInvitationState;
};

function toIssuedState(issued: IssuedInvitation): IssuedInvitationState {
  return {
    invitationId: issued.invitation.id,
    link: issued.link,
    expiresAt: issued.invitation.expiresAt.toISOString(),
    name: issued.invitation.fullName,
    phone: issued.invitation.phone,
  };
}

/**
 * Traduit une erreur de cas d'usage en état de formulaire.
 *
 * Aucune erreur inconnue n'est absorbée : elle est relancée pour atteindre la
 * frontière d'erreur de Next, où elle sera journalisée. Afficher « une erreur est
 * survenue » sur un défaut de programmation le rendrait invisible.
 */
function toFormState(
  error: unknown,
  values: Record<string, string>,
  selectedPropertyIds: string[],
): ManagerFormState {
  if (error instanceof ManagerValidationError) {
    return {
      message: 'Certaines informations doivent être corrigées.',
      fieldErrors: error.fieldErrors,
      values,
      selectedPropertyIds,
    };
  }

  // Ces refus portent sur LA PERSONNE invitée : le champ qui l'identifie est le
  // numéro de téléphone, c'est donc là qu'ils s'affichent.
  if (
    error instanceof ManagerInvitationConflictError ||
    error instanceof InvitationTargetUnavailableError
  ) {
    return { fieldErrors: { phone: [error.message] }, values, selectedPropertyIds };
  }

  if (error instanceof InvitationNotOpenError) {
    return { message: error.message, values, selectedPropertyIds };
  }

  // Refus d'accès et ressource hors périmètre : l'écran avait masqué l'action, donc
  // l'état a changé depuis son affichage, ou la requête ne vient pas de l'écran.
  if (error instanceof PermissionDeniedError) {
    return {
      message: "Vous n'avez pas le droit d'effectuer cette opération.",
      values,
      selectedPropertyIds,
    };
  }

  if (error instanceof ResourceOutOfScopeError) {
    return { message: 'Cette invitation est introuvable.', values, selectedPropertyIds };
  }

  throw error;
}

/**
 * Invite un gestionnaire, puis affiche le lien à copier (parcours 4, étape 7).
 *
 * Pas de redirection : le lien n'existe qu'ici, une seule fois, et une redirection
 * le perdrait. L'écran remplace donc le formulaire par le lien.
 */
export async function inviteManagerAction(
  _previousState: ManagerFormState,
  formData: FormData,
): Promise<ManagerFormState> {
  const context = await requireAccessContextOrSignIn();

  try {
    const issued = await inviteManager(getDb(), context, inviteFields(formData));

    revalidatePath('/gestionnaires');

    return { issued: toIssuedState(issued) };
  } catch (error) {
    return toFormState(error, submittedInviteValues(formData), submittedPropertyIds(formData));
  }
}

/**
 * Renvoie une invitation : un nouveau lien, l'ancien invalidé (BR-013).
 *
 * Même raison de ne pas rediriger : le nouveau lien n'est affiché qu'une fois.
 */
export async function resendInvitationAction(
  invitationId: string,
  _previousState: ManagerFormState,
  _formData: FormData,
): Promise<ManagerFormState> {
  const context = await requireAccessContextOrSignIn();

  try {
    const issued = await resendManagerInvitation(getDb(), context, invitationId);

    revalidatePath('/gestionnaires');
    revalidatePath(`/gestionnaires/invitations/${invitationId}`);

    return { issued: toIssuedState(issued) };
  } catch (error) {
    return toFormState(error, {}, []);
  }
}

/**
 * Révoque une invitation, puis revient à la liste (SEC-INV-005).
 *
 * La redirection est hors du `try` : `redirect` interrompt l'exécution par une
 * exception interne à Next, et la capturer transformerait un succès en message
 * d'erreur.
 */
export async function revokeInvitationAction(
  invitationId: string,
  _previousState: ManagerFormState,
  _formData: FormData,
): Promise<ManagerFormState> {
  const context = await requireAccessContextOrSignIn();

  try {
    await revokeManagerInvitation(getDb(), context, invitationId);
  } catch (error) {
    return toFormState(error, {}, []);
  }

  revalidatePath('/gestionnaires');
  redirect('/gestionnaires');
}
