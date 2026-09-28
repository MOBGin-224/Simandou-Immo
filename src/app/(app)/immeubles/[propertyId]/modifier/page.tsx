import { notFound } from 'next/navigation';

import { PropertyForm } from '@/components/property/property-form';
import { PageHeader } from '@/components/ui/page-header';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { can } from '@/lib/authorization';

import { updatePropertyAction } from '../../actions';
import { loadPropertyOrNotFound } from '../../data';

/**
 * Modification d'un immeuble (MVP-BACKLOG-018).
 *
 * Le gestionnaire y a accès sur son périmètre : `property.update` fait partie de
 * ses capacités, contrairement à la création et à l'archivage (DEC-025).
 *
 * Un immeuble archivé n'est pas modifiable (BR-025) : la page renvoie donc
 * « introuvable » plutôt que d'afficher un formulaire dont chaque soumission
 * échouerait.
 */
export const metadata = { title: 'Modifier un immeuble' };

export default async function EditPropertyPage(
  props: PageProps<'/immeubles/[propertyId]/modifier'>,
) {
  const context = await requireAccessContextOrSignIn();
  const { propertyId } = await props.params;
  const property = await loadPropertyOrNotFound(context, propertyId);

  const allowed = can(context, 'property.update', {
    organizationId: property.organizationId,
    propertyId: property.id,
  });

  if (!allowed || property.archived) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Modifier l'immeuble"
        description={property.name}
        back={{ href: `/immeubles/${property.id}`, label: property.name }}
      />

      <PropertyForm
        action={updatePropertyAction.bind(null, property.id)}
        property={property}
        submitLabel="Enregistrer les modifications"
        cancelHref={`/immeubles/${property.id}`}
      />
    </div>
  );
}
