import { Suspense } from 'react';

import { requireAccessContextOrSignIn } from '@/lib/auth/guard';

import IncidentsListClient from './incidents-list-client';

export const metadata = { title: 'Incidents' };

export default async function IncidentsPage() {
  const context = await requireAccessContextOrSignIn();
  const roles = context.memberships.map((membership) => membership.role);
  const isTenantOnly = roles.length > 0 && roles.every((role) => role === 'TENANT');

  return (
    <Suspense
      fallback={
        <div className="py-8 text-center text-sm text-muted">Chargement des incidents...</div>
      }
    >
      <IncidentsListClient title={isTenantOnly ? 'Mes incidents' : 'Incidents'} />
    </Suspense>
  );
}
