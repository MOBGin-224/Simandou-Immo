import { notFound } from 'next/navigation';

import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { ResourceOutOfScopeError } from '@/lib/authorization';
import { getManager, type ManagerDetailView } from '@/modules/managers';

/**
 * Chargement partagé des écrans d'un gestionnaire (MVP-BACKLOG-026).
 *
 * Quatre écrans, la fiche, le périmètre, la suspension et la révocation, ont besoin
 * du même contrôle : le contexte d'accès, puis la fiche, ou « introuvable ». Le
 * répéter dans chacun garantirait qu'un jour l'un d'eux l'oublie.
 *
 * Un identifiant inconnu, mal formé, d'une autre organisation, ou d'un accès de
 * propriétaire ou de locataire, donne la MÊME page « introuvable » (ADR-007). Il en
 * va de même pour un gestionnaire ou un locataire qui atteint l'écran : la gestion
 * des gestionnaires est réservée au propriétaire, et pour tout autre elle n'existe
 * pas (DEC-025).
 */
export async function loadManagerPage(managerId: string): Promise<ManagerDetailView> {
  const context = await requireAccessContextOrSignIn();

  try {
    return await getManager(getDb(), context, managerId);
  } catch (error) {
    if (error instanceof ResourceOutOfScopeError) notFound();

    throw error;
  }
}
