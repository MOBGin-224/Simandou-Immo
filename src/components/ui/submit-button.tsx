'use client';

import { useFormStatus } from 'react-dom';

import { Button, type ButtonProps } from './button';

/**
 * Bouton de soumission qui connaît l'état de son formulaire.
 *
 * Composant client, et c'est justifié (MVP-ENG-014) : `useFormStatus` observe la
 * soumission en cours, ce qu'aucun rendu serveur ne peut faire. Il doit être
 * DANS le formulaire qu'il soumet, le hook lisant le contexte du `<form>` parent.
 *
 * Utilité concrète : sans lui, un double clic sur « Enregistrer » envoie deux
 * créations, et l'utilisateur n'a aucun signe que sa demande est partie.
 */
export type SubmitButtonProps = Omit<ButtonProps, 'type'> & {
  pendingLabel?: string;
};

export function SubmitButton({ children, pendingLabel, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...props}>
      {pending ? (pendingLabel ?? 'Enregistrement...') : children}
    </Button>
  );
}
