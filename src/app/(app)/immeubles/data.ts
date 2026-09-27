import { notFound } from 'next/navigation';

import { getDb } from '@/db/client';
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
