'use client';

import { useActionState } from 'react';

import type { TenantFormState } from '@/app/(app)/locataires/actions';
import { InvitationLinkPanel } from '@/components/invitation/invitation-link-panel';
import { Alert } from '@/components/ui/alert';
import { SubmitButton } from '@/components/ui/submit-button';

/**
 * Renvoi d'une invitation de locataire (BR-013, DEC-045, ADR-008).
 *
 * Renvoyer régénère le jeton : l'ancien lien cesse de fonctionner aussitôt, et le
 * nouveau n'est affiché qu'une fois. C'est aussi, au MVP, le moyen de récupérer
 * un lien perdu ou périmé.
 *
 * Le bouton dit ce qu'il fait AUX DEUX personnes concernées : l'ancien lien
 * meurt. Sans cela, un gestionnaire qui a déjà transmis le lien pourrait le
 * renvoyer sans mesurer que le locataire ne pourra plus s'en servir.
 */
export type ResendTenantInvitationFormProps = {
  action: (state: TenantFormState, formData: FormData) => Promise<TenantFormState>;
  doneHref: string;
};

const INITIAL_STATE: TenantFormState = {};

export function ResendTenantInvitationForm({ action, doneHref }: ResendTenantInvitationFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  if (state.issued) {
    return (
      <InvitationLinkPanel
        link={state.issued.link}
        expiresAt={state.issued.expiresAt}
        name={state.issued.name}
        phone={state.issued.phone}
        doneHref={doneHref}
        doneLabel="Terminer"
      />
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}

      <p className="text-sm text-muted">
        Générer un nouveau lien invalide l&apos;ancien : la personne ne pourra plus utiliser celui
        que vous lui avez déjà transmis.
      </p>

      <SubmitButton variant="secondary" pendingLabel="Génération...">
        Générer un nouveau lien
      </SubmitButton>
    </form>
  );
}
