import { notFound } from 'next/navigation';

import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { ResourceOutOfScopeError } from '@/lib/authorization';
import { getRent, type RentView } from '@/modules/rents';

/**
 * Chargement partagé des écrans d'une échéance (MVP-BACKLOG-039).
 *
 * Un seul écran l'utilise aujourd'hui, la fiche, mais le fichier existe dès
 * maintenant pour la même raison qu'aux Contrats : le paiement du Lot 11
 * ajoutera des écrans qui ont besoin du même contrôle, et le répéter dans chacun
 * garantirait qu'un jour l'un d'eux l'oublie.
 *
 * Un identifiant inconnu, mal formé, d'une autre organisation ou hors du
 * périmètre d'immeubles donne la MÊME page « introuvable » (ADR-007). Un
 * locataire qui viserait la créance d'un autre reçoit la même (BR-021).
 */
export async function loadRentPage(rentId: string): Promise<RentView> {
  const context = await requireAccessContextOrSignIn();

  try {
    return await getRent(getDb(), context, rentId);
  } catch (error) {
    if (error instanceof ResourceOutOfScopeError) notFound();

    throw error;
  }
}
