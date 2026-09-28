import type { ReactNode } from 'react';

import { AppHeader } from '@/components/navigation/app-header';
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

  return (
    <>
      <AppHeader roles={roles} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">{children}</main>
    </>
  );
}
