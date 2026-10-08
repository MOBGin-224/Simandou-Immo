import Link from 'next/link';

import { BrandMark } from '@/components/brand/brand-mark';
import type { Role } from '@/lib/authorization';
import { homeForRoles } from '@/lib/ui/home';
import { describeRoles } from '@/lib/ui/labels';
import { Overline } from '@/components/ui/overline';

/**
 * En-tête de l'application (Component Specification section 60).
 *
 * Le chrome ne porte AUCUN nom de personne. Ce qui sert en permanence est le
 * point de vue depuis lequel les données se lisent, c'est-à-dire le rôle, puisque
 * c'est lui qui commande le périmètre visible. Bénéfice secondaire réel : une
 * capture d'écran qui circule ne divulgue pas l'identité d'un utilisateur.
 *
 * La marque est portée par `BrandMark`, qui compose le SYMBOLE officiel de la
 * charte et le logotype. L'en-tête ne la redessine pas : le symbole appartient à
 * la charte, et sa géométrie n'a qu'une source.
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
        {/*
          Le logo conduit à l'accueil DE CELUI QUI REGARDE (DEC-046) : un locataire
          n'atteint aucun immeuble, donc le mener à `/immeubles` lui donnerait un
          refus depuis le seul élément présent sur tous les écrans.
        */}
        <Link
          href={homeForRoles(roles)}
          aria-label="SIMANDOU IMMO, accueil"
          /*
            Le remplissage élargit la CIBLE à 44 px sans décaler le symbole : la
            marge négative compense, donc le symbole reste aligné sur les 16 px
            de marge de l'écran. Mesuré à 28 px de large sans cela, pour
            l'élément le plus souvent touché du produit.
          */
          className="-ml-2 inline-flex min-h-11 items-center px-2"
        >
          <BrandMark wordmark="sm-and-up" />
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Overline as="span" className="whitespace-nowrap">
            {describeRoles(roles)}
          </Overline>

          {/*
            Déconnexion par formulaire, et non par lien : une déconnexion modifie
            l'état du serveur, ce qu'un GET ne doit jamais faire. Un lien serait en
            outre déclenché par un préchargement de navigateur.
          */}
          <form method="post" action="/api/v1/sessions/revoke">
            <button
              type="submit"
              className="min-h-11 text-xs whitespace-nowrap text-action-strong underline underline-offset-4 hover:text-brand sm:text-sm"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
