/**
 * Traduction des formulaires du module Contrats vers les entrées des cas d'usage.
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
export const CREATE_FIELD_NAMES = [
  'apartmentId',
  'tenantMode',
  'tenantId',
  'tenantName',
  'tenantPhone',
  'tenantEmail',
  'startDate',
  'endDate',
  'rentAmount',
  'currency',
  'dueDay',
  'depositAmount',
] as const;

/** Champs du formulaire de modification : ni logement ni locataire. */
export const UPDATE_FIELD_NAMES = [
  'startDate',
  'endDate',
  'rentAmount',
  'currency',
  'dueDay',
  'depositAmount',
] as const;

/** Champs du formulaire de clôture. */
export const TERMINATE_FIELD_NAMES = ['terminationDate', 'reason'] as const;

/** Entrée d'un formulaire, telle que le navigateur l'envoie. */
type Entries = Record<string, FormDataEntryValue | null>;

function fieldsOf(formData: FormData, names: readonly string[]): Entries {
  const values: Entries = {};

  for (const name of names) values[name] = formData.get(name);

  return values;
}

/**
 * Champs de création tels que le formulaire les envoie.
 *
 * Aucune valeur n'est convertie ici, les schémas étant le point unique où une
 * saisie devient une donnée : convertir en deux endroits garantirait que les deux
 * divergent. En particulier, les montants restent des chaînes : `Number('')` vaut
 * zéro, et c'est le schéma qui sait qu'une caution vide vaut zéro par décision et
 * non par accident.
 */
export function createFields(formData: FormData): Record<string, unknown> {
  const values = fieldsOf(formData, CREATE_FIELD_NAMES);

  /*
   * L'écran offre DEUX façons de désigner le locataire, et le bouton radio dit
   * laquelle (DEC-051, Lot 8b). Le formulaire envoie les champs des deux panneaux,
   * parce qu'ils restent dans la page : c'est ici qu'on ne retient que celui qui
   * compte.
   *
   * Transmettre les deux ferait refuser la requête, et c'est voulu côté schéma :
   * départager silencieusement créerait une personne que l'appelant n'a pas
   * voulue. Mais ce choix appartient à l'écran, pas à l'utilisateur, donc c'est
   * ici qu'il se tranche.
   */
  const { tenantMode, tenantId, tenantName, tenantPhone, tenantEmail, ...rest } = values;

  if (tenantMode === 'new') {
    return { ...rest, tenant: { name: tenantName, phone: tenantPhone, email: tenantEmail } };
  }

  /*
   * Un identifiant ABSENT, et non vide : sans cela le schéma répondrait
   * « identifiant invalide », là où la vraie situation est « aucun locataire
   * choisi ». Le message doit dire ce qui manque.
   */
  if (tenantId === null || tenantId === '') return rest;

  return { ...rest, tenantId };
}

/**
 * Champs de modification, dont les ABSENTS sont retirés.
 *
 * C'est la différence qui compte : un champ absent signifie « ne pas y toucher »,
 * un champ vide signifie « effacer ». Les laisser à `null` les ferait tous
 * effacer à chaque soumission partielle.
 */
export function updateFields(formData: FormData): Entries {
  const values: Entries = {};

  for (const name of UPDATE_FIELD_NAMES) {
    if (formData.has(name)) values[name] = formData.get(name);
  }

  return values;
}

export function terminateFields(formData: FormData): Entries {
  return fieldsOf(formData, TERMINATE_FIELD_NAMES);
}

/**
 * Saisie à réafficher en cas de refus, ramenée à des chaînes.
 *
 * Sans elle, un refus réafficherait un formulaire vide : l'utilisateur perdrait
 * sa saisie au moment précis où il doit la corriger.
 */
export function submittedValues(
  formData: FormData,
  names: readonly string[],
): Record<string, string> {
  const values: Record<string, string> = {};

  for (const name of names) {
    const value = formData.get(name);

    if (typeof value === 'string') values[name] = value;
  }

  return values;
}
