import { Suspense } from 'react';

import { requireAccessContextOrSignIn } from '@/lib/auth/guard';

import PaymentsListClient from './payments-list-client';

export const metadata = { title: 'Paiements' };

export default async function PaymentsPage() {
  const context = await requireAccessContextOrSignIn();
  const roles = context.memberships.map((membership) => membership.role);
  /*
   * Le locataire déclare depuis son espace, /mon-logement, qui connaît déjà son
   * appartement : lui proposer le bouton ici mènerait à l'écran bloquant faute
   * de ces paramètres. Qui gère, en revanche, choisit d'abord POUR QUI déclarer,
   * et c'est la liste des locataires qui le lui permet.
   */
  const isTenantOnly = roles.length > 0 && roles.every((role) => role === 'TENANT');
  const canDeclare = !isTenantOnly;

  return (
    <Suspense
      fallback={
        <div className="py-8 text-center text-sm text-muted">Chargement des paiements...</div>
      }
    >
      <PaymentsListClient canDeclare={canDeclare} />
    </Suspense>
  );
}
