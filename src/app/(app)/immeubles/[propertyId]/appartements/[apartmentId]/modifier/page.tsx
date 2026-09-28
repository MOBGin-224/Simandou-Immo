import { notFound } from 'next/navigation';

import { ApartmentForm } from '@/components/apartment/apartment-form';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { getDb } from '@/db/client';
import { can } from '@/lib/authorization';
import { organizationDefaultCurrency } from '@/modules/organizations';

import { updateApartmentAction } from '../../actions';
import { loadApartmentPage } from '../../data';

/**
 * Modification d'un appartement (MVP-BACKLOG-022).
 *
 * L'écran est inatteignable pour qui ne porte pas la permission, et pour un
 * logement archivé ou dont l'immeuble l'est : sans ce contrôle, l'URL resterait
 * ouverte et afficherait un formulaire dont chaque soumission serait refusée.
 *
 * Le champ vidé EFFACE la valeur, il ne la laisse pas intacte : c'est la
 * sémantique du PATCH portée par les schémas, et c'est ce qu'attend un
 * utilisateur qui vient de supprimer le contenu d'un champ.
 */
export async function generateMetadata(
  props: PageProps<'/immeubles/[propertyId]/appartements/[apartmentId]/modifier'>,
) {
  const { propertyId, apartmentId } = await props.params;
  const { apartment } = await loadApartmentPage(propertyId, apartmentId);

  return { title: `Modifier ${apartment.number}` };
}

export default async function EditApartmentPage(
  props: PageProps<'/immeubles/[propertyId]/appartements/[apartmentId]/modifier'>,
) {
  const { propertyId, apartmentId } = await props.params;
  const { context, property, apartment } = await loadApartmentPage(propertyId, apartmentId);

  const allowed =
    can(context, 'apartment.update', {
      organizationId: property.organizationId,
      propertyId: property.id,
    }) &&
    !apartment.archived &&
    !property.archived;

  if (!allowed) notFound();

  const currency = await organizationDefaultCurrency(getDb(), property.organizationId);
  const fiche = `/immeubles/${property.id}/appartements/${apartment.id}`;

  const update = updateApartmentAction.bind(null, property.id, apartment.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Modifier ${apartment.number}`}
        description={property.name}
        back={{ href: fiche, label: apartment.number }}
      />

      <Card>
        <ApartmentForm
          action={update}
          apartment={apartment}
          currency={currency}
          submitLabel="Enregistrer les modifications"
          cancelHref={fiche}
        />
      </Card>
    </div>
  );
}
