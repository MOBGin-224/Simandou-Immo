'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';

import type { ManagerFormState } from '@/app/(app)/gestionnaires/actions';
import { InvitationLinkPanel } from '@/components/invitation/invitation-link-panel';
import { PropertyChecklist, type ChecklistGroup } from '@/components/manager/property-checklist';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { MANAGER_EMAIL_MAX_LENGTH, MANAGER_NAME_MAX_LENGTH } from '@/modules/managers/client';

/**
 * Invitation d'un gestionnaire (parcours 4, MVP-FEAT-019 et 020).
 *
 * Quatre saisies : nom, téléphone, email facultatif, immeubles. Le niveau d'accès
 * du parcours 4 (étape 4) est absent : il n'existe qu'un niveau au MVP (DEC-025).
 *
 * Le périmètre est une liste explicite (DEC-042), portée par `PropertyChecklist`.
 *
 * Après un succès, le formulaire est REMPLACÉ par le lien d'invitation : le lien
 * n'existe qu'à cet instant, une seule fois, et une redirection le perdrait.
 *
 * Le formulaire fonctionne sans JavaScript : les champs et les cases à cocher sont
 * natifs.
 */
export type InviteManagerFormProps = {
  action: (state: ManagerFormState, formData: FormData) => Promise<ManagerFormState>;
  groups: ChecklistGroup[];
};

const INITIAL_STATE: ManagerFormState = {};

export function InviteManagerForm({ action, groups }: InviteManagerFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(state.selectedPropertyIds ?? []),
  );

  if (state.issued) {
    return (
      <InvitationLinkPanel
        link={state.issued.link}
        expiresAt={state.issued.expiresAt}
        name={state.issued.name}
        phone={state.issued.phone}
        doneHref="/gestionnaires"
        doneLabel="Terminer"
      />
    );
  }

  const values = state.values ?? {};
  const errors = state.fieldErrors ?? {};
  const onlyOrganization = groups.length === 1 ? groups[0]?.organization : undefined;

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      {onlyOrganization ? (
        <input type="hidden" name="organizationId" value={onlyOrganization.id} />
      ) : (
        <Field id="organizationId" label="Organisation" required errors={errors.organizationId}>
          {(attributes) => (
            <select
              {...attributes}
              name="organizationId"
              required
              defaultValue={values.organizationId ?? ''}
              className="min-h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink focus:border-action focus:outline-none"
            >
              <option value="" disabled>
                Choisir une organisation
              </option>
              {groups.map((group) => (
                <option key={group.organization.id} value={group.organization.id}>
                  {group.organization.name}
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
            maxLength={MANAGER_NAME_MAX_LENGTH}
            defaultValue={values.name ?? ''}
          />
        )}
      </Field>

      <Field
        id="phone"
        label="Numéro de téléphone"
        required
        errors={errors.phone}
        hint="Au format international, par exemple +224620000000. La personne s'en servira pour se connecter."
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
            maxLength={MANAGER_EMAIL_MAX_LENGTH}
            defaultValue={values.email ?? ''}
          />
        )}
      </Field>

      <PropertyChecklist
        groups={groups}
        selected={selected}
        onChange={setSelected}
        errors={errors.propertyIds}
      />

      {/* Sur mobile, les actions sont empilées et pleine largeur (section 9). */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href="/gestionnaires" className={buttonClasses('secondary', 'md')}>
          Annuler
        </Link>
        <SubmitButton pendingLabel="Création...">Créer l&apos;invitation</SubmitButton>
      </div>
    </form>
  );
}
