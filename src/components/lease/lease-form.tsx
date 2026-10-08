'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import type { LeaseFormState } from '@/app/(app)/baux/actions';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Overline } from '@/components/ui/overline';
import { SubmitButton } from '@/components/ui/submit-button';
import { LEASE_DUE_DAY_MAX, LEASE_DUE_DAY_MIN } from '@/modules/leases/client';

/**
 * Création et modification d'un bail (parcours 11, MVP-BACKLOG-035).
 *
 * UN seul composant pour les deux, parce que les champs sont les mêmes : écrire
 * deux formulaires garantirait qu'une règle finisse par ne valoir que d'un côté.
 * Ce qui diffère est porté par des props : à la MODIFICATION, le logement et le
 * locataire ne sont plus des champs mais des faits affichés, car ils définissent
 * la relation locative et en changer un ferait un autre bail.
 *
 * Les montants sont saisis dans la plus petite unité de la devise (DEC-014) :
 * pour le franc guinéen, dont l'exposant de sous-unité est zéro, c'est le franc
 * lui-même. L'indication est donnée sous le champ plutôt que supposée connue.
 *
 * Le formulaire fonctionne sans JavaScript : tous les champs sont natifs, et les
 * dates utilisent `type="date"`, qui dégrade en champ texte là où il n'est pas
 * pris en charge.
 */
export type ApartmentChoice = {
  id: string;
  /** Libellé complet, « A01, Résidence Camayenne ». */
  label: string;
  /** Loyer de référence du logement, pour préremplir le montant. */
  referenceRent: { amount: number; currency: string } | null;
};

export type TenantChoice = {
  /** `users.id`, l'identité métier de la personne (DEC-051). */
  id: string;
  label: string;
};

export type LeaseFormProps = {
  action: (state: LeaseFormState, formData: FormData) => Promise<LeaseFormState>;
  cancelHref: string;
  submitLabel: string;
  pendingLabel: string;
  /** Devise par défaut de l'organisation (DEC-014). */
  defaultCurrency: string;
  /** Création : les choix possibles. Modification : `undefined`. */
  apartments?: ApartmentChoice[];
  tenants?: TenantChoice[];
  /** Logement imposé par le parcours, le cas échéant. */
  fixedApartmentId?: string;
  /** Modification : ce que le bail porte déjà, affiché et non ressaisi. */
  existing?: {
    apartmentLabel: string;
    tenantLabel: string;
    startDate: string;
    endDate: string | null;
    rentAmount: number;
    dueDay: number;
    depositAmount: number;
  };
};

const INITIAL_STATE: LeaseFormState = {};

export function LeaseForm({
  action,
  cancelHref,
  submitLabel,
  pendingLabel,
  defaultCurrency,
  apartments,
  tenants,
  fixedApartmentId,
  existing,
}: LeaseFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  const values = state.values ?? {};
  const errors = state.fieldErrors ?? {};
  const isCreation = existing === undefined;

  /*
   * Y a-t-il des personnes déjà enregistrées ? Sans aucune, le choix n'a pas lieu
   * d'être posé : l'écran va droit à la description d'une nouvelle personne,
   * plutôt que d'offrir une liste vide.
   */
  const hasKnownTenants = (tenants ?? []).length > 0;
  const tenantMode =
    !hasKnownTenants || values.tenantMode === 'new' ? 'new' : ('known' as 'known' | 'new');

  const fixed = fixedApartmentId ?? (apartments?.length === 1 ? apartments[0]?.id : undefined);
  const fixedApartment = apartments?.find((entry) => entry.id === fixed);

  /* Le loyer de référence du logement prérenseigne le montant : il existe
     précisément pour cela (Database Schema, `apartments.reference_rent_amount`). */
  const suggestedRent = fixedApartment?.referenceRent?.amount;

  const selectClasses =
    'min-h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink focus:border-action focus:outline-none';

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      {isCreation ? (
        <>
          {fixed ? (
            <>
              <input type="hidden" name="apartmentId" value={fixed} />
              <div className="flex flex-col gap-1">
                <Overline as="span">Logement</Overline>
                <span className="break-words text-base text-ink">
                  {fixedApartment?.label ?? fixed}
                </span>
                {errors.apartmentId ? (
                  <span className="text-sm text-danger">{errors.apartmentId[0]}</span>
                ) : null}
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
                  className={selectClasses}
                >
                  <option value="" disabled>
                    Choisir un logement
                  </option>
                  {(apartments ?? []).map((apartment) => (
                    <option key={apartment.id} value={apartment.id}>
                      {apartment.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}

          {/*
            Deux façons de désigner le locataire (DEC-051, Lot 8b).

            Le dévoilement est en CSS pur, par `:has()` sur le bouton radio coché :
            l'écran reste donc utilisable sans JavaScript, comme le reste des
            formulaires. Les deux panneaux restent dans la page, et c'est le mode
            qui dit lequel compte : `createFields` ne retient que celui-là.

            Aucun champ de la nouvelle personne n'est `required` au sens HTML : le
            navigateur refuserait de soumettre à cause d'un panneau masqué, sans
            dire lequel. C'est le serveur qui valide, et il sait quel mode est
            choisi.
          */}
          <fieldset className="group flex flex-col gap-3">
            <legend className="text-sm font-medium text-ink">
              Locataire
              <span className="text-danger" aria-hidden="true">
                {' *'}
              </span>
            </legend>

            {errors.tenantId ? (
              <p className="text-sm text-danger">{errors.tenantId.join(' ')}</p>
            ) : null}

            {hasKnownTenants ? (
              <>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 has-[:checked]:border-action">
                  <input
                    type="radio"
                    name="tenantMode"
                    value="known"
                    defaultChecked={tenantMode === 'known'}
                    className="mode-known size-5 shrink-0 accent-action"
                  />
                  <span className="text-sm font-medium text-ink">
                    Une personne déjà enregistrée
                  </span>
                </label>

                <div className="hidden flex-col gap-3 pl-3 group-has-[.mode-known:checked]:flex">
                  <Field id="tenantId" label="Choisir la personne">
                    {(attributes) => (
                      <select
                        {...attributes}
                        name="tenantId"
                        defaultValue={values.tenantId ?? ''}
                        className={selectClasses}
                      >
                        <option value="">Choisir un locataire</option>
                        {(tenants ?? []).map((tenant) => (
                          <option key={tenant.id} value={tenant.id}>
                            {tenant.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                </div>

                <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 has-[:checked]:border-action">
                  <input
                    type="radio"
                    name="tenantMode"
                    value="new"
                    defaultChecked={tenantMode === 'new'}
                    className="mode-new size-5 shrink-0 accent-action"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-ink">Une nouvelle personne</span>
                    <span className="text-xs text-muted">
                      Elle n&apos;aura aucun compte : à utiliser pour un locataire qui
                      n&apos;utilisera pas l&apos;application.
                    </span>
                  </span>
                </label>
              </>
            ) : (
              <>
                <input type="hidden" name="tenantMode" value="new" />
                <p className="text-xs text-muted">
                  Aucune personne n&apos;est encore enregistrée dans cette organisation. Décrivez
                  celle qui occupe le logement : elle n&apos;aura aucun compte, et vous pourrez
                  l&apos;inviter plus tard sans la ressaisir.
                </p>
              </>
            )}

            <div
              className={
                hasKnownTenants
                  ? 'hidden flex-col gap-3 pl-3 group-has-[.mode-new:checked]:flex'
                  : 'flex flex-col gap-3'
              }
            >
              <Field id="tenantName" label="Nom complet" errors={errors.tenant}>
                {(attributes) => (
                  <Input
                    {...attributes}
                    name="tenantName"
                    defaultValue={values.tenantName ?? ''}
                    autoComplete="off"
                  />
                )}
              </Field>

              <Field
                id="tenantPhone"
                label="Téléphone"
                hint="Au format international, par exemple +224620000000. Il identifie la personne dans tout le produit."
              >
                {(attributes) => (
                  <Input
                    {...attributes}
                    name="tenantPhone"
                    type="tel"
                    inputMode="tel"
                    defaultValue={values.tenantPhone ?? ''}
                    autoComplete="off"
                  />
                )}
              </Field>

              <Field id="tenantEmail" label="Email" hint="Facultatif.">
                {(attributes) => (
                  <Input
                    {...attributes}
                    name="tenantEmail"
                    type="email"
                    defaultValue={values.tenantEmail ?? ''}
                    autoComplete="off"
                  />
                )}
              </Field>
            </div>
          </fieldset>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Overline as="span">Logement</Overline>
            <span className="break-words text-base text-ink">{existing.apartmentLabel}</span>
          </div>
          <div className="flex flex-col gap-1">
            <Overline as="span">Locataire</Overline>
            <span className="break-words text-base text-ink">{existing.tenantLabel}</span>
          </div>
          <p className="text-xs text-muted">
            Le logement et le locataire ne se modifient pas : ils définissent la relation locative.
            Pour un changement d&apos;occupant, clôturez ce bail puis créez-en un nouveau.
          </p>
        </div>
      )}

      <Field id="startDate" label="Début du bail" required errors={errors.startDate}>
        {(attributes) => (
          <Input
            {...attributes}
            name="startDate"
            type="date"
            required
            defaultValue={values.startDate ?? existing?.startDate ?? ''}
          />
        )}
      </Field>

      <Field
        id="endDate"
        label="Fin prévue"
        errors={errors.endDate}
        hint="Facultative. Un bail sans terme reste en cours jusqu'à sa clôture."
      >
        {(attributes) => (
          <Input
            {...attributes}
            name="endDate"
            type="date"
            defaultValue={values.endDate ?? existing?.endDate ?? ''}
          />
        )}
      </Field>

      <Field
        id="rentAmount"
        label="Loyer mensuel"
        required
        errors={errors.rentAmount}
        hint={`En ${defaultCurrency}, sans décimale.`}
      >
        {(attributes) => (
          <Input
            {...attributes}
            name="rentAmount"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            required
            defaultValue={
              values.rentAmount ?? existing?.rentAmount ?? suggestedRent?.toString() ?? ''
            }
          />
        )}
      </Field>

      <input type="hidden" name="currency" value={defaultCurrency} />

      <Field
        id="dueDay"
        label="Jour d'échéance"
        required
        errors={errors.dueDay}
        hint={`Le jour du mois où le loyer est dû, de ${LEASE_DUE_DAY_MIN} à ${LEASE_DUE_DAY_MAX}.`}
      >
        {(attributes) => (
          <Input
            {...attributes}
            name="dueDay"
            type="number"
            inputMode="numeric"
            min={LEASE_DUE_DAY_MIN}
            max={LEASE_DUE_DAY_MAX}
            step={1}
            required
            defaultValue={values.dueDay ?? existing?.dueDay ?? '5'}
          />
        )}
      </Field>

      <Field
        id="depositAmount"
        label="Caution"
        errors={errors.depositAmount}
        hint={`Facultative, en ${defaultCurrency}. Vide vaut zéro.`}
      >
        {(attributes) => (
          <Input
            {...attributes}
            name="depositAmount"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            defaultValue={values.depositAmount ?? existing?.depositAmount ?? ''}
          />
        )}
      </Field>

      {/* Sur mobile, les actions sont empilées et pleine largeur (section 9). */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className={buttonClasses('secondary', 'md')}>
          Annuler
        </Link>
        <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
