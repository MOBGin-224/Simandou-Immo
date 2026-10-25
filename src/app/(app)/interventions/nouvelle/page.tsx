import { notFound } from 'next/navigation';

import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { readablePropertyScopes } from '@/lib/authorization';
import { listApartments } from '@/modules/apartments';
import { listIncidents } from '@/modules/incidents';
import { listManagers } from '@/modules/managers';
import { listProperties } from '@/modules/properties';

import CreateInterventionClient, {
  type ApartmentChoice,
  type IncidentChoice,
  type PropertyChoice,
  type ResponsibleChoice,
} from './create-intervention-client';

/**
 * Création d'une intervention (Lot 14, DEC-060 section 8.1).
 *
 * Un TENANT ne crée jamais d'intervention : la permission `intervention.create`
 * n'existe que pour MANAGER et OWNER (DEC-060, 8.1). L'écran le dit clairement
 * plutôt que de rediriger en silence, même raison que pour tout refus connu
 * d'avance (ADR-007 ne s'applique pas ici : ce n'est pas une ressource cachée,
 * c'est une action absente du rôle).
 *
 * Même approche que `incidents/nouveau/page.tsx` pour les immeubles et
 * logements du périmètre : aucune liste à plat n'existe, donc l'un puis
 * l'autre, immeuble par immeuble.
 *
 * Les incidents proposés se limitent à OPEN et IN_PROGRESS (les seuls encore
 * susceptibles de recevoir une intervention utile) et aux 50 plus récents :
 * un select standard suffit au MVP plutôt qu'une recherche, le volume du
 * périmètre d'un gestionnaire restant modeste.
 *
 * La liste des « responsables internes » vient de `listManagers`, réservée au
 * propriétaire (`manager.read`) : un gestionnaire ne peut pas la lire (DEC-025),
 * et reçoit donc seulement l'option « Moi-même ». Le serveur revérifie de toute
 * façon l'appartenance à l'organisation à la création (DEC-060, 8.5) : cette
 * liste n'est qu'un confort de saisie, jamais une autorisation.
 */
export const metadata = { title: 'Nouvelle intervention' };

export default async function CreateInterventionPage() {
  const context = await requireAccessContextOrSignIn();
  const roles = context.memberships.map((membership) => membership.role);
  const isTenantOnly = roles.length > 0 && roles.every((role) => role === 'TENANT');

  if (isTenantOnly) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Nouvelle intervention"
          back={{ href: '/interventions', label: 'Interventions' }}
        />
        <EmptyState
          title="Action non autorisée"
          description="Vous n'êtes pas autorisé à créer une intervention."
        />
      </div>
    );
  }

  // Un locataire cumulant un autre rôle passe par le chemin MANAGER/OWNER
  // ci-dessous ; un rôle sans aucun périmètre de création n'a pas d'écran.
  if (readablePropertyScopes(context, 'intervention.create').length === 0) notFound();

  const properties = await listProperties(getDb(), context, {
    status: 'ACTIVE',
    pageSize: 100,
  });

  const apartmentCollections = await Promise.all(
    properties.properties.map((property) =>
      listApartments(getDb(), context, property.id, { pageSize: 100 }),
    ),
  );

  const propertyChoices: PropertyChoice[] = properties.properties.map((property) => ({
    id: property.id,
    name: property.name,
  }));

  const apartments: ApartmentChoice[] = apartmentCollections.flatMap((collection, index) => {
    const property = properties.properties[index];
    if (!property) return [];

    return collection.apartments
      .filter((apartment) => !apartment.archived)
      .map((apartment) => ({
        id: apartment.id,
        number: apartment.number,
        propertyId: property.id,
      }));
  });

  const openIncidents = await listIncidents(getDb(), context, {
    status: ['OPEN', 'IN_PROGRESS'],
    pageSize: 50,
  });

  const incidents: IncidentChoice[] = openIncidents.incidents.map((row) => ({
    id: row.incident.id,
    title: row.incident.title,
    propertyId: row.incident.propertyId,
    apartmentId: row.incident.apartmentId,
  }));

  let responsibles: ResponsibleChoice[] = [{ userId: context.userId, fullName: 'Moi-même' }];

  try {
    const managersCollection = await listManagers(getDb(), context);
    const others = managersCollection.managers
      .filter((item) => item.kind === 'ACCESS' && item.status === 'ACTIVE')
      .filter((item) => item.userId !== context.userId)
      .map((item) => ({ userId: item.userId, fullName: item.fullName }));

    responsibles = [...responsibles, ...others];
  } catch {
    // `manager.read` est réservée au propriétaire (DEC-025) : un gestionnaire
    // garde seulement l'option « Moi-même », sans que la création échoue.
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nouvelle intervention"
        description="Planifiez un passage, lié ou non à un incident déclaré."
        back={{ href: '/interventions', label: 'Interventions' }}
      />

      {propertyChoices.length === 0 ? (
        <EmptyState
          title="Aucun immeuble disponible"
          description="Aucun immeuble actif n'existe dans votre périmètre pour l'instant."
        />
      ) : (
        <CreateInterventionClient
          properties={propertyChoices}
          apartments={apartments}
          incidents={incidents}
          responsibles={responsibles}
        />
      )}
    </div>
  );
}
