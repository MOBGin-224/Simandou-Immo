/**
 * Traduction des formulaires du module Charges vers les entrées des cas d'usage.
 *
 * Même raison d'être qu'ailleurs : un fichier de Server Actions porte
 * `'use server'` et ne peut exporter que des fonctions asynchrones, donc la
 * conversion qui y vivrait serait intestable autrement qu'en pilotant un
 * navigateur. Or c'est là que se logent les défauts de saisie, un formulaire HTML
 * ne transmettant que des chaînes.
 *
 * Pure : ni base, ni HTTP, ni React.
 */

/** Champs du formulaire de création, dans l'ordre de l'écran. */
export const CHARGE_FIELD_NAMES = [
  'propertyId',
  'type',
  'periodStart',
  'dueDate',
  'totalAmount',
  'supplierName',
] as const;

/** Entrée d'un formulaire, telle que le navigateur l'envoie. */
type Entries = Record<string, FormDataEntryValue | null>;

/**
 * Champs de création tels que le formulaire les envoie.
 *
 * Aucune valeur n'est convertie ici, le schéma étant le point unique où une
 * saisie devient une donnée : convertir en deux endroits garantirait que les
 * deux divergent. En particulier le montant reste une chaîne, `Number('')`
 * valant zéro, et c'est le schéma qui sait qu'un montant vide est un montant
 * manquant et non une facture de zéro franc.
 *
 * La méthode de répartition n'est PAS un champ : `EQUAL` est la seule du MVP
 * (DEC-029), et offrir une liste d'une valeur ferait croire à un choix. Le
 * schéma la met par défaut, et le jour où `CUSTOM` entrera dans le périmètre, le
 * champ apparaîtra ici.
 */
export function chargeFields(formData: FormData): Entries {
  const values: Entries = {};

  for (const name of CHARGE_FIELD_NAMES) values[name] = formData.get(name);

  return values;
}

/**
 * Saisie à réafficher en cas de refus, ramenée à des chaînes.
 *
 * Sans elle, un refus réafficherait un formulaire vide : la personne perdrait sa
 * saisie au moment précis où elle doit la corriger, et une facture se ressaisit
 * en six champs.
 */
export function submittedValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};

  for (const name of CHARGE_FIELD_NAMES) {
    const value = formData.get(name);

    if (typeof value === 'string') values[name] = value;
  }

  return values;
}
