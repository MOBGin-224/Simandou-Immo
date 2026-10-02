'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import type { ManagerFormState } from '@/app/(app)/gestionnaires/actions';
import { Alert } from '@/components/ui/alert';
import { buttonClasses, type ButtonVariant } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';

/**
 * Confirmation d'une action sur un gestionnaire ou une invitation (Component
 * Specification section 45).
 *
 * Sert la révocation d'une invitation, la suspension et la révocation d'un accès :
 * trois confirmations de même forme, qui ne diffèrent que par leur libellé et leur
 * ton. Une action DESTRUCTIVE, ou qui prive quelqu'un de son accès, est présentée en
 * rouge ; la réactivation, qui restitue un accès, ne l'est pas.
 *
 * Aucune boîte de dialogue native : `confirm()` bloque la page, n'est pas stylable,
 * et sur mobile son libellé est celui du navigateur.
 */
export type ConfirmManagerActionFormProps = {
  action: (state: ManagerFormState, formData: FormData) => Promise<ManagerFormState>;
  cancelHref: string;
  submitLabel: string;
  pendingLabel: string;
  variant?: ButtonVariant;
};

const INITIAL_STATE: ManagerFormState = {};

export function ConfirmManagerActionForm({
  action,
  cancelHref,
  submitLabel,
  pendingLabel,
  variant = 'destructive',
}: ConfirmManagerActionFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      {/* Sur mobile, les actions sont empilées et pleine largeur (section 9). */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className={buttonClasses('secondary', 'md')}>
          Annuler
        </Link>
        <SubmitButton variant={variant} pendingLabel={pendingLabel}>
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
