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
   * État de la case « en travaux », après un refus comme au premier affichage.
   *
   * Le champ caché fait que la valeur renvoyée vaut « on » quand la case était
   * cochée, et « false » sinon : comparer à « on » est donc suffisant, et laisse
   * la case telle que l'utilisateur l'avait laissée.
   */
  const maintenanceChecked = () =>
    state.values?.underMaintenance === undefined
      ? (apartment?.underMaintenance ?? false)
      : state.values.underMaintenance === 'on';

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
      </div>

      {/*
        Les travaux se DÉCLARENT ; l'occupation, non (DEC-050).

        Le choix « Vacant, Occupé, En maintenance » a disparu de ce formulaire :
        l'occupation se déduit du bail, et la laisser saisissable permettait
        d'annoncer un logement vacant alors qu'un bail y courait. Pour libérer un
        logement, on clôture son bail.

        Le champ caché qui précède la case est nécessaire : un formulaire HTML ne
        transmet pas une case décochée. Sans lui, décocher « en travaux » ne
        changerait rien, et le logement resterait en chantier pour toujours.
      */}
      <input type="hidden" name="underMaintenance" value="false" />

      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 has-[:checked]:border-action">
        <input
          type="checkbox"
          name="underMaintenance"
          value="on"
          defaultChecked={maintenanceChecked()}
          className="size-5 shrink-0 accent-action"
        />
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-medium text-ink">Logement en travaux</span>
          <span className="text-xs text-muted">
            Indépendant de l&apos;occupation : un logement peut être en travaux qu&apos;il soit loué
            ou vide.
          </span>
        </span>
      </label>

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
