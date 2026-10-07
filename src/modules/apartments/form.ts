/**
 * Traduction d'un formulaire d'appartement vers l'entrée du cas d'usage.
 *
 * Ce module existe pour une raison précise. Un fichier de Server Actions porte
 * la directive `'use server'` et ne peut donc exporter que des fonctions
 * asynchrones : la conversion qui y vivait était intestable autrement qu'en
 * pilotant un navigateur. Or c'est exactement l'endroit où se logent les
 * défauts de saisie, un formulaire HTML ne transmettant que des chaînes.
 *
 * Elle est pure : ni base, ni HTTP, ni React. La valider ne demande qu'un
 * `FormData` construit à la main.
 */

/** Ce que les schémas de création et de modification attendent en entrée. */
export type ApartmentFormInput = {
  number: FormDataEntryValue | null;
  floor: FormDataEntryValue | null;
  type: FormDataEntryValue | null;
  area: FormDataEntryValue | null;
  underMaintenance: FormDataEntryValue | null;
  referenceRent: { amount: FormDataEntryValue | null; currency: null };
};

/**
 * Champs d'appartement tels que le formulaire les envoie.
 *
 * Le loyer est recomposé en couple montant et devise (DEC-014). La devise n'est
 * pas saisie : l'organisation porte la sienne et le cas d'usage la remplit. Au
 * MVP il n'y en a qu'une, et la demander à chaque saisie serait une friction
 * sans contenu.
 *
 * Aucune valeur n'est convertie ici. Les chaînes partent telles quelles vers les
 * schémas, qui sont le point unique où une saisie devient une donnée : convertir
 * en deux endroits garantirait que les deux divergent.
 *
 * `underMaintenance` est lu par `getAll` et non par `get`, et c'est la seule
 * exception. Le formulaire envoie DEUX champs du même nom, un champ caché valant
 * « false » puis la case à cocher : c'est ainsi qu'une case décochée se transmet,
 * un formulaire HTML n'envoyant rien pour elle. `get` rendrait toujours le
 * premier, donc toujours « false », et la case ne cocherait jamais rien.
 */
export function apartmentFields(formData: FormData): ApartmentFormInput {
  return {
    number: formData.get('number'),
    floor: formData.get('floor'),
    type: formData.get('type'),
    area: formData.get('area'),
    underMaintenance: formData.getAll('underMaintenance').at(-1) ?? null,
    referenceRent: { amount: formData.get('referenceRentAmount'), currency: null },
  };
}

/** Noms des champs du formulaire d'appartement, dans l'ordre de l'écran. */
export const APARTMENT_FIELD_NAMES = [
  'number',
  'floor',
  'type',
  'area',
  'underMaintenance',
  'referenceRentAmount',
] as const;

/**
 * Saisie à réafficher en cas de refus, ramenée à des chaînes.
 *
 * Sans elle, un refus réafficherait le formulaire avec les valeurs d'origine :
 * l'utilisateur perdrait sa saisie au moment précis où il doit la corriger.
 */
export function submittedValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};

  for (const field of APARTMENT_FIELD_NAMES) {
    // Même raison que ci-dessus : la case à cocher est le DERNIER champ de son
    // nom, et c'est lui qui porte la saisie à réafficher.
    const value =
      field === 'underMaintenance' ? (formData.getAll(field).at(-1) ?? null) : formData.get(field);

    if (typeof value === 'string') values[field] = value;
  }

  return values;
}

/** Description d'une série, telle que le formulaire de création rapide l'envoie. */
export function generationFields(formData: FormData) {
  return {
    prefix: formData.get('prefix'),
    start: formData.get('start'),
    count: formData.get('count'),
  };
}

/** Saisie de la création rapide, à réafficher en cas de refus. */
export function submittedGenerationValues(formData: FormData): Record<string, string> {
  return {
    prefix: String(formData.get('prefix') ?? ''),
    start: String(formData.get('start') ?? ''),
    count: String(formData.get('count') ?? ''),
  };
}
