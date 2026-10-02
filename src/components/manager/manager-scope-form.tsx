'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';

import type { ManagerFormState } from '@/app/(app)/gestionnaires/actions';
import { PropertyChecklist, type ChecklistGroup } from '@/components/manager/property-checklist';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';

/**
 * Modification du périmètre d'un gestionnaire (MVP-FEAT-021, DEC-042).
 *
 * Ne modifie QUE la liste des immeubles : les permissions découlent du rôle
 * (DEC-025), il n'y a donc rien d'autre à régler ici.
 *
 * La liste cochée REMPLACE la précédente. Les immeubles décochés sont retirés
 * aussitôt, les nouveaux attribués : le gestionnaire le voit à sa prochaine requête.
 *
 * Au moins un immeuble : un gestionnaire sans périmètre n'aurait aucun sens. Pour lui
 * retirer tout accès, on le suspend ou on le révoque, deux décisions distinctes, avec
 * chacune sa confirmation.
 */
export type ManagerScopeFormProps = {
  action: (state: ManagerFormState, formData: FormData) => Promise<ManagerFormState>;
  groups: ChecklistGroup[];
  /** Immeubles accessibles AUJOURD'HUI, déjà cochés à l'ouverture. */
  initialSelection: string[];
  cancelHref: string;
};

const INITIAL_STATE: ManagerFormState = {};

export function ManagerScopeForm({
  action,
  groups,
  initialSelection,
  cancelHref,
}: ManagerScopeFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(state.selectedPropertyIds ?? initialSelection),
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      <PropertyChecklist
        groups={groups}
        selected={selected}
        onChange={setSelected}
        errors={state.fieldErrors?.propertyIds}
      />

      {/* Sur mobile, les actions sont empilées et pleine largeur (section 9). */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className={buttonClasses('secondary', 'md')}>
          Annuler
        </Link>
        <SubmitButton pendingLabel="Enregistrement...">Enregistrer le périmètre</SubmitButton>
      </div>
    </form>
  );
}
