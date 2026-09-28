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
      {/*
        Trois éléments sur une seule ligne à 360 px de large, ce qui ne tient
        qu'à condition de ne rien laisser au hasard : aucun des trois ne se coupe
        (`whitespace-nowrap`), et l'interlettrage comme la taille du lien de
        sortie sont réduits sur petit écran. Sans cela, « SIMANDOU IMMO » et
        « Se déconnecter » passent chacun sur deux lignes et l'en-tête double de
        hauteur, constaté sur un écran de 390 px.
      */}
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-3 sm:gap-4">
        <Link
          href="/immeubles"
          className="font-display text-sm font-bold tracking-wide whitespace-nowrap text-brand sm:tracking-widest"
        >
          SIMANDOU IMMO
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-xs font-medium whitespace-nowrap uppercase tracking-wide text-muted">
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
              className="min-h-11 text-xs whitespace-nowrap text-action underline underline-offset-4 hover:text-brand sm:text-sm"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
