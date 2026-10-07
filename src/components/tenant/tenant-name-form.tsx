'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import type { TenantFormState } from '@/app/(app)/locataires/actions';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { TENANT_NAME_MAX_LENGTH } from '@/modules/tenants/client';

/**
 * Modification du nom par le locataire lui-même (DEC-048).
 *
 * UN seul champ, et c'est le fond de la décision : le téléphone et l'email ne
 * sont modifiables par personne au MVP, faute du mécanisme de vérification
 * qu'exigent SEC-049 et SEC-050. Les afficher en lecture seule, comme le fait
 * l'écran qui porte ce formulaire, vaut mieux que les omettre : le locataire voit
 * ce que le produit sait de lui, et comprend ce qui est figé.
 *
 * Le formulaire fonctionne sans JavaScript : le champ est natif.
 */
export type TenantNameFormProps = {
  action: (state: TenantFormState, formData: FormData) => Promise<TenantFormState>;
  currentName: string;
  cancelHref: string;
};

const INITIAL_STATE: TenantFormState = {};

export function TenantNameForm({ action, currentName, cancelHref }: TenantNameFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  const values = state.values ?? {};
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      <Field id="name" label="Votre nom" required errors={errors.name}>
        {(attributes) => (
          <Input
            {...attributes}
            name="name"
            autoComplete="name"
            required
            maxLength={TENANT_NAME_MAX_LENGTH}
            defaultValue={values.name ?? currentName}
          />
        )}
      </Field>

      {/* Sur mobile, les actions sont empilées et pleine largeur (section 9). */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className={buttonClasses('secondary', 'md')}>
          Annuler
        </Link>
        <SubmitButton pendingLabel="Enregistrement...">Enregistrer</SubmitButton>
      </div>
    </form>
  );
}
