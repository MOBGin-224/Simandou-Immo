import Link from 'next/link';

import { buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * Lien d'invitation inutilisable.
 *
 * UN seul message pour tous les cas : lien inconnu, expiré, révoqué ou déjà
 * utilisé. Distinguer apprendrait à qui détient un lien, ou en essaie au hasard, ce
 * qu'il en est advenu (ADR-008).
 *
 * Ce que la page dit en revanche, c'est quoi FAIRE : demander un nouveau lien à la
 * personne qui a invité. Un « introuvable » sans issue laisserait l'invité sans
 * savoir à qui s'adresser.
 */
export default function InvitationNotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-md flex-col gap-6">
        <p className="text-center font-display text-sm font-bold tracking-widest text-brand">
          SIMANDOU IMMO
        </p>

        <EmptyState
          title="Ce lien n'est plus valable"
          description="Il a peut-être expiré, déjà servi, ou été remplacé. Demandez-en un nouveau à la personne qui vous a invité."
          action={
            <Link href="/connexion" className={buttonClasses('secondary', 'md')}>
              Aller à la connexion
            </Link>
          }
        />
      </div>
    </main>
  );
}
