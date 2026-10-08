import Link from 'next/link';

import {
  ApartmentMaintenanceBadge,
  ApartmentOccupancyBadge,
  ArchivedBadge,
} from '@/components/ui/badge';
import { Card, linkOverlayClasses } from '@/components/ui/card';
import { formatArea, formatMoney } from '@/lib/ui/format';
import { describeFloor, type ApartmentView } from '@/modules/apartments/client';

/**
 * Carte d'appartement (Component Specification, ApartmentCard).
 *
 * Ce que la carte montre est ce qu'un gestionnaire cherche en parcourant un
 * immeuble : la référence, où se trouve le logement, son statut, et le loyer de
 * référence s'il est connu. Le locataire et l'impayé viendront aux lots
 * Contrats et Loyers, quand ces données existeront : un emplacement vide vaut
 * mieux qu'un zéro qui serait lu comme une information.
 *
 * Le lien porte la RÉFÉRENCE, et sa zone tactile est étendue à toute la carte
 * par `linkOverlayClasses` : un `<div>` cliquable ne serait ni atteignable au
 * clavier, ni ouvrable dans un nouvel onglet, alors qu'un titre de 28 par 22
 * pixels ne se vise pas au doigt. Mesuré à 360 pixels.
 */
export function ApartmentCard({
  apartment,
  propertyId,
}: {
  apartment: ApartmentView;
  propertyId: string;
}) {
  const floor = describeFloor(apartment.floor);
  const details = [
    floor,
    apartment.type,
    apartment.area === null ? null : formatArea(apartment.area),
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');

  return (
    <Card as="li" interactive className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-brand">
          <Link
            href={`/immeubles/${propertyId}/appartements/${apartment.id}`}
            className={linkOverlayClasses}
          >
            {apartment.number}
          </Link>
        </h2>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {apartment.archived ? <ArchivedBadge /> : null}
          <ApartmentOccupancyBadge occupancy={apartment.occupancy} />
          {apartment.underMaintenance ? <ApartmentMaintenanceBadge /> : null}
        </div>
      </div>

      <p className="text-sm text-muted">{details === '' ? 'Aucun détail renseigné' : details}</p>

      {apartment.referenceRent ? (
        <p className="text-sm text-ink">
          {formatMoney(apartment.referenceRent.amount, apartment.referenceRent.currency)}
          <span className="text-muted">{' de loyer de référence'}</span>
        </p>
      ) : null}
    </Card>
  );
}
