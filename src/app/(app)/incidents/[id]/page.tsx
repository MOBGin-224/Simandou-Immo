import { notFound } from 'next/navigation';

import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { getIncident, IncidentNotFoundError } from '@/modules/incidents';
import type { IncidentWithRelations } from '@/modules/incidents/client';

import IncidentDetailClient from './incident-detail-client';

export const metadata = { title: "Détail de l'incident" };

/**
 * Détail d'un incident (Lot 13, DEC-059).
 *
 * Le chargement initial passe par le serveur : `getIncident` applique déjà
 * le périmètre (DEC-059, section 9), et un incident introuvable ou hors
 * périmètre donne `notFound()`, comme partout ailleurs (404, jamais 403,
 * pour ne pas confirmer l'existence d'une ressource d'une autre
 * organisation).
 */
export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await requireAccessContextOrSignIn();

  let incident;
  try {
    incident = await getIncident(getDb(), id, context);
  } catch (error) {
    if (error instanceof IncidentNotFoundError) notFound();
    throw error;
  }

  const roles = context.memberships.map((membership) => membership.role);
  const isOwnerOrManager = roles.some((role) => role === 'OWNER' || role === 'MANAGER');

  /*
   * `getIncident` rend des colonnes `Date` et une `category` en `string`
   * nue (varchar + CHECK, DEC-021) : même forme que le JSON que l'API
   * renvoie une fois sérialisée. Le round-trip ici reproduit cette
   * sérialisation pour que l'état initial ait EXACTEMENT la forme que
   * `incident-detail-client.tsx` reçoit ensuite de `getIncidentRequest`.
   */
  const initialIncident = JSON.parse(JSON.stringify(incident)) as IncidentWithRelations;

  return (
    <IncidentDetailClient
      incidentId={id}
      initialIncident={initialIncident}
      isOwnerOrManager={isOwnerOrManager}
      currentUserId={context.userId}
    />
  );
}
