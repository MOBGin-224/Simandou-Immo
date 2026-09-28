'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import type { ApartmentFormState } from '@/app/(app)/immeubles/[propertyId]/appartements/actions';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import {
  APARTMENT_FLOOR_MAX,
  APARTMENT_FLOOR_MIN,
  APARTMENT_NUMBER_MAX_LENGTH,
  APARTMENT_TYPE_MAX_LENGTH,
  type ApartmentView,
} from '@/modules/apartments/client';

/**
 * Formulaire d'appartement, en création comme en modification
 * (MVP-BACKLOG-022).
 *
 * Un seul composant pour les deux écrans : les champs, leurs libellés et leurs
 * bornes sont identiques, et les dédoubler garantirait qu'ils divergent au
 * premier ajout de champ.
 *
 * Composant client, et c'est justifié (MVP-ENG-014) : `useActionState` affiche
 * les messages de validation renvoyés par le serveur sans recharger la page. Le
 * formulaire reste soumettable sans JavaScript, React se contentant alors de la
 * soumission native.
 *
 * Les bornes viennent du module métier, jamais recopiées : `maxLength` et `min`
 * ne sont qu'un confort de saisie, la véritable borne étant vérifiée côté
 * serveur (MVP-ENG-028).
 *
 * La devise n'est PAS un champ. L'organisation porte la sienne et le cas d'usage
 * la remplit (DEC-014) : au MVP il n'y en a qu'une, et la demander à chaque
 * saisie serait une friction sans contenu. Elle est affichée en indication, pour
 * qu'aucun doute ne subsiste sur l'unité du montant saisi.
 */
export type ApartmentFormProps = {
  action: (state: ApartmentFormState, formData: FormData) => Promise<ApartmentFormState>;
  /** Valeurs existantes. Modification seulement. */
  apartment?: ApartmentView;
  /** Devise de l'organisation, affichée à titre indicatif. */
  currency: string;
  submitLabel: string;
  cancelHref: string;
};

const INITIAL_STATE: ApartmentFormState = {};

const STATUS_OPTIONS = [
  { value: 'VACANT', label: 'Vacant' },
  { value: 'OCCUPIED', label: 'Occupé' },
  { value: 'MAINTENANCE', label: 'En maintenance' },
] as const;

const SELECT_CLASSES =
  'min-h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink';

export function ApartmentForm({
  action,
  apartment,
  currency,
  submitLabel,
  cancelHref,
}: ApartmentFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  /** Valeur à afficher : la saisie refusée d'abord, la donnée existante ensuite. */
  const value = (field: string, fallback: string | number | null) =>
    state.values?.[field] ?? (fallback === null ? '' : String(fallback));

  /**
   * Surface préremplie avec la virgule décimale française.
   *
   * `String(78.5)` donne « 78.5 », un point que personne ne tape ici. La fiche
   * affiche « 78,5 m² » de son côté : sans cette conversion, le formulaire
   * contredirait l'écran d'où l'utilisateur vient. Les deux séparateurs restent
   * acceptés à la saisie.
   */
  const areaValue = () => {
    const submitted = state.values?.area;

    if (submitted !== undefined) return submitted;

    return apartment?.area === null || apartment?.area === undefined
      ? ''
      : String(apartment.area).replace('.', ',');
  };

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      <Field
        id="number"
        label="Référence"
        required
        hint="Par exemple : A01. Deux logements du même immeuble ne peuvent pas la partager."
        errors={state.fieldErrors?.number}
      >
        {(attributes) => (
          <Input
            {...attributes}
            name="number"
            defaultValue={value('number', apartment?.number ?? null)}
            maxLength={APARTMENT_NUMBER_MAX_LENGTH}
            required
            autoComplete="off"
          />
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="floor"
          label="Étage"
          hint="0 pour le rez-de-chaussée, un nombre négatif pour un sous-sol."
          errors={state.fieldErrors?.floor}
        >
          {(attributes) => (
            <Input
              {...attributes}
              name="floor"
              type="number"
              inputMode="numeric"
              min={APARTMENT_FLOOR_MIN}
              max={APARTMENT_FLOOR_MAX}
              step={1}
              defaultValue={value('floor', apartment?.floor ?? null)}
            />
          )}
        </Field>

        <Field
          id="type"
          label="Type"
          hint="Par exemple : T3, studio, duplex."
          errors={state.fieldErrors?.type}
        >
          {(attributes) => (
            <Input
              {...attributes}
              name="type"
              defaultValue={value('type', apartment?.type ?? null)}
              maxLength={APARTMENT_TYPE_MAX_LENGTH}
              autoComplete="off"
            />
          )}
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="area" label="Surface en m²" errors={state.fieldErrors?.area}>
          {(attributes) => (
            <Input
              {...attributes}
              name="area"
              inputMode="decimal"
              defaultValue={areaValue()}
              autoComplete="off"
            />
          )}
        </Field>

        <Field id="status" label="Statut" required errors={state.fieldErrors?.status}>
          {(attributes) => (
            <select
              {...attributes}
              name="status"
              defaultValue={value('status', apartment?.status ?? 'VACANT')}
              className={SELECT_CLASSES}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <Field
        id="referenceRentAmount"
        label={`Loyer de référence en ${currency}`}
        hint="Montant indicatif, qui servira à préremplir un futur contrat. Laissez vide s'il n'est pas fixé."
        errors={state.fieldErrors?.referenceRent}
      >
        {(attributes) => (
          <Input
            {...attributes}
            name="referenceRentAmount"
            inputMode="numeric"
            defaultValue={value('referenceRentAmount', apartment?.referenceRent?.amount ?? null)}
            autoComplete="off"
          />
        )}
      </Field>

      {/* Sur mobile, les actions sont empilées et pleine largeur (section 9). */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className={buttonClasses('secondary', 'md')}>
          Annuler
        </Link>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
