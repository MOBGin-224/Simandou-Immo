'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { PermissionDeniedError, ResourceOutOfScopeError } from '@/lib/authorization';
import {
  ChargeNoUnitError,
  ChargeStateError,
  ChargeValidationError,
  cancelCharge,
  createCharge,
  publishCharge,
} from '@/modules/charges';
import { chargeFields, submittedValues } from '@/modules/charges/form';

/**
 * Server Actions des écrans Charges (MVP-BACKLOG-051, 052 et 054).
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
 * **Trois actions, et trois seulement** : enregistrer, publier, annuler. Il n'y
 * a pas de modification, et ce n'est pas un oubli : BR-053 interdit de corriger
 * une charge en silence, et une charge fausse s'annule puis se recrée, ce qui
 * laisse les deux dans l'historique (BR-054).
 */
export type ChargeFormState = {
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
function toFormState(error: unknown, values: Record<string, string> = {}): ChargeFormState {
  if (error instanceof ChargeValidationError) {
    return {
      message: 'Certaines informations doivent être corrigées.',
      fieldErrors: error.fieldErrors,
      values,
    };
  }

  /*
   * Ces deux refus portent sur la SITUATION et non sur un champ : la charge est
   * déjà publiée ou annulée, ou l'immeuble n'a aucun logement entre qui
   * répartir. Le message du domaine dit lequel et comment en sortir.
   */
  if (error instanceof ChargeStateError || error instanceof ChargeNoUnitError) {
    return { message: error.message, values };
  }

  if (error instanceof PermissionDeniedError) {
    return { message: "Vous n'avez pas le droit d'effectuer cette opération.", values };
  }

  if (error instanceof ResourceOutOfScopeError) {
    return { message: 'Cet élément est introuvable.', values };
  }

  throw error;
}

/** Rafraîchit les écrans qu'une charge touche, publication comprise. */
function revalidateCharge(chargeId?: string): void {
  revalidatePath('/charges');
  if (chargeId) revalidatePath(`/charges/${chargeId}`);

  /*
   * L'espace locataire et le total dû changent dès qu'une charge est publiée ou
   * annulée : la part devient une créance payable (DEC-005), donc le montant que
   * la personne lit avant de payer n'est plus le même.
   */
  revalidatePath('/mon-logement');
}

/**
 * Enregistre une charge en brouillon, puis ouvre sa fiche (parcours 18).
 *
 * La fiche, et non la liste : l'étape suivante du parcours est de VÉRIFIER la
 * répartition avant de publier, et c'est la fiche qui la montre. Mener à la
 * liste obligerait à retrouver la charge qu'on vient de saisir.
 *
 * La redirection est hors du `try` : `redirect` interrompt l'exécution par une
 * exception interne à Next, et la capturer transformerait un succès en message
 * d'erreur.
 */
export async function createChargeAction(
  _previousState: ChargeFormState,
  formData: FormData,
): Promise<ChargeFormState> {
  const context = await requireAccessContextOrSignIn();
  let chargeId: string;

  try {
    const created = await createCharge(getDb(), context, chargeFields(formData));

    chargeId = created.id;
  } catch (error) {
    return toFormState(error, submittedValues(formData));
  }

  revalidateCharge(chargeId);
  redirect(`/charges/${chargeId}`);
}

/**
 * Publie une charge et crée ses créances (MVP-BACKLOG-052, BR-052).
 *
 * L'identifiant vient d'un champ caché et non de l'URL : l'action est appelée
 * depuis un écran de confirmation, et c'est ce que celui-ci a affiché qu'elle
 * doit publier.
 *
 * Un second envoi, par double-clic ou par retour en arrière, reçoit le message
 * du conflit plutôt qu'un succès trompeur : la publication n'est pas rejouable,
 * et le dire est plus utile que de laisser croire qu'elle a été refaite.
 */
export async function publishChargeAction(
  _previousState: ChargeFormState,
  formData: FormData,
): Promise<ChargeFormState> {
  const context = await requireAccessContextOrSignIn();
  const chargeId = formData.get('chargeId');

  if (typeof chargeId !== 'string' || chargeId.length === 0) {
    return { message: 'Cet élément est introuvable.' };
  }

  try {
    await publishCharge(getDb(), context, chargeId);
  } catch (error) {
    return toFormState(error);
  }

  revalidateCharge(chargeId);
  redirect(`/charges/${chargeId}`);
}

/**
 * Annule une charge et éteint ses créances (BR-054).
 *
 * Le même geste sert à deux situations, et c'est voulu : retirer une facture
 * publiée à tort, et corriger un brouillon erroné. Dans les deux cas rien n'est
 * supprimé, et la charge reste consultable.
 */
export async function cancelChargeAction(
  _previousState: ChargeFormState,
  formData: FormData,
): Promise<ChargeFormState> {
  const context = await requireAccessContextOrSignIn();
  const chargeId = formData.get('chargeId');

  if (typeof chargeId !== 'string' || chargeId.length === 0) {
    return { message: 'Cet élément est introuvable.' };
  }

  try {
    await cancelCharge(getDb(), context, chargeId);
  } catch (error) {
    return toFormState(error);
  }

  revalidateCharge(chargeId);
  redirect(`/charges/${chargeId}`);
}
