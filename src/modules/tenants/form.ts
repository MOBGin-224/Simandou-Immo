/**
 * Traduction des formulaires du module Locataires vers les entrées des cas d'usage.
 *
 * Même raison d'être que pour les gestionnaires : un fichier de Server Actions
 * porte `'use server'` et ne peut exporter que des fonctions asynchrones, donc la
 * conversion qui y vivrait serait intestable autrement qu'en pilotant un
 * navigateur. Or c'est là que se logent les défauts de saisie, un formulaire HTML
 * ne transmettant que des chaînes.
 *
 * Pure : ni base, ni HTTP, ni React.
 */

/** Ce que le schéma d'invitation attend en entrée. */
export type InviteTenantFormInput = {
  apartmentId: FormDataEntryValue | null;
  name: FormDataEntryValue | null;
  phone: FormDataEntryValue | null;
  email: FormDataEntryValue | null;
};

/**
 * Champs d'invitation tels que le formulaire les envoie.
 *
 * Aucune valeur n'est convertie ici, les schémas étant le point unique où une
 * saisie devient une donnée : convertir en deux endroits garantirait que les deux
 * divergent.
 *
 * Aucun champ de date d'entrée ni de loyer : ils appartiennent au bail, au Lot 8
 * (DEC-046). Aucun champ `channel` non plus : DEC-026 n'offre qu'un lien.
 */
export function inviteFields(formData: FormData): InviteTenantFormInput {
  return {
    apartmentId: formData.get('apartmentId'),
    name: formData.get('name'),
    phone: formData.get('phone'),
    email: formData.get('email'),
  };
}

/** Noms des champs du formulaire d'invitation, dans l'ordre de l'écran. */
export const INVITE_FIELD_NAMES = ['apartmentId', 'name', 'phone', 'email'] as const;

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

/** Le seul champ modifiable d'un locataire : son nom (DEC-048). */
export function renameFields(formData: FormData): { name: FormDataEntryValue | null } {
  return { name: formData.get('name') };
}
