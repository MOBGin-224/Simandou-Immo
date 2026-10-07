'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import type { LeaseFormState } from '@/app/(app)/baux/actions';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { LEASE_TERMINATION_REASON_MAX_LENGTH } from '@/modules/leases/client';

/**
 * Clôture d'un bail (API section 17, Component Specification section 45).
 *
 * Une confirmation qui DEMANDE une donnée, et non un simple oui ou non : la date
 * de clôture devient la date de fin du bail, et c'est elle qui empêchera la
 * génération d'échéances au-delà. Un bouton seul obligerait à supposer « à partir
 * d'aujourd'hui », ce qui est faux dès qu'un locataire annonce son départ.
 *
 * La raison est libre et facultative (BR-033). Le champ ne propose pas de liste :
 * la documentation n'en donne qu'un exemple, et inventer les autres serait
 * décider d'un vocabulaire métier.
 */
export type TerminateLeaseFormProps = {
  action: (state: LeaseFormState, formData: FormData) => Promise<LeaseFormState>;
  cancelHref: string;
  /** Date du jour, en `YYYY-MM-DD` : le cas le plus courant. */
  defaultDate: string;
  /** Début du bail : la clôture ne peut pas le précéder. */
  startDate: string;
};

const INITIAL_STATE: LeaseFormState = {};

export function TerminateLeaseForm({
  action,
  cancelHref,
  defaultDate,
  startDate,
}: TerminateLeaseFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  const values = state.values ?? {};
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      <Field
        id="terminationDate"
        label="Date de clôture"
        required
        errors={errors.terminationDate}
        hint="Elle devient la date de fin du bail. Aucun loyer ne sera dû au-delà."
      >
        {(attributes) => (
          <Input
            {...attributes}
            name="terminationDate"
            type="date"
            required
            min={startDate}
            defaultValue={values.terminationDate ?? defaultDate}
          />
        )}
      </Field>

      <Field
        id="reason"
        label="Raison"
        errors={errors.reason}
        hint="Facultative. Elle reste dans l'historique du bail."
      >
        {(attributes) => (
          <Input
            {...attributes}
            name="reason"
            autoComplete="off"
            maxLength={LEASE_TERMINATION_REASON_MAX_LENGTH}
            defaultValue={values.reason ?? ''}
          />
        )}
      </Field>

      {/* Sur mobile, les actions sont empilées et pleine largeur (section 9). */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className={buttonClasses('secondary', 'md')}>
          Annuler
        </Link>
        <SubmitButton variant="destructive" pendingLabel="Clôture...">
          Clôturer le bail
        </SubmitButton>
      </div>
    </form>
  );
}
