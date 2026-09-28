import type { ReactNode } from 'react';

/**
 * État vide (Component Specification section 39).
 *
 * Titre, description, action : un écran vide doit dire ce qu'il attend, sinon
 * l'utilisateur ne sait pas s'il n'a rien créé ou si le produit est en panne.
 *
 * L'action est facultative : elle n'apparaît que si l'utilisateur a réellement le
 * droit de l'accomplir. Proposer « Ajouter un immeuble » à un gestionnaire qui
 * n'en a pas la permission produirait un refus, donc une impasse.
 */
export type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface px-6 py-12 text-center">
      <p className="font-display text-lg font-semibold text-brand">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{description}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
