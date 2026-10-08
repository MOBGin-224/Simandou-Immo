import { notFound } from 'next/navigation';

import { ApartmentForm } from '@/components/apartment/apartment-form';
import { BulkApartmentForm } from '@/components/apartment/bulk-apartment-form';
import { Card } from '@/components/ui/card';
import { Overline } from '@/components/ui/overline';
import { PageHeader } from '@/components/ui/page-header';
import { getDb } from '@/db/client';
import { can } from '@/lib/authorization';
import { organizationDefaultCurrency } from '@/modules/organizations';

import { loadPropertyPage } from '../../../data';
import { createApartmentAction, generateApartmentsAction } from '../actions';

/**
 * Création d'appartements (MVP-BACKLOG-022, parcours 3).
 *
 * Deux formulaires sur un même écran, et c'est délibéré. Le parcours 3 décrit
 * deux gestes distincts qui ne se remplacent pas : créer la STRUCTURE d'un
 * immeuble, ce qui se fait par série au moment de l'onboarding, et ajouter UN
 * logement, ce qui arrive ensuite. Les séparer en deux écrans obligerait à
 * choisir avant de savoir, alors que les deux tiennent sur une page.
 *
 * La création rapide vient en premier : c'est le geste du démarrage, et
 * l'immeuble qui n'a encore aucun logement est précisément celui qu'on vient
 * d'ouvrir.
 */
export const metadata = { title: 'Ajouter des appartements' };

export default async function NewApartmentPage(
  props: PageProps<'/immeubles/[propertyId]/appartements/nouveau'>,
) {
  const { propertyId } = await props.params;
  const { context, property } = await loadPropertyPage(propertyId);

  // L'écran n'est pas seulement masqué dans la navigation : il est inatteignable
  // pour qui ne porte pas la permission. Sans cela, l'URL resterait ouverte et
  // afficherait un formulaire dont chaque soumission serait refusée.
  const allowed =
    can(context, 'apartment.create', {
      organizationId: property.organizationId,
      propertyId: property.id,
    }) && !property.archived;

  if (!allowed) notFound();

  const currency = await organizationDefaultCurrency(getDb(), property.organizationId);
  const base = `/immeubles/${property.id}/appartements`;

  const generate = generateApartmentsAction.bind(null, property.id);
  const create = createApartmentAction.bind(null, property.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ajouter des appartements"
        description={property.name}
        back={{ href: base, label: 'Appartements' }}
      />

      <Card>
        <Overline>Créer une série</Overline>
        <p className="mt-2 mb-5 text-sm text-muted">
          Pour construire la structure d&apos;un immeuble d&apos;un seul geste. Les détails de
          chaque logement se complètent ensuite.
        </p>

        <BulkApartmentForm action={generate} />
      </Card>

      <Card>
        <Overline>Créer un logement</Overline>
        <p className="mt-2 mb-5 text-sm text-muted">
          Pour ajouter un seul appartement, avec ses caractéristiques.
        </p>

        <ApartmentForm
          action={create}
          currency={currency}
          submitLabel="Créer l'appartement"
          cancelHref={base}
        />
      </Card>
    </div>
  );
}
