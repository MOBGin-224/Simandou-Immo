import Link from 'next/link';

import type { Role } from '@/lib/authorization';
import { describeRoles } from '@/lib/ui/labels';

/**
 * En-tête de l'application (Component Specification section 60).
 *
 * Le chrome ne porte AUCUN nom de personne. Ce qui sert en permanence est le
 * point de vue depuis lequel les données se lisent, c'est-à-dire le rôle, puisque
 * c'est lui qui commande le périmètre visible. Bénéfice secondaire réel : une
 * capture d'écran qui circule ne divulgue pas l'identité d'un utilisateur.
 *
 * La navigation principale par onglets (BottomNavigation, section 58) n'existe pas
 * encore : le produit n'a qu'une destination à ce lot, et une barre d'onglets à
 * une entrée serait un ornement. Elle arrivera avec le lot Appartements, quand il
 * y aura réellement plusieurs destinations.
 */
export type AppHeaderProps = {
  roles: readonly Role[];
};

export function AppHeader({ roles }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/immeubles"
          className="font-display text-sm font-bold tracking-widest text-brand"
        >
          SIMANDOU IMMO
        </Link>

        <div className="flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            {describeRoles(roles)}
          </span>

          {/*
            Déconnexion par formulaire, et non par lien : une déconnexion modifie
            l'état du serveur, ce qu'un GET ne doit jamais faire. Un lien serait en
            outre déclenché par un préchargement de navigateur.
          */}
          <form method="post" action="/api/v1/sessions/revoke">
            <button
              type="submit"
              className="min-h-11 text-sm text-action underline underline-offset-4 hover:text-brand"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
