import { notFound } from 'next/navigation';

import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { ResourceOutOfScopeError } from '@/lib/authorization';
import { getTenant, type TenantDetailView } from '@/modules/tenants';

/**
 * Chargement partagé des écrans d'un locataire (MVP-BACKLOG-031).
 *
 * Quatre écrans, la fiche, la suspension, la réactivation et la révocation, ont
 * besoin du même contrôle : le contexte d'accès, puis la fiche, ou
 * « introuvable ». Le répéter dans chacun garantirait qu'un jour l'un d'eux
 * l'oublie.
 *
 * Un identifiant inconnu, mal formé, d'une autre organisation, hors du périmètre
 * d'immeubles, ou d'un accès de propriétaire ou de gestionnaire, donne la MÊME
 * page « introuvable » (ADR-007). Il en va de même pour un autre locataire qui
 * atteindrait l'écran par son adresse : il n'a accès à aucune fiche que la sienne
 * (DEC-047).
 */
export async function loadTenantPage(tenantId: string): Promise<TenantDetailView> {
  const context = await requireAccessContextOrSignIn();

  try {
    return await getTenant(getDb(), context, tenantId);
  } catch (error) {
    if (error instanceof ResourceOutOfScopeError) notFound();

    throw error;
  }
}
