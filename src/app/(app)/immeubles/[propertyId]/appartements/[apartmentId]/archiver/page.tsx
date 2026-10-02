import { notFound } from 'next/navigation';

import { ArchiveApartmentForm } from '@/components/apartment/archive-apartment-form';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { can } from '@/lib/authorization';
import { describeFloor } from '@/modules/apartments';

import { archiveApartmentAction } from '../../actions';
import { loadApartmentPage } from '../../data';

/**
 * Confirmation d'archivage d'un appartement (DEC-039, BR-025).
 *
 * Structure imposée par la Component Specification section 45 : titre,
 * CONSÉQUENCE, action secondaire, action principale. La conséquence est écrite
 * en clair, et elle est vraie : rien n'est supprimé, et le logement reste
 * consultable.
 *
 * Une page plutôt qu'une boîte de dialogue. Sur un téléphone, une confirmation
 * en plein écran est plus lisible qu'une fenêtre superposée, elle est
 * atteignable au clavier, elle fonctionne sans JavaScript, et son adresse est
 * partageable.
 *
 * Réservé au propriétaire : un gestionnaire qui atteindrait cette adresse
 * obtient « introuvable », pas un formulaire qui échouerait à la soumission.
 */
export async function generateMetadata(
  props: PageProps<'/immeubles/[propertyId]/appartements/[apartmentId]/archiver'>,
) {
  const { propertyId, apartmentId } = await props.params;
  const { apartment } = await loadApartmentPage(propertyId, apartmentId);

  return { title: `Archiver ${apartment.number}` };
}

export default async function ArchiveApartmentPage(
  props: PageProps<'/immeubles/[propertyId]/appartements/[apartmentId]/archiver'>,
) {
  const { propertyId, apartmentId } = await props.params;
  const { context, property, apartment } = await loadApartmentPage(propertyId, apartmentId);

  const allowed = can(context, 'apartment.archive', {
    organizationId: property.organizationId,
    propertyId: property.id,
  });

  if (!allowed || apartment.archived || property.archived) notFound();

  const fiche = `/immeubles/${property.id}/appartements/${apartment.id}`;
  const floor = describeFloor(apartment.floor);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={`Archiver ${apartment.number} ?`}
        description={floor === null ? property.name : `${floor} · ${property.name}`}
        back={{ href: fiche, label: apartment.number }}
      />

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 text-sm text-ink">
          <p>En archivant ce logement :</p>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>il quitte la liste des logements du parc ;</li>
            <li>tout son historique reste consultable ;</li>
            <li>il ne peut plus être modifié ;</li>
            {/*
              La référence reste prise, et il faut le dire ici : c'est la seule
              conséquence que l'utilisateur ne peut pas deviner, et elle le
              surprendrait en tentant de recréer « A04 » plus tard.
            */}
            <li>
              sa référence <span className="font-medium text-ink">{apartment.number}</span> reste
              réservée et ne peut pas être réutilisée.
            </li>
          </ul>
          <p>Rien n&apos;est effacé, et cette opération n&apos;a pas de retour automatique.</p>
        </div>

        <ArchiveApartmentForm
          action={archiveApartmentAction.bind(null, property.id, apartment.id)}
          cancelHref={fiche}
        />
      </Card>
    </div>
  );
}
