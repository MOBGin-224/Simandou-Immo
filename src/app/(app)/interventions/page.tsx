import { Suspense } from 'react';

import { requireAccessContextOrSignIn } from '@/lib/auth/guard';

import InterventionsListClient from './interventions-list-client';

export const metadata = { title: 'Interventions' };

export default async function InterventionsPage() {
  await requireAccessContextOrSignIn();

  return (
    <Suspense
      fallback={
        <div className="py-8 text-center text-sm text-muted">Chargement des interventions...</div>
      }
    >
      <InterventionsListClient />
    </Suspense>
  );
}
