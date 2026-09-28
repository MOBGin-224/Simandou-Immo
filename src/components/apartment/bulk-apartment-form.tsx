'use client';

import { useActionState, useState } from 'react';

import type { ApartmentFormState } from '@/app/(app)/immeubles/[propertyId]/appartements/actions';
import { Alert } from '@/components/ui/alert';
import { Field, Input } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import {
  APARTMENT_BULK_MAX,
  APARTMENT_NUMBER_MAX_LENGTH,
  generateNumbers,
} from '@/modules/apartments/client';

/**
 * Création rapide d'une suite d'appartements (parcours 3).
 *
 * Le parcours l'exige explicitement : pour un immeuble de vingt logements, le
 * produit ne doit pas imposer vingt formulaires. Trois valeurs remplacent donc
 * vingt saisies, et l'utilisateur complète les détails ensuite, logement par
 * logement.
 *
 * L'APERÇU est ce qui rend l'outil utilisable. Sans lui, l'utilisateur découvre
 * ce qu'il a créé après coup, sur vingt lignes qu'il faudrait corriger une à
 * une. Il est calculé par la MÊME fonction que le serveur, importée du module :
 * une seconde implémentation côté client finirait par diverger, et l'aperçu
 * mentirait.
 *
 * Sans JavaScript, l'aperçu n'apparaît pas et le formulaire reste soumettable :
 * c'est un confort, pas une condition.
 */
export type BulkApartmentFormProps = {
  action: (state: ApartmentFormState, formData: FormData) => Promise<ApartmentFormState>;
};

const INITIAL_STATE: ApartmentFormState = {};

/** Au-delà, l'aperçu s'abrège : lire cent références ne renseigne pas plus. */
const PREVIEW_LIMIT = 8;

export function BulkApartmentForm({ action }: BulkApartmentFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  const [prefix, setPrefix] = useState(state.values?.prefix ?? 'A');
  const [start, setStart] = useState(state.values?.start ?? '1');
  const [count, setCount] = useState(state.values?.count ?? '');

  const parsedStart = Number(start);
  const parsedCount = Number(count);
  const previewable =
    Number.isInteger(parsedStart) &&
    parsedStart >= 0 &&
    Number.isInteger(parsedCount) &&
    parsedCount >= 1 &&
    parsedCount <= APARTMENT_BULK_MAX;

  const numbers = previewable ? generateNumbers(prefix.trim(), parsedStart, parsedCount) : [];
  const preview = numbers.slice(0, PREVIEW_LIMIT);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      <div className="grid gap-5 sm:grid-cols-3">
        <Field
          id="prefix"
          label="Préfixe"
          hint="Laissez vide pour une numérotation sans lettre."
          errors={state.fieldErrors?.prefix}
        >
          {(attributes) => (
            <Input
              {...attributes}
              name="prefix"
              value={prefix}
              onChange={(event) => setPrefix(event.target.value)}
              maxLength={APARTMENT_NUMBER_MAX_LENGTH}
              autoComplete="off"
            />
          )}
        </Field>

        <Field id="start" label="Premier numéro" required errors={state.fieldErrors?.start}>
          {(attributes) => (
            <Input
              {...attributes}
              name="start"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={start}
              onChange={(event) => setStart(event.target.value)}
              required
            />
          )}
        </Field>

        <Field id="count" label="Nombre de logements" required errors={state.fieldErrors?.count}>
          {(attributes) => (
            <Input
              {...attributes}
              name="count"
              type="number"
              inputMode="numeric"
              min={1}
              max={APARTMENT_BULK_MAX}
              step={1}
              value={count}
              onChange={(event) => setCount(event.target.value)}
              required
            />
          )}
        </Field>
      </div>

      {preview.length > 0 ? (
        <div className="rounded-md border border-line bg-canvas p-3">
          <p className="text-xs uppercase tracking-wide text-muted">Références qui seront créées</p>
          <p className="mt-1.5 text-sm text-ink">
            {preview.join(', ')}
            {numbers.length > preview.length
              ? `, … jusqu'à ${numbers[numbers.length - 1]} (${numbers.length} logements)`
              : ''}
          </p>
        </div>
      ) : null}

      {/* Sur mobile, les actions sont empilées et pleine largeur (section 9). */}
      <div className="flex flex-col sm:flex-row sm:justify-end">
        <SubmitButton>Créer les logements</SubmitButton>
      </div>
    </form>
  );
}
