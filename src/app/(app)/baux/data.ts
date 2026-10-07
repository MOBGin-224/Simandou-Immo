import { notFound } from 'next/navigation';

import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { ResourceOutOfScopeError } from '@/lib/authorization';
import { getLease, type LeaseView } from '@/modules/leases';

/**
 * Chargement partagé des écrans d'un bail (MVP-BACKLOG-035).
 *
 * Trois écrans, la fiche, la modification et la clôture, ont besoin du même
 * contrôle : le contexte d'accès, puis le bail, ou « introuvable ». Le répéter
 * dans chacun garantirait qu'un jour l'un d'eux l'oublie.
 *
 * Un identifiant inconnu, mal formé, d'une autre organisation ou hors du
 * périmètre d'immeubles donne la MÊME page « introuvable » (ADR-007). Il en va de
 * même pour un locataire qui viserait le bail d'un autre (BR-021).
 */
export async function loadLeasePage(leaseId: string): Promise<LeaseView> {
  const context = await requireAccessContextOrSignIn();

  try {
    return await getLease(getDb(), context, leaseId);
  } catch (error) {
    if (error instanceof ResourceOutOfScopeError) notFound();

    throw error;
  }
}
