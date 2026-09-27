import { notFound } from 'next/navigation';

import { PropertyForm } from '@/components/property/property-form';
import { PageHeader } from '@/components/ui/page-header';
import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { listAllowedOrganizations } from '@/modules/organizations';

import { createPropertyAction } from '../actions';

/**
 * Création d'un immeuble (MVP-BACKLOG-018, parcours 2 des User Flows).
 *
 * L'écran est refusé d'emblée à qui ne porte pas `property.create`, réservée au
 * propriétaire (DEC-025) : sans organisation recevable, la page n'existe pas pour
 * cet utilisateur. C'est le même raisonnement que le 404 de l'API, appliqué à un
 * écran, et cela évite de laisser remplir un formulaire qui serait rejeté à la fin.
 */
export const metadata = { title: 'Nouvel immeuble' };

export default async function NewPropertyPage() {
  const context = await requireAccessContextOrSignIn();
  const organizations = await listAllowedOrganizations(getDb(), context, 'property.create');

  if (organizations.length === 0) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Nouvel immeuble"
        description="Le nom et la localisation suffisent pour commencer. Les appartements viendront ensuite."
        back={{ href: '/immeubles', label: 'Immeubles' }}
      />

      <PropertyForm
        action={createPropertyAction}
        organizations={organizations}
        submitLabel="Créer l'immeuble"
        cancelHref="/immeubles"
      />
    </div>
  );
}
