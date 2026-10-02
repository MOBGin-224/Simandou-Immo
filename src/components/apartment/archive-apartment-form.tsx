'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import type { ApartmentFormState } from '@/app/(app)/immeubles/[propertyId]/appartements/actions';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';

/**
 * Confirmation d'archivage d'un appartement (Component Specification section 45).
 *
 * Jumeau de celui des immeubles, et volontairement distinct : les deux
 * formulaires portent des états de retour différents, et les fondre en un seul
 * demanderait un type commun dont aucun des deux modules n'a besoin.
 *
 * Aucune boîte de dialogue native : `confirm()` bloque la page, n'est pas
 * stylable, et sur mobile son libellé est celui du navigateur.
 */
export type ArchiveApartmentFormProps = {
  action: (state: ApartmentFormState, formData: FormData) => Promise<ApartmentFormState>;
  cancelHref: string;
};

const INITIAL_STATE: ApartmentFormState = {};

export function ArchiveApartmentForm({ action, cancelHref }: ArchiveApartmentFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      {/* Sur mobile, les actions sont empilées et pleine largeur (section 9). */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className={buttonClasses('secondary', 'md')}>
          Annuler
        </Link>
        <SubmitButton variant="destructive" pendingLabel="Archivage...">
          Archiver l&apos;appartement
        </SubmitButton>
      </div>
    </form>
  );
}
