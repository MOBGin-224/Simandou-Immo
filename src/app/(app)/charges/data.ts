import { notFound } from 'next/navigation';

import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { ResourceOutOfScopeError } from '@/lib/authorization';
import {
  ChargeNoUnitError,
  getCharge,
  previewCharge,
  type ChargePreview,
  type ChargeView,
} from '@/modules/charges';

/**
 * Chargement partagé des écrans d'une charge (MVP-BACKLOG-054).
 *
 * Trois écrans l'utilisent, la fiche, la publication et l'annulation, et c'est
 * la raison du fichier : répéter le contrôle d'accès dans chacun garantirait
 * qu'un jour l'un d'eux l'oublie.
 *
 * Un identifiant inconnu, mal formé, d'une autre organisation ou hors du
 * périmètre d'immeubles donne la MÊME page « introuvable » (ADR-007). Un
 * locataire qui viserait une charge reçoit la même : une charge appartient à
 * l'immeuble, et sa part à lui est dans son espace (BR-021).
 */
export async function loadChargePage(chargeId: string): Promise<ChargeView> {
  const context = await requireAccessContextOrSignIn();

  try {
    return await getCharge(getDb(), context, chargeId);
  } catch (error) {
    if (error instanceof ResourceOutOfScopeError) notFound();

    throw error;
  }
}

/**
 * Charge et aperçu de sa répartition, pour les écrans qui la montrent avant
 * publication (MVP-BACKLOG-053).
 *
 * L'aperçu est ABSENT plutôt qu'erroné quand il ne peut pas être calculé : un
 * immeuble sans logement actif n'a personne entre qui répartir, et l'écran doit
 * l'expliquer au lieu de tomber sur une page d'erreur. C'est le même
 * raisonnement que pour un filtre qui ne ramène rien : un vide bien formulé est
 * une information.
 */
export async function loadChargeWithPreview(chargeId: string): Promise<{
  charge: ChargeView;
  preview: ChargePreview | null;
}> {
  const context = await requireAccessContextOrSignIn();
  const charge = await loadChargePage(chargeId);

  try {
    return { charge, preview: await previewCharge(getDb(), context, chargeId) };
  } catch (error) {
    if (error instanceof ChargeNoUnitError) return { charge, preview: null };
    if (error instanceof ResourceOutOfScopeError) notFound();

    throw error;
  }
}
