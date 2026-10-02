import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * En-tête de page (Component Specification sections 60 à 62).
 *
 * Le retour est un LIEN simple et non un fil d'Ariane complet : sur un téléphone,
 * « ← Immeubles » est lisible là où une chaîne de trois niveaux se replie sur
 * deux lignes et mange l'écran (section 62).
 *
 * Une seule action principale par page (MVP-UI-003) : `actions` reçoit donc au
 * plus un bouton mis en avant, les autres relevant du contenu de la page.
 */
export type PageHeaderProps = {
  title: string;
  description?: string;
  back?: { href: string; label: string };
  actions?: ReactNode;
};

export function PageHeader({ title, description, back, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3">
      {back ? (
        <Link
          href={back.href}
          className="inline-flex min-h-11 items-center gap-1 self-start text-sm text-action hover:text-brand"
        >
          <span aria-hidden="true">&larr;</span>
          {back.label}
        </Link>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-brand sm:text-3xl">
            {title}
          </h1>
          {description ? <p className="text-sm text-muted">{description}</p> : null}
        </div>

        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
