'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import type { ChargeFormState } from '@/app/(app)/charges/actions';
import { Alert } from '@/components/ui/alert';
import { buttonClasses, type ButtonVariant } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';

/**
 * Confirmation d'une action sur une charge (Component Specification sections 45
 * et 65).
 *
 * Sert la PUBLICATION et l'ANNULATION : deux confirmations de même forme, qui ne
 * diffèrent que par leur libellé et leur ton. La section 65 décrit exactement cet
 * écran pour la publication, « Publier les charges ? 12 appartements, 3 600 000
 * GNF, Répartition égale, Annuler, Publier » : le récapitulatif est au-dessus,
 * porté par l'écran, et ce composant ne porte que la décision.
 *
 * **Pourquoi une confirmation ici, alors que la génération des loyers n'en
 * demande aucune.** La génération est idempotente et sans effet si elle est
 * rejouée (DEC-028) ; la publication, elle, crée des créances que des locataires
 * devront, et elle n'est pas rejouable (BR-052). Un clic de trop sur un bouton
 * de liste engagerait douze personnes.
 *
 * L'identifiant de la charge voyage dans un champ caché : l'action publie ce que
 * cet écran a montré, et non ce que l'URL dit.
 *
 * Aucune boîte de dialogue native : `confirm()` bloque la page, n'est pas
 * stylable, et sur mobile son libellé est celui du navigateur.
 */
export type ConfirmChargeActionFormProps = {
  action: (state: ChargeFormState, formData: FormData) => Promise<ChargeFormState>;
  chargeId: string;
  cancelHref: string;
  submitLabel: string;
  pendingLabel: string;
  variant?: ButtonVariant;
};

const INITIAL_STATE: ChargeFormState = {};

export function ConfirmChargeActionForm({
  action,
  chargeId,
  cancelHref,
  submitLabel,
  pendingLabel,
  variant = 'primary',
}: ConfirmChargeActionFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="chargeId" value={chargeId} />

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
