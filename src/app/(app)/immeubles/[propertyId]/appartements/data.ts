import { cache } from 'react';

import { notFound } from 'next/navigation';

import { getDb } from '@/db/client';
import { ResourceOutOfScopeError } from '@/lib/authorization';
import { getApartment, type ApartmentView } from '@/modules/apartments';

import { loadPropertyPage } from '../../data';

/**
 * Lectures partagées par les écrans Appartements.
 *
 * Un appartement inconnu et un appartement hors périmètre donnent tous deux la
 * page « introuvable » : la distinction révélerait l'existence de données d'une
 * autre organisation (ADR-007). C'est la traduction, côté écran, du 404 de
 * l'API.
 *
 * `cache` de React mémorise le résultat pour la durée de la requête, comme pour
 * l'immeuble : `generateMetadata` et le composant de page appellent la même
 * fonction sans interroger la base deux fois.
 */
export const loadApartmentPage = cache(async (propertyId: string, apartmentId: string) => {
  const { context, property } = await loadPropertyPage(propertyId);

  let apartment: ApartmentView;

  try {
    apartment = await getApartment(getDb(), context, apartmentId);
  } catch (error) {
    if (error instanceof ResourceOutOfScopeError) notFound();

    throw error;
  }

  // L'appartement existe et l'utilisateur y a accès, mais l'URL le rattache à un
  // autre immeuble. Sans ce contrôle, deux chemins désigneraient la même fiche
  // avec un fil d'Ariane mensonger, et le contexte persistant de l'architecture
  // d'information serait faux.
  if (apartment.propertyId !== property.id) notFound();

  return { context, property, apartment };
});
