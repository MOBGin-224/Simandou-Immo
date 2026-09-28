'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { PermissionDeniedError, ResourceOutOfScopeError } from '@/lib/authorization';
import {
  ArchivedPropertyError,
  PropertyNameAlreadyUsedError,
  PropertyValidationError,
  archiveProperty,
  createProperty,
  updateProperty,
} from '@/modules/properties';

/**
 * Server Actions des écrans Immeubles (MVP-BACKLOG-018).
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
export type PropertyFormState = {
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
 * frontière d'erreur de Next, où elle sera journalisée. Afficher « une erreur est
 * survenue » sur un défaut de programmation le rendrait invisible.
 */
function toFormState(error: unknown, values: Record<string, string>): PropertyFormState {
  if (error instanceof PropertyValidationError) {
    return {
      message: 'Certaines informations doivent être corrigées.',
      fieldErrors: error.fieldErrors,
      values,
    };
  }

  if (error instanceof PropertyNameAlreadyUsedError) {
    return { fieldErrors: { name: [error.message] }, values };
  }

  if (error instanceof ArchivedPropertyError) {
    return { message: error.message, values };
  }

  // Refus d'accès et ressource hors périmètre : l'écran avait masqué l'action, donc
  // l'état a changé depuis son affichage, ou la requête ne vient pas de l'écran.
  if (error instanceof PermissionDeniedError) {
    return { message: "Vous n'avez pas le droit d'effectuer cette opération.", values };
  }

  if (error instanceof ResourceOutOfScopeError) {
    return { message: 'Cet immeuble est introuvable.', values };
  }

  throw error;
}

/** Noms des champs du formulaire d'immeuble, dans l'ordre de l'écran. */
const PROPERTY_FIELD_NAMES = [
  'organizationId',
  'name',
  'district',
  'city',
  'address',
  'description',
] as const;

/** Champs d'immeuble tels que le formulaire les envoie, sans transformation. */
function propertyFields(formData: FormData) {
  return {
    name: formData.get('name'),
    address: formData.get('address'),
    city: formData.get('city'),
    district: formData.get('district'),
    description: formData.get('description'),
  };
}

/** Saisie à réafficher en cas de refus, ramenée à des chaînes. */
function submittedValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};

  for (const field of PROPERTY_FIELD_NAMES) {
    const value = formData.get(field);

    if (typeof value === 'string') values[field] = value;
  }

  return values;
}

/**
 * Crée un immeuble, puis conduit à sa fiche.
 *
 * La redirection est hors du `try` : `redirect` interrompt l'exécution par une
 * exception interne à Next, et la capturer transformerait un succès en message
 * d'erreur.
 */
export async function createPropertyAction(
  _previousState: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  const context = await requireAccessContextOrSignIn();

  let propertyId: string;

  try {
    const property = await createProperty(getDb(), context, {
      organizationId: formData.get('organizationId'),
      ...propertyFields(formData),
    });

    propertyId = property.id;
  } catch (error) {
    return toFormState(error, submittedValues(formData));
  }

  revalidatePath('/immeubles');
  redirect(`/immeubles/${propertyId}`);
}

/** Modifie un immeuble, puis revient à sa fiche. */
export async function updatePropertyAction(
  propertyId: string,
  _previousState: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  const context = await requireAccessContextOrSignIn();

  try {
    await updateProperty(getDb(), context, propertyId, propertyFields(formData));
  } catch (error) {
    return toFormState(error, submittedValues(formData));
  }

  revalidatePath('/immeubles');
  revalidatePath(`/immeubles/${propertyId}`);
  redirect(`/immeubles/${propertyId}`);
}

/**
 * Archive un immeuble, puis revient à sa fiche.
 *
 * La fiche reste accessible après archivage : l'historique d'un immeuble archivé
 * demeure consultable (BR-025). Rediriger vers la liste donnerait l'impression
 * d'une suppression.
 */
export async function archivePropertyAction(
  propertyId: string,
  _previousState: PropertyFormState,
  _formData: FormData,
): Promise<PropertyFormState> {
  const context = await requireAccessContextOrSignIn();

  try {
    await archiveProperty(getDb(), context, propertyId);
  } catch (error) {
    // Aucune saisie à réafficher : l'archivage est une confirmation, pas un
    // formulaire de saisie.
    return toFormState(error, {});
  }

  revalidatePath('/immeubles');
  revalidatePath(`/immeubles/${propertyId}`);
  redirect(`/immeubles/${propertyId}`);
}
