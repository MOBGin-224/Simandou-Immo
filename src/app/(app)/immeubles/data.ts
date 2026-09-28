import { cache } from 'react';

import { notFound } from 'next/navigation';

import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { ResourceOutOfScopeError, type AccessContext } from '@/lib/authorization';
import { getProperty, type PropertyView } from '@/modules/properties';

/**
 * Lectures partagées par les écrans Immeubles.
 *
 * Un immeuble inconnu et un immeuble hors périmètre donnent tous deux la page
 * « introuvable » : la distinction révélerait l'existence de données d'une autre
 * organisation (ADR-007). C'est la traduction, côté écran, du 404 de l'API.
 */
export async function loadPropertyOrNotFound(
  context: AccessContext,
  propertyId: string,
): Promise<PropertyView> {
  try {
    return await getProperty(getDb(), context, propertyId);
  } catch (error) {
    if (error instanceof ResourceOutOfScopeError) notFound();

    throw error;
  }
}

/**
 * Contexte et immeuble d'une page de fiche, chargés UNE fois par requête.
 *
 * `cache` de React mémorise le résultat pour la durée de la requête. C'est ce
 * qui permet à `generateMetadata` et au composant de page d'appeler la même
 * fonction sans interroger la base deux fois : Next les exécute séparément, et
 * sans cette mémorisation le titre de l'onglet coûterait une requête complète.
 *
 * La clé est l'identifiant seul, une chaîne. Y ajouter le contexte d'accès
 * romprait la mémorisation, `cache` comparant ses arguments par identité et le
 * contexte étant un objet neuf à chaque appel.
 */
export const loadPropertyPage = cache(async (propertyId: string) => {
  const context = await requireAccessContextOrSignIn();
  const property = await loadPropertyOrNotFound(context, propertyId);

  return { context, property };
});
