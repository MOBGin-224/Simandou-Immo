import type { ReactNode } from 'react';

import { AppHeader } from '@/components/navigation/app-header';
import { EmptyState } from '@/components/ui/empty-state';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';

/**
 * Enveloppe des écrans authentifiés.
 *
 * La vérification est faite ICI, côté serveur, et non par un intergiciel : elle
 * charge le contexte d'accès dont les écrans ont besoin de toute façon, donc elle
 * ne coûte rien de plus, et elle ne peut pas être contournée par une route oubliée
 * dans une liste de correspondances.
 *
 * Ce contrôle n'est PAS la sécurité du produit : chaque cas d'usage vérifie de son
 * côté l'autorisation. Il évite seulement d'afficher un écran vide à qui n'est pas
 * connecté.
 *
 * Le groupe de routes `(app)` ne change aucune URL : il n'existe que pour porter
 * cette enveloppe.
 */
export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const context = await requireAccessContextOrSignIn();
  const roles = context.memberships.map((membership) => membership.role);

  /*
   * Aucun accès ACTIF : l'accès a été suspendu ou révoqué (BR-019, DEC-044).
   *
   * Le contexte d'accès est relu en base à chaque requête : l'écran cesse donc de
   * montrer quoi que ce soit dès la requête qui suit la décision du propriétaire,
   * sans attendre l'expiration de la session. Sans ce cas, la personne verrait des
   * écrans vides sans comprendre pourquoi.
   *
   * Le message ne distingue pas suspendu de révoqué : dans les deux cas, la
   * démarche est la même, s'adresser au propriétaire.
   */
  if (context.memberships.length === 0) {
    return (
      <>
        <AppHeader roles={roles} />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">
          <EmptyState
            title="Aucun accès actif"
            description="Votre accès a été suspendu ou retiré. Contactez le propriétaire de l'immeuble pour le rétablir."
          />
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader roles={roles} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">{children}</main>
    </>
  );
}
