'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import type { PropertyFormState } from '@/app/(app)/immeubles/actions';
import { Alert } from '@/components/ui/alert';
import { buttonClasses } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';

/**
 * Confirmation d'archivage (Component Specification section 45).
 *
 * La structure imposée est respectée : titre, conséquence, action secondaire,
 * action principale. Le titre et la conséquence sont rendus par la page, ce
 * composant ne portant que les actions et le retour d'erreur.
 *
 * Aucune boîte de dialogue native : `confirm()` bloque la page, n'est pas
 * stylable, et sur mobile son libellé est celui du navigateur. Une page de
 * confirmation reste lisible, navigable au clavier et fonctionne sans JavaScript.
 */
export type ArchivePropertyFormProps = {
  action: (state: PropertyFormState, formData: FormData) => Promise<PropertyFormState>;
  cancelHref: string;
};

const INITIAL_STATE: PropertyFormState = {};

export function ArchivePropertyForm({ action, cancelHref }: ArchivePropertyFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className={buttonClasses('secondary', 'md')}>
          Annuler
        </Link>
        <SubmitButton variant="destructive" pendingLabel="Archivage...">
          Archiver l&apos;immeuble
        </SubmitButton>
      </div>
    </form>
  );
}
