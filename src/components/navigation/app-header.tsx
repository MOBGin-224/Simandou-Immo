import Link from 'next/link';

import { BrandMark } from '@/components/brand/brand-mark';
import type { Role } from '@/lib/authorization';
import { homeForRoles } from '@/lib/ui/home';
import { describePrimaryRole } from '@/lib/ui/labels';
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
 *
 * **Le logotype s'affiche désormais à TOUTES les largeurs, et c'est le Lot 9 qui
 * l'a permis.** Quand la charte a été appliquée, le symbole ajoutait 25 px à un
 * en-tête qui portait aussi le rôle et « Se déconnecter » : l'ensemble débordait
 * de 23 px à 360 px et d'un seul pixel à 390 px, mesuré. Le logotype avait donc
 * été replié au-delà de 640 px. La déconnexion ayant rejoint l'écran de compte,
 * que la navigation basse rend atteignable d'un geste, l'en-tête n'a plus que
 * deux éléments et la marque retrouve sa place partout.
 *
 * Il ne reste donc ICI aucune action : l'en-tête identifie, la navigation
 * conduit. C'est aussi ce que demande la charte, « les actions en bas, la zone
 * du pouce porte les actions ».
 */
export type AppHeaderProps = {
  roles: readonly Role[];
};

export function AppHeader({ roles }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
      {/*
        Deux éléments sur une ligne, et le rôle n'en est qu'un MOT.

        `describePrimaryRole` et non `describeRoles` : l'en-tête répond à la
        question « depuis quel point de vue je lis ces données », qui n'a qu'une
        réponse même en cas de cumul (DEC-003), celle que suivent déjà l'accueil
        et la navigation. La raison est aussi mesurée : « Locataire et
        gestionnaire » en capitales à +16 % d'interlettrage réclame 215 px, là où
        360 px n'en laissent que 156 à côté de la marque, et le libellé y était
        tronqué donc illisible. L'énumération complète est sur l'écran de compte.

        La marque ne se comprime pas (`shrink-0`) : elle identifie le produit. Le
        rôle garde `min-w-0 truncate` par sécurité, pour un libellé futur plus
        long : sans `min-w-0`, un enfant de boîte flexible refuse de descendre
        sous sa largeur de contenu et la ligne déborderait au lieu de se tronquer.
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
          className="-ml-2 inline-flex min-h-11 shrink-0 items-center px-2"
        >
          <BrandMark />
        </Link>

        <Overline as="span" className="min-w-0 truncate">
          {describePrimaryRole(roles)}
        </Overline>
      </div>
    </header>
  );
}
