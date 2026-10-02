'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';

import type { ManagerFormState } from '@/app/(app)/gestionnaires/actions';
import { InvitationLinkPanel } from '@/components/manager/invitation-link-panel';
import { Alert } from '@/components/ui/alert';
import { Button, buttonClasses } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { MANAGER_EMAIL_MAX_LENGTH, MANAGER_NAME_MAX_LENGTH } from '@/modules/managers/client';

/**
 * Invitation d'un gestionnaire (parcours 4, MVP-FEAT-019 et 020).
 *
 * Quatre saisies : nom, téléphone, email facultatif, immeubles. Le niveau d'accès
 * du parcours 4 (étape 4) est absent : il n'existe qu'un niveau au MVP (DEC-025).
 *
 * Le périmètre est une liste explicite (DEC-042). « Tout sélectionner » coche tous
 * les immeubles qui existent MAINTENANT ; ceux créés plus tard ne s'ajoutent
 * jamais d'eux-mêmes au périmètre.
 *
 * Après un succès, le formulaire est REMPLACÉ par le lien d'invitation : le lien
 * n'existe qu'à cet instant, une seule fois, et une redirection le perdrait.
 *
 * Le formulaire fonctionne sans JavaScript : les cases à cocher sont natives, et
 * seule l'action « Tout sélectionner » en dépend, comme une amélioration.
 */
export type InvitablePropertyGroup = {
  organization: { id: string; name: string };
  properties: { id: string; name: string; location: string | null }[];
};

export type InviteManagerFormProps = {
  action: (state: ManagerFormState, formData: FormData) => Promise<ManagerFormState>;
  groups: InvitablePropertyGroup[];
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
  const allIds = groups.flatMap((group) => group.properties.map((property) => property.id));
  const everythingSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const onlyOrganization = groups.length === 1 ? groups[0]?.organization : undefined;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  }

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

      <fieldset
        className="flex flex-col gap-3"
        aria-describedby={errors.propertyIds ? 'propertyIds-error' : 'propertyIds-hint'}
      >
        <legend className="text-sm font-medium text-ink">
          Immeubles confiés
          <span className="text-danger" aria-hidden="true">
            {' *'}
          </span>
        </legend>

        <p id="propertyIds-hint" className="text-xs text-muted">
          La personne ne verra que les immeubles cochés. Un immeuble créé plus tard ne lui sera
          jamais ajouté automatiquement.
        </p>

        {errors.propertyIds ? (
          <p id="propertyIds-error" className="text-sm text-danger">
            {errors.propertyIds.join(' ')}
          </p>
        ) : null}

        {allIds.length > 1 ? (
          <Button
            type="button"
            variant="tertiary"
            // Le remplissage du bouton (16 px) décalerait son texte par rapport au
            // reste du formulaire : on le compense, la cible tactile restant entière.
            className="-ml-4 self-start"
            onClick={() => setSelected(everythingSelected ? new Set() : new Set(allIds))}
          >
            {everythingSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
          </Button>
        ) : null}

        {groups.map((group) => (
          <div key={group.organization.id} className="flex flex-col gap-2">
            {groups.length > 1 ? (
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {group.organization.name}
              </p>
            ) : null}

            <ul className="flex flex-col gap-2">
              {group.properties.map((property) => (
                <li key={property.id}>
                  {/*
                    Le libellé entier est la cible tactile : toucher le nom d'un
                    immeuble coche sa case. Les cases natives font 20 pixels, trop
                    peu pour un doigt, d'où une ligne de 48 pixels de haut.
                  */}
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 has-[:checked]:border-action">
                    <input
                      type="checkbox"
                      name="propertyIds"
                      value={property.id}
                      checked={selected.has(property.id)}
                      onChange={() => toggle(property.id)}
                      className="size-5 shrink-0 accent-action"
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm font-medium text-ink">{property.name}</span>
                      {property.location ? (
                        <span className="text-xs text-muted">{property.location}</span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </fieldset>

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
