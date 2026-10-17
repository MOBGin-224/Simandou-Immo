import { notFound } from 'next/navigation';

import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { readablePropertyScopes } from '@/lib/authorization';
import { listApartments } from '@/modules/apartments';
import { describeApartment, listMyLeases } from '@/modules/leases';
import { listProperties } from '@/modules/properties';

import DeclareIncidentClient, { type ApartmentChoice } from './declare-incident-client';

/**
 * Déclaration d'un incident (Lot 13, DEC-059 section 4.1).
 *
 * Le logement vient de deux chemins distincts selon le rôle, décidés ICI,
 * côté serveur, et non devinés par le formulaire :
 *
 *   - un TENANT déclare sur le logement de son bail ACTIF, imposé et affiché
 *     en lecture seule ;
 *   - un MANAGER ou un OWNER choisit parmi les logements de son périmètre,
 *     rassemblés immeuble par immeuble puisqu'aucune liste à plat des
 *     appartements du périmètre n'existe (seule `/properties/[id]/apartments`
 *     y répond).
 *
 * Sans aucun logement disponible, l'écran le dit et désactive le formulaire,
 * plutôt que de proposer une liste vide qui laisserait croire à une panne.
 */
export const metadata = { title: 'Déclarer un incident' };

export default async function DeclareIncidentPage() {
  const context = await requireAccessContextOrSignIn();
  const roles = context.memberships.map((membership) => membership.role);
  const isTenantOnly = roles.length > 0 && roles.every((role) => role === 'TENANT');

  if (isTenantOnly) {
    const leases = await listMyLeases(getDb(), context);
    const activeLease = leases.find((lease) => lease.status === 'ACTIVE');

    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Déclarer un incident"
          description="Signalez un problème dans votre logement."
          back={{ href: '/incidents', label: 'Incidents' }}
        />

        {activeLease ? (
          <DeclareIncidentClient
            fixedApartment={{
              id: activeLease.apartment.id,
              label: describeApartment(activeLease.apartment),
            }}
            apartments={[]}
          />
        ) : (
          <EmptyState
            title="Aucun logement disponible"
            description="Un bail actif est nécessaire pour déclarer un incident."
          />
        )}
      </div>
    );
  }

  // Un locataire cumulant un autre rôle passe par le chemin MANAGER/OWNER
  // ci-dessous ; un rôle sans aucun périmètre de création n'a pas d'écran.
  if (readablePropertyScopes(context, 'incident.create').length === 0) notFound();

  const properties = await listProperties(getDb(), context, {
    status: 'ACTIVE',
    pageSize: 100,
  });

  const apartmentCollections = await Promise.all(
    properties.properties.map((property) =>
      listApartments(getDb(), context, property.id, { pageSize: 100 }),
    ),
  );

  const apartments: ApartmentChoice[] = apartmentCollections.flatMap((collection, index) => {
    const property = properties.properties[index];
    if (!property) return [];

    return collection.apartments
      .filter((apartment) => !apartment.archived)
      .map((apartment) => ({
        id: apartment.id,
        label: `${apartment.number}, ${property.name}`,
      }));
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Déclarer un incident"
        description="Signalez un problème dans un logement de votre périmètre."
        back={{ href: '/incidents', label: 'Incidents' }}
      />

      {apartments.length === 0 ? (
        <EmptyState
          title="Aucun logement disponible"
          description="Aucun logement actif n'existe dans votre périmètre pour l'instant."
        />
      ) : (
        <DeclareIncidentClient fixedApartment={null} apartments={apartments} />
      )}
    </div>
  );
}
