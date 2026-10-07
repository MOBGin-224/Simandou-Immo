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
 * `tenantId` est un `users.id`, l'identité métier de la personne (DEC-051), et
 * `organizationId` désigne la relation lorsque l'appelant en lit plusieurs : la
 * ressource est le couple personne et organisation.
 *
 * Un identifiant inconnu, mal formé, d'une personne d'une autre organisation ou
 * hors du périmètre d'immeubles donne la MÊME page « introuvable » (ADR-007). Il
 * en va de même pour un autre locataire qui atteindrait l'écran par son adresse :
 * il n'a accès à aucune fiche que la sienne (DEC-047, BR-021).
 */
export async function loadTenantPage(
  tenantId: string,
  organizationId?: string,
): Promise<TenantDetailView> {
  const context = await requireAccessContextOrSignIn();

  try {
    return await getTenant(getDb(), context, tenantId, { organizationId });
  } catch (error) {
    if (error instanceof ResourceOutOfScopeError) notFound();

    throw error;
  }
}
