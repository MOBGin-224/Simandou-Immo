'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import type { TenantFormState } from '@/app/(app)/locataires/actions';
import { InvitationLinkPanel } from '@/components/invitation/invitation-link-panel';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { TENANT_EMAIL_MAX_LENGTH, TENANT_NAME_MAX_LENGTH } from '@/modules/tenants/client';

/**
 * Invitation d'un locataire (parcours 7, DEC-046).
 *
 * Quatre saisies : le logement, le nom, le téléphone, l'email facultatif. Et
 * rien d'autre. **Ni date d'entrée, ni montant de loyer** : ils appartiennent au
 * bail, au Lot 8, et les demander ici obligerait à créer un embryon de bail sans
 * en avoir les règles.
 *
 * Le logement est préchoisi quand le parcours part de lui, ce qui est le cas
 * normal : on sélectionne un logement, puis on y invite une personne. Il reste
 * une liste déroulante lorsque l'écran est atteint directement, pour que la page
 * fonctionne quel que soit le chemin.
 *
 * Après un succès, le formulaire est REMPLACÉ par le lien d'invitation : le lien
 * n'existe qu'à cet instant, une seule fois, et une redirection le perdrait.
 *
 * Le formulaire fonctionne sans JavaScript : tous les champs sont natifs.
 */
export type ApartmentChoice = {
  id: string;
  /** Libellé complet, « A01, Résidence Camayenne ». */
  label: string;
};

export type InviteTenantFormProps = {
  action: (state: TenantFormState, formData: FormData) => Promise<TenantFormState>;
  apartments: ApartmentChoice[];
  /** Logement imposé par le parcours, le cas échéant : il n'est alors pas modifiable. */
  fixedApartmentId?: string;
  cancelHref: string;
};

const INITIAL_STATE: TenantFormState = {};

export function InviteTenantForm({
  action,
  apartments,
  fixedApartmentId,
  cancelHref,
}: InviteTenantFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  if (state.issued) {
    return (
      <InvitationLinkPanel
        link={state.issued.link}
        expiresAt={state.issued.expiresAt}
        name={state.issued.name}
        phone={state.issued.phone}
        doneHref="/locataires"
        doneLabel="Terminer"
      />
    );
  }

  const values = state.values ?? {};
  const errors = state.fieldErrors ?? {};
  const fixed = fixedApartmentId ?? (apartments.length === 1 ? apartments[0]?.id : undefined);
  const fixedLabel = fixed ? apartments.find((entry) => entry.id === fixed)?.label : undefined;

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      {fixed ? (
        <>
          <input type="hidden" name="apartmentId" value={fixed} />

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Logement</span>
            <span className="break-words text-base text-ink">{fixedLabel ?? fixed}</span>
          </div>
        </>
      ) : (
        <Field id="apartmentId" label="Logement" required errors={errors.apartmentId}>
          {(attributes) => (
            <select
              {...attributes}
              name="apartmentId"
              required
              defaultValue={values.apartmentId ?? ''}
              className="min-h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink focus:border-action focus:outline-none"
            >
              <option value="" disabled>
                Choisir un logement
              </option>
              {apartments.map((apartment) => (
                <option key={apartment.id} value={apartment.id}>
                  {apartment.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}

      <Field id="name" label="Nom" required errors={errors.name}>
        {(attributes) => (
          <Input
            {...attributes}
            name="name"
            autoComplete="off"
            required
            maxLength={TENANT_NAME_MAX_LENGTH}
            defaultValue={values.name ?? ''}
          />
        )}
      </Field>

      <Field
        id="phone"
        label="Numéro de téléphone"
        required
        errors={errors.phone}
        hint="Au format international, par exemple +224620000000. La personne s'en servira pour se connecter, et ce numéro ne sera plus modifiable."
      >
        {(attributes) => (
          <Input
            {...attributes}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            required
            defaultValue={values.phone ?? ''}
          />
        )}
      </Field>

      <Field id="email" label="Adresse email" errors={errors.email}>
        {(attributes) => (
          <Input
            {...attributes}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="off"
            maxLength={TENANT_EMAIL_MAX_LENGTH}
            defaultValue={values.email ?? ''}
          />
        )}
      </Field>

      {/* Sur mobile, les actions sont empilées et pleine largeur (section 9). */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className={buttonClasses('secondary', 'md')}>
          Annuler
        </Link>
        <SubmitButton pendingLabel="Création...">Créer l&apos;invitation</SubmitButton>
      </div>
    </form>
  );
}
