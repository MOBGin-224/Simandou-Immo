'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { PermissionDeniedError, ResourceOutOfScopeError } from '@/lib/authorization';
import {
  LeaseConflictError,
  LeaseStateError,
  LeaseTerminationDateError,
  LeaseValidationError,
  createLease,
  terminateLease,
  updateLease,
} from '@/modules/leases';
import {
  CREATE_FIELD_NAMES,
  TERMINATE_FIELD_NAMES,
  UPDATE_FIELD_NAMES,
  createFields,
  submittedValues,
  terminateFields,
  updateFields,
} from '@/modules/leases/form';

/**
 * Server Actions des écrans Contrats (MVP-BACKLOG-035).
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
export type LeaseFormState = {
  /** Message global, affiché en haut du formulaire. */
  message?: string;
  /** Messages par champ, affichés sous le champ concerné. */
  fieldErrors?: Record<string, string[]>;
  /** Valeurs textuelles soumises, renvoyées telles quelles en cas d'échec. */
  values?: Record<string, string>;
};

/**
 * Traduit une erreur de cas d'usage en état de formulaire.
 *
 * Aucune erreur inconnue n'est absorbée : elle est relancée pour atteindre la
 * frontière d'erreur de Next, où elle sera journalisée.
 */
function toFormState(error: unknown, values: Record<string, string>): LeaseFormState {
  if (error instanceof LeaseValidationError) {
    return {
      message: 'Certaines informations doivent être corrigées.',
      fieldErrors: error.fieldErrors,
      values,
    };
  }

  // Ces deux refus portent sur la SITUATION et non sur un champ : le logement est
  // déjà loué, ou la personne déjà engagée. Le message dit lequel.
  if (error instanceof LeaseConflictError) {
    return {
      message: error.message,
      fieldErrors:
        error.reason === 'apartment-occupied'
          ? { apartmentId: [error.message] }
          : { tenantId: [error.message] },
      values,
    };
  }

  if (error instanceof LeaseTerminationDateError) {
    return { fieldErrors: { terminationDate: [error.message] }, values };
  }

  if (error instanceof LeaseStateError) return { message: error.message, values };

  if (error instanceof PermissionDeniedError) {
    return { message: "Vous n'avez pas le droit d'effectuer cette opération.", values };
  }

  if (error instanceof ResourceOutOfScopeError) {
    return { message: 'Cet élément est introuvable.', values };
  }

  throw error;
}

/**
 * Crée un bail, puis ouvre sa fiche (parcours 11).
 *
 * La redirection est hors du `try` : `redirect` interrompt l'exécution par une
 * exception interne à Next, et la capturer transformerait un succès en message
 * d'erreur.
 */
export async function createLeaseAction(
  _previousState: LeaseFormState,
  formData: FormData,
): Promise<LeaseFormState> {
  const context = await requireAccessContextOrSignIn();
  let leaseId: string;

  try {
    const created = await createLease(getDb(), context, createFields(formData));

    leaseId = created.id;
  } catch (error) {
    return toFormState(error, submittedValues(formData, CREATE_FIELD_NAMES));
  }

  revalidatePath('/baux');
  revalidatePath('/locataires');
  redirect(`/baux/${leaseId}`);
}

/** Modifie un bail, puis revient à sa fiche. */
export async function updateLeaseAction(
  leaseId: string,
  _previousState: LeaseFormState,
  formData: FormData,
): Promise<LeaseFormState> {
  const context = await requireAccessContextOrSignIn();

  try {
    await updateLease(getDb(), context, leaseId, updateFields(formData));
  } catch (error) {
    return toFormState(error, submittedValues(formData, UPDATE_FIELD_NAMES));
  }

  revalidatePath('/baux');
  revalidatePath(`/baux/${leaseId}`);
  redirect(`/baux/${leaseId}`);
}

/**
 * Clôture un bail, puis revient à sa fiche.
 *
 * La fiche reste accessible après la clôture : l'historique locatif se
 * reconstruit des baux, et rediriger vers la liste donnerait l'impression d'une
 * suppression, qui n'a pas eu lieu.
 */
export async function terminateLeaseAction(
  leaseId: string,
  _previousState: LeaseFormState,
  formData: FormData,
): Promise<LeaseFormState> {
  const context = await requireAccessContextOrSignIn();

  try {
    await terminateLease(getDb(), context, leaseId, terminateFields(formData));
  } catch (error) {
    return toFormState(error, submittedValues(formData, TERMINATE_FIELD_NAMES));
  }

  revalidatePath('/baux');
  revalidatePath(`/baux/${leaseId}`);
  revalidatePath('/locataires');
  redirect(`/baux/${leaseId}`);
}
