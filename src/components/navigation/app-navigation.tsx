'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Icon } from '@/components/ui/icon';
import type { Role } from '@/lib/authorization';
import { cn } from '@/lib/ui/cn';
import { isCurrentEntry, navigationForRoles, type NavigationEntry } from '@/lib/ui/navigation';

/**
 * Navigation principale (Component Specification sections 58 et 59).
 *
 * **Deux rendus, une seule liste.** Sur téléphone, une barre BASSE et fixe : la
 * charte place les actions en bas, « la zone du pouce porte les actions », et
 * c'est la BottomNavigation de la section 58. Au-delà de 640 px, cette barre
 * disparaît et la même liste devient une rangée d'onglets sous l'en-tête, parce
 * qu'une barre collée en bas d'un écran de 1400 px n'a plus de sens, le pouce
 * n'y étant plus. La SideNavigation complète de la section 59 viendra avec les
 * modules qui la justifient.
 *
 * Les deux lisent `navigationForRoles` : une seconde liste finirait par offrir
 * deux navigations différentes selon la largeur.
 *
 * **Composant client, et c'est justifié** (MVP-ENG-014) : marquer l'entrée
 * courante demande de connaître l'adresse affichée, et une enveloppe rendue sur
 * le serveur ne la connaît pas. Rien d'autre n'est déporté au navigateur : ce
 * sont des liens, qui fonctionnent sans JavaScript.
 *
 * **`aria-current="page"` et pas seulement une couleur.** Un repère qui
 * n'existe qu'en couleur ne se voit pas d'un lecteur d'écran, et la charte
 * interdit déjà la couleur seule pour les statuts ; la même exigence vaut pour
 * la navigation.
 */
export type AppNavigationProps = {
  roles: readonly Role[];
};

/** Un lien de la barre basse : icône au-dessus, libellé en dessous. */
function BottomLink({ entry, current }: { entry: NavigationEntry; current: boolean }) {
  return (
    <Link
      href={entry.href}
      aria-current={current ? 'page' : undefined}
      /*
       * `min-h-14` donne 56 px, bien au-delà des 44 px exigés pour une cible
       * tactile, et `flex-1` répartit la largeur à égalité : à 360 px, quatre
       * entrées disposent de 90 px chacune, ce qui laisse le libellé sur une
       * seule ligne.
       *
       * `text-xs`, soit 12 px, et PAS moins : la charte écrit « corps à 16 px et
       * jamais sous 12 px ». Un premier essai à 11 px a été relevé par la mesure
       * mobile sur les quatre libellés, et corrigé ici. Le libellé est tronqué
       * plutôt que replié, une barre qui double de hauteur mangeant le contenu de
       * la page.
       */
      className={cn(
        'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 transition-colors',
        current ? 'text-action-strong' : 'text-muted hover:text-ink',
      )}
    >
      <Icon name={entry.icon} size={24} />
      <span className="w-full truncate text-center text-xs leading-tight font-semibold">
        {entry.label}
      </span>
    </Link>
  );
}

/** Un onglet de la rangée large : icône et libellé côte à côte. */
function TabLink({ entry, current }: { entry: NavigationEntry; current: boolean }) {
  return (
    <Link
      href={entry.href}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors',
        current ? 'bg-brand text-white' : 'text-muted hover:bg-surface-subtle hover:text-ink',
      )}
    >
      <Icon name={entry.icon} size={20} />
      {entry.label}
    </Link>
  );
}

export function AppNavigation({ roles }: AppNavigationProps) {
  const pathname = usePathname();
  const entries = navigationForRoles(roles);

  return (
    <>
      {/*
        Rangée d'onglets de l'écran large. Sous l'en-tête et non dedans : la
        charte veut un en-tête COMPACT, et y ajouter quatre entrées le ferait
        enfler sur les largeurs intermédiaires.
      */}
      <nav
        aria-label="Navigation principale"
        className="hidden border-b border-line bg-surface sm:block"
      >
        <div className="mx-auto flex w-full max-w-5xl gap-1 px-4 py-2">
          {entries.map((entry) => (
            <TabLink key={entry.href} entry={entry} current={isCurrentEntry(entry, pathname)} />
          ))}
        </div>
      </nav>

      {/*
        Barre basse du téléphone. `fixed` et non `sticky` : elle doit rester
        visible même sur une page courte qui ne défile pas.

        `pb-[env(safe-area-inset-bottom)]` tient compte de la barre système des
        téléphones sans bouton d'accueil : sans lui, le dernier libellé passe
        sous la zone de glissement et devient intouchable.
      */}
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        <div className="flex">
          {entries.map((entry) => (
            <BottomLink key={entry.href} entry={entry} current={isCurrentEntry(entry, pathname)} />
          ))}
        </div>
      </nav>
    </>
  );
}
