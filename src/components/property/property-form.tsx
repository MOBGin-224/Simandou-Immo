'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import type { PropertyFormState } from '@/app/(app)/immeubles/actions';
import { Alert } from '@/components/ui/alert';
import { Field, Input, Textarea } from '@/components/ui/field';
import { buttonClasses } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import {
  PROPERTY_ADDRESS_MAX_LENGTH,
  PROPERTY_CITY_MAX_LENGTH,
  PROPERTY_DESCRIPTION_MAX_LENGTH,
  PROPERTY_DISTRICT_MAX_LENGTH,
  PROPERTY_NAME_MAX_LENGTH,
  type PropertyView,
} from '@/modules/properties/client';
import type { OrganizationOption } from '@/modules/organizations';

/**
 * Formulaire d'immeuble, en création comme en modification (MVP-BACKLOG-018).
 *
 * Un seul composant pour les deux écrans : les champs, leurs libellés et leurs
 * bornes sont identiques, et les dédoubler garantirait qu'ils divergent au premier
 * ajout de champ.
 *
 * Composant client, et c'est justifié (MVP-ENG-014) : `useActionState` affiche les
 * messages de validation renvoyés par le serveur sans recharger la page. Le
 * formulaire reste soumettable sans JavaScript, React se contentant alors de la
 * soumission native.
 *
 * Les longueurs maximales viennent du module métier, jamais recopiées : `maxLength`
 * n'est qu'un confort de saisie, la véritable borne étant vérifiée côté serveur
 * (MVP-ENG-028).
 */
export type PropertyFormProps = {
  action: (state: PropertyFormState, formData: FormData) => Promise<PropertyFormState>;
  /** Organisations recevables. Création seulement. */
  organizations?: readonly OrganizationOption[];
  /** Valeurs existantes. Modification seulement. */
  property?: PropertyView;
  submitLabel: string;
  cancelHref: string;
};

const INITIAL_STATE: PropertyFormState = {};

export function PropertyForm({
  action,
  organizations,
  property,
  submitLabel,
  cancelHref,
}: PropertyFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  /** Valeur à afficher : la saisie refusée d'abord, la donnée existante ensuite. */
  const value = (field: keyof PropertyView & string, fallback: string | null) =>
    state.values?.[field] ?? fallback ?? '';

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate={false}>
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      {organizations && organizations.length > 1 ? (
        <Field
          id="organizationId"
          label="Organisation"
          required
          errors={state.fieldErrors?.organizationId}
        >
          {(attributes) => (
            <select
              {...attributes}
              name="organizationId"
              defaultValue={state.values?.organizationId ?? ''}
              required
              className="min-h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink"
            >
              <option value="">Choisir une organisation</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      ) : null}

      {organizations && organizations.length === 1 && organizations[0] ? (
        <input type="hidden" name="organizationId" value={organizations[0].id} />
      ) : null}

      <Field
        id="name"
        label="Nom de l'immeuble"
        required
        hint="Par exemple : Résidence Camayenne. Deux immeubles ne peuvent pas porter le même nom."
        errors={state.fieldErrors?.name}
      >
        {(attributes) => (
          <Input
            {...attributes}
            name="name"
            defaultValue={value('name', property?.name ?? null)}
            maxLength={PROPERTY_NAME_MAX_LENGTH}
            required
            autoComplete="off"
          />
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="district" label="Quartier" errors={state.fieldErrors?.district}>
          {(attributes) => (
            <Input
              {...attributes}
              name="district"
              defaultValue={value('district', property?.district ?? null)}
              maxLength={PROPERTY_DISTRICT_MAX_LENGTH}
              autoComplete="off"
            />
          )}
        </Field>

        <Field id="city" label="Ville" errors={state.fieldErrors?.city}>
          {(attributes) => (
            <Input
              {...attributes}
              name="city"
              defaultValue={value('city', property?.city ?? null)}
              maxLength={PROPERTY_CITY_MAX_LENGTH}
              autoComplete="off"
            />
          )}
        </Field>
      </div>

      <Field id="address" label="Adresse" errors={state.fieldErrors?.address}>
        {(attributes) => (
          <Textarea
            {...attributes}
            name="address"
            defaultValue={value('address', property?.address ?? null)}
            maxLength={PROPERTY_ADDRESS_MAX_LENGTH}
            rows={2}
          />
        )}
      </Field>

      <Field
        id="description"
        label="Description"
        hint="Ce qui aide à reconnaître l'immeuble : nombre d'étages, repère, particularité."
        errors={state.fieldErrors?.description}
      >
        {(attributes) => (
          <Textarea
            {...attributes}
            name="description"
            defaultValue={value('description', property?.description ?? null)}
            maxLength={PROPERTY_DESCRIPTION_MAX_LENGTH}
            rows={4}
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
