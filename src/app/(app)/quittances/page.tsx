import { Suspense } from 'react';

import { requireAccessContextOrSignIn } from '@/lib/auth/guard';

import ReceiptsListClient from './receipts-list-client';

export const metadata = { title: 'Quittances' };

export default async function ReceiptsPage() {
  const context = await requireAccessContextOrSignIn();
  const roles = context.memberships.map((membership) => membership.role);
  const isTenantOnly = roles.length > 0 && roles.every((role) => role === 'TENANT');

  return (
    <Suspense
      fallback={
        <div className="py-8 text-center text-sm text-muted">Chargement des quittances...</div>
      }
    >
      <ReceiptsListClient title={isTenantOnly ? 'Mes quittances' : 'Quittances'} />
    </Suspense>
  );
}
