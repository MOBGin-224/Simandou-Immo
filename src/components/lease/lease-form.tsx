'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import type { LeaseFormState } from '@/app/(app)/baux/actions';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
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
  /** `user_access.id`, l'identifiant de la ressource locataire. */
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
                <span className="text-xs font-medium uppercase tracking-wide text-muted">
                  Logement
                </span>
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

          <Field
            id="tenantId"
            label="Locataire"
            required
            errors={errors.tenantId}
            hint="La personne doit déjà avoir été invitée comme locataire."
          >
            {(attributes) => (
              <select
                {...attributes}
                name="tenantId"
                required
                defaultValue={values.tenantId ?? ''}
                className={selectClasses}
              >
                <option value="" disabled>
                  Choisir un locataire
                </option>
                {(tenants ?? []).map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Logement</span>
            <span className="break-words text-base text-ink">{existing.apartmentLabel}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              Locataire
            </span>
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
