'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { PermissionDeniedError, ResourceOutOfScopeError } from '@/lib/authorization';
import {
  ApartmentBulkConflictError,
  ApartmentNumberAlreadyUsedError,
  ApartmentValidationError,
  ArchivedApartmentError,
  createApartment,
  generateApartments,
  updateApartment,
} from '@/modules/apartments';
import {
  apartmentFields,
  generationFields,
  submittedGenerationValues,
  submittedValues,
} from '@/modules/apartments/form';

/**
 * Server Actions des écrans Appartements (MVP-BACKLOG-022).
 *
 * Elles ne contiennent AUCUNE règle : elles lisent le formulaire, appellent le
 * cas d'usage, et traduisent l'échec en état affichable. La route HTTP
 * équivalente appelle exactement les mêmes fonctions, ce qui rend impossible
 * qu'un contrôle existe d'un côté et pas de l'autre (API-001).
 *
 * L'autorisation est vérifiée ICI malgré l'écran qui masque déjà l'action : une
 * Server Action est joignable par une requête POST directe, indépendamment de
 * l'interface. Un bouton caché n'est pas une sécurité.
 */
export type ApartmentFormState = {
  /** Message global, affiché en haut du formulaire. */
  message?: string;
  /** Messages par champ, affichés sous le champ concerné. */
  fieldErrors?: Record<string, string[]>;
  /**
   * Valeurs soumises, renvoyées telles quelles en cas d'échec.
   *
   * Sans elles, un refus réafficherait le formulaire avec les valeurs d'origine :
   * l'utilisateur perdrait sa saisie au moment précis où il doit la corriger.
   */
  values?: Record<string, string>;
};

/**
 * Traduit une erreur de cas d'usage en état de formulaire.
 *
 * Aucune erreur inconnue n'est absorbée : elle est relancée pour atteindre la
 * frontière d'erreur de Next, où elle sera journalisée. Afficher « une erreur
 * est survenue » sur un défaut de programmation le rendrait invisible.
 */
function toFormState(error: unknown, values: Record<string, string>): ApartmentFormState {
  if (error instanceof ApartmentValidationError) {
    return {
      message: 'Certaines informations doivent être corrigées.',
      fieldErrors: error.fieldErrors,
      values,
    };
  }

  if (error instanceof ApartmentNumberAlreadyUsedError) {
    return { fieldErrors: { number: [error.message] }, values };
  }

  if (error instanceof ApartmentBulkConflictError) {
    return { fieldErrors: { count: [error.message] }, values };
  }

  if (error instanceof ArchivedApartmentError) {
    return { message: error.message, values };
  }

  // Refus d'accès et ressource hors périmètre : l'écran avait masqué l'action,
  // donc l'état a changé depuis son affichage, ou la requête ne vient pas de
  // l'écran.
  if (error instanceof PermissionDeniedError) {
    return { message: "Vous n'avez pas le droit d'effectuer cette opération.", values };
  }

  if (error instanceof ResourceOutOfScopeError) {
    return { message: 'Cet appartement est introuvable.', values };
  }

  throw error;
}

/** Rafraîchit les écrans que la création ou la modification d'un logement change. */
function revalidateApartmentViews(propertyId: string, apartmentId?: string): void {
  // La liste des immeubles et la fiche portent le compteur de logements, qui
  // devient faux sans cela.
  revalidatePath('/immeubles');
  revalidatePath(`/immeubles/${propertyId}`);
  revalidatePath(`/immeubles/${propertyId}/appartements`);

  if (apartmentId) revalidatePath(`/immeubles/${propertyId}/appartements/${apartmentId}`);
}

/**
 * Crée un appartement, puis conduit à sa fiche.
 *
 * La redirection est hors du `try` : `redirect` interrompt l'exécution par une
 * exception interne à Next, et la capturer transformerait un succès en message
 * d'erreur.
 */
export async function createApartmentAction(
  propertyId: string,
  _previousState: ApartmentFormState,
  formData: FormData,
): Promise<ApartmentFormState> {
  const context = await requireAccessContextOrSignIn();

  let apartmentId: string;

  try {
    const apartment = await createApartment(
      getDb(),
      context,
      propertyId,
      apartmentFields(formData),
    );

    apartmentId = apartment.id;
  } catch (error) {
    return toFormState(error, submittedValues(formData));
  }

  revalidateApartmentViews(propertyId, apartmentId);
  redirect(`/immeubles/${propertyId}/appartements/${apartmentId}`);
}

/** Modifie un appartement, puis revient à sa fiche. */
export async function updateApartmentAction(
  propertyId: string,
  apartmentId: string,
  _previousState: ApartmentFormState,
  formData: FormData,
): Promise<ApartmentFormState> {
  const context = await requireAccessContextOrSignIn();

  try {
    await updateApartment(getDb(), context, apartmentId, apartmentFields(formData));
  } catch (error) {
    return toFormState(error, submittedValues(formData));
  }

  revalidateApartmentViews(propertyId, apartmentId);
  redirect(`/immeubles/${propertyId}/appartements/${apartmentId}`);
}

/**
 * Crée une suite numérotée d'appartements, puis conduit à la liste.
 *
 * Retour à la LISTE et non à une fiche : l'utilisateur vient de créer vingt
 * logements, et la seule vue qui rende compte de ce qu'il a obtenu est celle qui
 * les montre tous.
 */
export async function generateApartmentsAction(
  propertyId: string,
  _previousState: ApartmentFormState,
  formData: FormData,
): Promise<ApartmentFormState> {
  const context = await requireAccessContextOrSignIn();
  const fields = generationFields(formData);

  try {
    await generateApartments(getDb(), context, propertyId, fields);
  } catch (error) {
    return toFormState(error, submittedGenerationValues(formData));
  }

  revalidateApartmentViews(propertyId);

  /*
   * Retour à la liste, PRÉFILTRÉE sur le préfixe employé.
   *
   * Vu à l'écran : sur un immeuble qui comptait déjà plus de vingt logements,
   * une série fraîchement créée atterrissait en page 2, et l'utilisateur
   * revenait sur une liste où son travail était invisible. La recherche lui
   * montre exactement ce qu'il vient de créer, ce que le parcours 3 promet en
   * annonçant une structure complète.
   *
   * Sans préfixe, la numérotation est purement chiffrée : filtrer dessus
   * ramènerait n'importe quelle référence contenant ces chiffres, donc la liste
   * reste entière.
   */
  const prefix = typeof fields.prefix === 'string' ? fields.prefix.trim() : '';
  const base = `/immeubles/${propertyId}/appartements`;

  redirect(prefix === '' ? base : `${base}?recherche=${encodeURIComponent(prefix)}`);
}
