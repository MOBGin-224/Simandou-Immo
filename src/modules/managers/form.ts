/**
 * Traduction des formulaires du module Gestionnaires vers les entrées des cas d'usage.
 *
 * Même raison d'être que pour les appartements : un fichier de Server Actions porte
 * `'use server'` et ne peut exporter que des fonctions asynchrones, donc la
 * conversion qui y vivrait serait intestable autrement qu'en pilotant un
 * navigateur. Or c'est là que se logent les défauts de saisie, un formulaire HTML
 * ne transmettant que des chaînes.
 *
 * Pure : ni base, ni HTTP, ni React.
 */

/** Ce que le schéma d'invitation attend en entrée. */
export type InviteFormInput = {
  organizationId: FormDataEntryValue | null;
  name: FormDataEntryValue | null;
  phone: FormDataEntryValue | null;
  email: FormDataEntryValue | null;
  propertyIds: FormDataEntryValue[];
};

/**
 * Champs d'invitation tels que le formulaire les envoie.
 *
 * Les immeubles sont des cases à cocher de même nom : `getAll` les réunit. Aucune
 * valeur n'est convertie ici, les schémas étant le point unique où une saisie
 * devient une donnée : convertir en deux endroits garantirait que les deux
 * divergent.
 */
export function inviteFields(formData: FormData): InviteFormInput {
  return {
    organizationId: formData.get('organizationId'),
    name: formData.get('name'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    propertyIds: formData.getAll('propertyIds'),
  };
}

/** Noms des champs textuels du formulaire d'invitation, dans l'ordre de l'écran. */
export const INVITE_FIELD_NAMES = ['organizationId', 'name', 'phone', 'email'] as const;

/**
 * Saisie à réafficher en cas de refus, ramenée à des chaînes.
 *
 * Sans elle, un refus réafficherait un formulaire vide : l'utilisateur perdrait
 * sa saisie au moment précis où il doit la corriger.
 */
export function submittedInviteValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};

  for (const field of INVITE_FIELD_NAMES) {
    const value = formData.get(field);

    if (typeof value === 'string') values[field] = value;
  }

  return values;
}

/** Immeubles cochés, à recocher en cas de refus. */
export function submittedPropertyIds(formData: FormData): string[] {
  return formData
    .getAll('propertyIds')
    .filter((value): value is string => typeof value === 'string');
}

/**
 * Message d'erreur si le mot de passe et sa confirmation diffèrent, sinon `null`.
 *
 * La confirmation n'existe que dans le formulaire : elle ne fait pas partie du
 * contrat de l'API, qui reçoit un mot de passe. Elle protège d'une faute de frappe
 * sur un secret qu'on ne voit pas, ce qui coûterait ici un compte inutilisable
 * dès sa première connexion.
 */
export function passwordConfirmationError(formData: FormData): string | null {
  const password = formData.get('password');
  const confirmation = formData.get('passwordConfirmation');

  if (typeof password !== 'string' || typeof confirmation !== 'string') return null;

  return password === confirmation ? null : 'Les deux mots de passe ne sont pas identiques.';
}
