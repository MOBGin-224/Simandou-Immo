import { notFound } from 'next/navigation';

import { ArchivePropertyForm } from '@/components/property/archive-property-form';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { can } from '@/lib/authorization';
import { pluralize } from '@/lib/ui/format';

import { archivePropertyAction } from '../../actions';
import { loadPropertyOrNotFound } from '../../data';

/**
 * Confirmation d'archivage (Component Specification section 45, BR-025).
 *
 * Structure imposée : titre, CONSÉQUENCE, action secondaire, action principale. La
 * conséquence est écrite en clair, et elle est vraie : rien n'est supprimé, et
 * l'immeuble reste consultable.
 *
 * Une page plutôt qu'une boîte de dialogue. Sur un téléphone, une confirmation en
 * plein écran est plus lisible qu'une fenêtre superposée, elle est atteignable au
 * clavier, elle fonctionne sans JavaScript, et son adresse est partageable.
 *
 * Réservé au propriétaire (DEC-025) : un gestionnaire qui atteindrait cette adresse
 * obtient « introuvable », pas un formulaire qui échouerait à la soumission.
 */
export const metadata = { title: 'Archiver un immeuble' };

export default async function ArchivePropertyPage(
  props: PageProps<'/immeubles/[propertyId]/archiver'>,
) {
  const context = await requireAccessContextOrSignIn();
  const { propertyId } = await props.params;
  const property = await loadPropertyOrNotFound(context, propertyId);

  const allowed = can(context, 'property.archive', {
    organizationId: property.organizationId,
    propertyId: property.id,
  });

  if (!allowed || property.archived) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Archiver cet immeuble ?"
        description={property.name}
        back={{ href: `/immeubles/${property.id}`, label: property.name }}
      />

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 text-sm text-ink">
          <p>En archivant cet immeuble :</p>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>il quitte la liste des immeubles actifs ;</li>
            <li>tout son historique reste consultable ;</li>
            <li>il ne peut plus être modifié ;</li>
            {/*
              Ligne omise quand l'immeuble n'a aucun logement : « ses 0 logement
              ne sont pas supprimés » rassure sur une chose qui n'existe pas, et
              se lit comme un défaut du produit.
            */}
            {property.occupancy.apartmentCount > 0 ? (
              <li>
                ses {pluralize(property.occupancy.apartmentCount, 'logement')} ne sont pas
                supprimés.
              </li>
            ) : null}
          </ul>
          <p>Rien n&apos;est effacé, et cette opération n&apos;a pas de retour automatique.</p>
        </div>

        <ArchivePropertyForm
          action={archivePropertyAction.bind(null, property.id)}
          cancelHref={`/immeubles/${property.id}`}
        />
      </Card>
    </div>
  );
}
