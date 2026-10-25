import { notFound } from 'next/navigation';

import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { getIntervention, InterventionNotFoundError } from '@/modules/interventions';
import type { InterventionFull, InterventionItem } from '@/modules/interventions/client';

import InterventionDetailClient from './intervention-detail-client';

export const metadata = { title: "Détail de l'intervention" };

/**
 * Détail d'une intervention (Lot 14, DEC-060).
 *
 * Le chargement initial passe par le serveur : `getIntervention` applique
 * déjà le périmètre ET la projection selon le rôle (DEC-060, section 8.2), et
 * une intervention introuvable ou hors périmètre donne `notFound()`, comme
 * partout ailleurs (404, jamais 403, pour ne pas confirmer l'existence d'une
 * ressource d'une autre organisation, DEC-060 10.3).
 */
export default async function InterventionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requireAccessContextOrSignIn();

  let intervention;
  try {
    intervention = await getIntervention(getDb(), id, context);
  } catch (error) {
    if (error instanceof InterventionNotFoundError) notFound();
    throw error;
  }

  const roles = context.memberships.map((membership) => membership.role);
  const isOwnerOrManager = roles.some((role) => role === 'OWNER' || role === 'MANAGER');

  /*
   * Même round-trip que `incidents/[id]/page.tsx` : reproduit la
   * sérialisation JSON que le client reçoit ensuite de `getInterventionRequest`,
   * pour que l'état initial ait exactement la même forme.
   */
  const initialIntervention = JSON.parse(JSON.stringify(intervention)) as
    InterventionItem | InterventionFull;

  return (
    <InterventionDetailClient
      interventionId={id}
      initialIntervention={initialIntervention}
      isOwnerOrManager={isOwnerOrManager}
      currentUserId={context.userId}
    />
  );
}
