import { Suspense } from 'react';

import { requireAccessContextOrSignIn } from '@/lib/auth/guard';

import PaymentsListClient from './payments-list-client';

export const metadata = { title: 'Paiements' };

export default async function PaymentsPage() {
  const context = await requireAccessContextOrSignIn();
  const roles = context.memberships.map((membership) => membership.role);
  const canDeclare =
    roles.includes('TENANT') || roles.includes('MANAGER') || roles.includes('OWNER');

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
