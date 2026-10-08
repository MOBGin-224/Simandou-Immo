'use client';

import { useActionState } from 'react';

import type { RentGenerationState } from '@/app/(app)/loyers/actions';
import { Alert } from '@/components/ui/alert';
import { SubmitButton } from '@/components/ui/submit-button';

/**
 * Génération des loyers du mois, depuis l'écran (MVP-BACKLOG-037).
 *
 * Composant client, et c'est justifié (MVP-ENG-014) : le compte rendu de
 * l'opération, « 8 loyers générés, 3 déjà présents », doit s'afficher SUR l'écran
 * qui vient de la déclencher. Le faire passer par l'URL rendrait partageable un
 * message qui ne vaut que pour une exécution.
 *
 * Aucune confirmation n'est demandée, à la différence d'une révocation : la
 * génération est idempotente et n'enlève rien à personne. Un double clic ne
 * double aucune dette, la contrainte d'unicité arbitrant en base.
 *
 * Le bouton est SECONDAIRE et non primaire : l'action principale de cet écran
 * est de lire qui doit de l'argent, pas de produire des échéances. La
 * génération est d'ailleurs normalement le fait d'un job planifié (DEC-028), et
 * ce bouton n'est là que pour la provoquer sans attendre le lendemain, ou après
 * la création d'un bail en cours de mois.
 */
const INITIAL_STATE: RentGenerationState = {};

export type GenerateRentsFormProps = {
  action: (state: RentGenerationState, formData: FormData) => Promise<RentGenerationState>;
  /** Restreint la génération à un immeuble. Absent, elle couvre tout le périmètre. */
  propertyId?: string;
};

export function GenerateRentsForm({ action, propertyId }: GenerateRentsFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction}>
        {propertyId ? <input type="hidden" name="propertyId" value={propertyId} /> : null}
        <SubmitButton variant="secondary" pendingLabel="Génération...">
          Générer les loyers du mois
        </SubmitButton>
      </form>

      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {state.message ? <Alert tone="danger">{state.message}</Alert> : null}
    </div>
  );
}
