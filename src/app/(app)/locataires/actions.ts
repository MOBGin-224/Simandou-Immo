'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { PermissionDeniedError, ResourceOutOfScopeError } from '@/lib/authorization';
import { InvitationNotOpenError, InvitationTargetUnavailableError } from '@/modules/invitations';
import {
  TenantInvitationConflictError,
  TenantNameNotOwnedError,
  TenantStateError,
  TenantValidationError,
  inviteTenant,
  reactivateTenant,
  resendTenantInvitation,
  revokeTenant,
  revokeTenantInvitation,
  suspendTenant,
  updateTenant,
  type IssuedTenantInvitation,
} from '@/modules/tenants';
import { inviteFields, renameFields, submittedInviteValues } from '@/modules/tenants/form';

/**
 * Server Actions des écrans Locataires (MVP-BACKLOG-029 à 031).
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
export type IssuedTenantInvitationState = {
  invitationId: string;
  link: string;
  expiresAt: string;
  name: string;
  phone: string | null;
};

export type TenantFormState = {
  /** Message global, affiché en haut du formulaire. */
  message?: string;
  /** Messages par champ, affichés sous le champ concerné. */
  fieldErrors?: Record<string, string[]>;
  /** Valeurs textuelles soumises, renvoyées telles quelles en cas d'échec. */
  values?: Record<string, string>;
  /** Présent après une création ou un renvoi réussi : le lien est alors à afficher. */
  issued?: IssuedTenantInvitationState;
};

function toIssuedState(issued: IssuedTenantInvitation): IssuedTenantInvitationState {
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
function toFormState(error: unknown, values: Record<string, string>): TenantFormState {
  if (error instanceof TenantValidationError) {
    return {
      message: 'Certaines informations doivent être corrigées.',
      fieldErrors: error.fieldErrors,
      values,
    };
  }

  // Ces refus portent sur LA PERSONNE invitée : le champ qui l'identifie est le
  // numéro de téléphone, c'est donc là qu'ils s'affichent.
  if (
    error instanceof TenantInvitationConflictError ||
    error instanceof InvitationTargetUnavailableError
  ) {
    return { fieldErrors: { phone: [error.message] }, values };
  }

  if (error instanceof InvitationNotOpenError || error instanceof TenantStateError) {
    return { message: error.message, values };
  }

  // Le nom appartient au locataire (DEC-048) : le message le dit, et propose la
  // seule correction possible, révoquer puis réinviter.
  if (error instanceof TenantNameNotOwnedError) return { message: error.message, values };

  // Refus d'accès et ressource hors périmètre : l'écran avait masqué l'action, donc
  // l'état a changé depuis son affichage, ou la requête ne vient pas de l'écran.
  if (error instanceof PermissionDeniedError) {
    return { message: "Vous n'avez pas le droit d'effectuer cette opération.", values };
  }

  if (error instanceof ResourceOutOfScopeError) {
    return { message: 'Cet élément est introuvable.', values };
  }

  throw error;
}

/**
 * Invite un locataire, puis affiche le lien à copier (parcours 7, étape 4).
 *
 * Pas de redirection : le lien n'existe qu'ici, une seule fois, et une redirection
 * le perdrait. L'écran remplace donc le formulaire par le lien.
 */
export async function inviteTenantAction(
  _previousState: TenantFormState,
  formData: FormData,
): Promise<TenantFormState> {
  const context = await requireAccessContextOrSignIn();

  try {
    const issued = await inviteTenant(getDb(), context, inviteFields(formData));

    revalidatePath('/locataires');

    return { issued: toIssuedState(issued) };
  } catch (error) {
    return toFormState(error, submittedInviteValues(formData));
  }
}

/**
 * Renvoie une invitation : un nouveau lien, l'ancien invalidé (BR-013, DEC-045).
 *
 * Même raison de ne pas rediriger : le nouveau lien n'est affiché qu'une fois.
 */
export async function resendTenantInvitationAction(
  invitationId: string,
  _previousState: TenantFormState,
  _formData: FormData,
): Promise<TenantFormState> {
  const context = await requireAccessContextOrSignIn();

  try {
    const issued = await resendTenantInvitation(getDb(), context, invitationId);

    revalidatePath('/locataires');
    revalidatePath(`/locataires/invitations/${invitationId}`);

    return { issued: toIssuedState(issued) };
  } catch (error) {
    return toFormState(error, {});
  }
}

/**
 * Révoque une invitation, puis revient à la liste (SEC-INV-005).
 *
 * La redirection est hors du `try` : `redirect` interrompt l'exécution par une
 * exception interne à Next, et la capturer transformerait un succès en message
 * d'erreur.
 */
export async function revokeTenantInvitationAction(
  invitationId: string,
  _previousState: TenantFormState,
  _formData: FormData,
): Promise<TenantFormState> {
  const context = await requireAccessContextOrSignIn();

  try {
    await revokeTenantInvitation(getDb(), context, invitationId);
  } catch (error) {
    return toFormState(error, {});
  }

  revalidatePath('/locataires');
  redirect('/locataires');
}

/** Rafraîchit les écrans que la vie d'un accès change : la liste et la fiche. */
function revalidateTenantViews(accessId: string): void {
  revalidatePath('/locataires');
  revalidatePath(`/locataires/${accessId}`);
}

/** Suspend l'accès d'un locataire (DEC-047), puis revient à sa fiche. */
export async function suspendTenantAction(
  accessId: string,
  _previousState: TenantFormState,
  _formData: FormData,
): Promise<TenantFormState> {
  const context = await requireAccessContextOrSignIn();

  try {
    await suspendTenant(getDb(), context, accessId);
  } catch (error) {
    return toFormState(error, {});
  }

  revalidateTenantViews(accessId);
  redirect(`/locataires/${accessId}`);
}

/** Réactive un locataire suspendu (DEC-047), puis revient à sa fiche. */
export async function reactivateTenantAction(
  accessId: string,
  _previousState: TenantFormState,
  _formData: FormData,
): Promise<TenantFormState> {
  const context = await requireAccessContextOrSignIn();

  try {
    await reactivateTenant(getDb(), context, accessId);
  } catch (error) {
    return toFormState(error, {});
  }

  revalidateTenantViews(accessId);
  redirect(`/locataires/${accessId}`);
}

/**
 * Révoque l'accès d'un locataire au produit (DEC-047), puis revient à sa fiche.
 *
 * La fiche reste accessible après la révocation : l'historique demeure
 * consultable, et rediriger vers la liste donnerait l'impression d'une
 * suppression, qui n'a pas eu lieu. Aucun bail n'est terminé.
 */
export async function revokeTenantAction(
  accessId: string,
  _previousState: TenantFormState,
  _formData: FormData,
): Promise<TenantFormState> {
  const context = await requireAccessContextOrSignIn();

  try {
    await revokeTenant(getDb(), context, accessId);
  } catch (error) {
    return toFormState(error, {});
  }

  revalidateTenantViews(accessId);
  redirect(`/locataires/${accessId}`);
}

/**
 * Modifie le nom d'un locataire (DEC-048), puis revient à son espace.
 *
 * Seul le locataire lui-même y parvient : le nom vit dans `users`, donc il
 * appartient à la personne. Un propriétaire qui essaierait reçoit le message de
 * `TenantNameNotOwnedError`, et non un refus silencieux.
 */
export async function renameTenantAction(
  accessId: string,
  _previousState: TenantFormState,
  formData: FormData,
): Promise<TenantFormState> {
  const context = await requireAccessContextOrSignIn();
  const fields = renameFields(formData);
  const values: Record<string, string> =
    typeof fields.name === 'string' ? { name: fields.name } : {};

  try {
    await updateTenant(getDb(), context, accessId, fields);
  } catch (error) {
    return toFormState(error, values);
  }

  revalidateTenantViews(accessId);
  revalidatePath('/mon-logement');
  redirect('/mon-logement');
}
