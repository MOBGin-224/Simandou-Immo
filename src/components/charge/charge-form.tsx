'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import type { ChargeFormState } from '@/app/(app)/charges/actions';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Overline } from '@/components/ui/overline';
import { SubmitButton } from '@/components/ui/submit-button';
import { CHARGE_TYPES, CHARGE_TYPE_LABELS } from '@/modules/charges/client';

/**
 * Enregistrement d'une charge commune (parcours 18, MVP-BACKLOG-051).
 *
 * Le parcours compte sept étapes ; ce formulaire porte les quatre premières :
 * choisir la nature, renseigner le montant, la période et l'immeuble, et la
 * méthode de répartition. Les trois dernières, le calcul, la vérification et la
 * publication, appartiennent à la fiche, parce qu'elles se font APRÈS avoir
 * enregistré : une charge en brouillon ne doit rien à personne, et c'est ce qui
 * rend la vérification possible (BR-052).
 *
 * **La méthode n'est pas un champ**, et c'est une décision. `EQUAL` est la seule
 * du MVP (DEC-029) : une liste déroulante d'une seule valeur ferait croire à un
 * choix, et proposer `CUSTOM` ou `CONSUMPTION` sans les calculer produirait des
 * créances fausses sous un nom juste. La méthode est donc ANNONCÉE, puisque
 * BR-050 exige qu'elle soit explicite, et non demandée.
 *
 * **La période est un MOIS**, saisi par un champ `month` : une charge couvre un
 * mois, et proposer un jour laisserait croire qu'elle peut commencer le 15. Le
 * champ dégrade en texte là où il n'est pas pris en charge, et le schéma accepte
 * les deux écritures.
 *
 * Le montant est saisi dans la plus petite unité de la devise (DEC-014) : pour
 * le franc guinéen, dont l'exposant de sous-unité est zéro, c'est le franc
 * lui-même. L'indication est donnée sous le champ plutôt que supposée connue.
 *
 * Le formulaire fonctionne sans JavaScript : tous les champs sont natifs.
 */
export type PropertyChoice = {
  id: string;
  name: string;
};

export type ChargeFormProps = {
  action: (state: ChargeFormState, formData: FormData) => Promise<ChargeFormState>;
  cancelHref: string;
  /** Immeubles sur lesquels l'appelant peut enregistrer une charge. */
  properties: PropertyChoice[];
  /** Immeuble imposé par le parcours, le cas échéant. */
  fixedPropertyId?: string;
  /** Mois en cours, en `AAAA-MM` : le cas le plus courant. */
  defaultPeriod: string;
  /** Devise de l'organisation, affichée sous le montant (DEC-014). */
  currency: string;
};

const INITIAL_STATE: ChargeFormState = {};

export function ChargeForm({
  action,
  cancelHref,
  properties,
  fixedPropertyId,
  defaultPeriod,
  currency,
}: ChargeFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  const values = state.values ?? {};
  const errors = state.fieldErrors ?? {};

  /* Un seul immeuble possible : il est imposé plutôt que proposé. */
  const fixed = fixedPropertyId ?? (properties.length === 1 ? properties[0]?.id : undefined);
  const fixedProperty = properties.find((property) => property.id === fixed);

  const selectClasses =
    'min-h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink focus:border-action focus:outline-none';

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      {fixed ? (
        <>
          <input type="hidden" name="propertyId" value={fixed} />
          <div className="flex flex-col gap-1">
            <Overline as="span">Immeuble</Overline>
            <span className="break-words text-base text-ink">
              {fixedProperty?.name ?? 'Immeuble sélectionné'}
            </span>
            {errors.propertyId ? (
              <span className="text-sm text-danger">{errors.propertyId[0]}</span>
            ) : null}
          </div>
        </>
      ) : (
        <Field id="propertyId" label="Immeuble" required errors={errors.propertyId}>
          {(attributes) => (
            <select
              {...attributes}
              name="propertyId"
              required
              defaultValue={values.propertyId ?? ''}
              className={selectClasses}
            >
              <option value="" disabled>
                Choisir un immeuble
              </option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}

      <Field
        id="type"
        label="Nature de la charge"
        required
        errors={errors.type}
        hint="Ce qui a été facturé à l'immeuble."
      >
        {(attributes) => (
          <select
            {...attributes}
            name="type"
            required
            defaultValue={values.type ?? 'WATER'}
            className={selectClasses}
          >
            {CHARGE_TYPES.map((type) => (
              <option key={type} value={type}>
                {CHARGE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field
        id="totalAmount"
        label="Montant total de la facture"
        required
        errors={errors.totalAmount}
        hint={`En ${currency}, sans décimale. C'est le montant à répartir entre les logements.`}
      >
        {(attributes) => (
          <Input
            {...attributes}
            name="totalAmount"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            required
            defaultValue={values.totalAmount ?? ''}
          />
        )}
      </Field>

      <Field
        id="periodStart"
        label="Période couverte"
        required
        errors={errors.periodStart}
        hint="Le mois que la facture couvre."
      >
        {(attributes) => (
          <Input
            {...attributes}
            name="periodStart"
            type="month"
            required
            defaultValue={values.periodStart ?? defaultPeriod}
          />
        )}
      </Field>

      <Field
        id="dueDate"
        label="Date d'échéance"
        required
        errors={errors.dueDate}
        hint="Le jour où chaque part devient due. Elle sera la même pour tous les logements."
      >
        {(attributes) => (
          <Input
            {...attributes}
            name="dueDate"
            type="date"
            required
            defaultValue={values.dueDate ?? ''}
          />
        )}
      </Field>

      <Field
        id="supplierName"
        label="Fournisseur"
        errors={errors.supplierName}
        hint="Facultatif. Par exemple SEG pour l'eau, EDG pour l'électricité."
      >
        {(attributes) => (
          <Input
            {...attributes}
            name="supplierName"
            autoComplete="off"
            defaultValue={values.supplierName ?? ''}
          />
        )}
      </Field>

      {/*
        BR-050 : la méthode de répartition doit être EXPLICITE. Elle est donc
        annoncée, et l'écran dit aussi ce qui se passera ensuite : rien, tant que
        la charge n'est pas publiée.
      */}
      <Alert tone="info" title="Répartition égale">
        Le montant sera divisé à parts égales entre les logements actifs de l&apos;immeuble, les
        logements vacants compris. Vous verrez la répartition avant de publier, et rien n&apos;est
        dû par les locataires tant que la charge reste en brouillon.
      </Alert>

      {/* Sur mobile, les actions sont empilées et pleine largeur (section 9). */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className={buttonClasses('secondary', 'md')}>
          Annuler
        </Link>
        <SubmitButton pendingLabel="Enregistrement...">Enregistrer la charge</SubmitButton>
      </div>
    </form>
  );
}
