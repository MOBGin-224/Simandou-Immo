import Link from 'next/link';

import { PropertyStatusBadge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Overline } from '@/components/ui/overline';
import { PageHeader } from '@/components/ui/page-header';
import { can } from '@/lib/authorization';
import { formatDate, pluralize } from '@/lib/ui/format';

import { loadPropertyPage } from '../data';

/**
 * Fiche d'un immeuble (MVP-BACKLOG-018, Information Architecture niveau 2).
 *
 * Les actions n'apparaissent que si l'utilisateur les porte réellement
 * (PermissionGuard, section 68) : proposer « Archiver » à un gestionnaire
 * produirait un refus, donc une impasse. Le masquage n'est pas la sécurité, que le
 * cas d'usage assure de son côté ; c'est une question d'honnêteté de l'interface.
 *
 * Les charges, la maintenance et l'activité viendront garnir cette page aux lots
 * suivants. Ce qui est absent est annoncé plutôt que laissé vide, afin qu'un
 * écran clairsemé se lise comme « à venir » et non comme « cassé ».
 */
/**
 * Titre de l'onglet : le nom de l'immeuble.
 *
 * Sans lui, tous les onglets de fiche s'appellent « SIMANDOU IMMO » et
 * deviennent indistinguables dès qu'on en ouvre deux. La lecture ne coûte rien
 * de plus : elle est mémorisée pour la durée de la requête et partagée avec la
 * page (voir `loadPropertyPage`).
 */
export async function generateMetadata(props: PageProps<'/immeubles/[propertyId]'>) {
  const { propertyId } = await props.params;
  const { property } = await loadPropertyPage(propertyId);

  return { title: property.name };
}

export default async function PropertyDetailPage(props: PageProps<'/immeubles/[propertyId]'>) {
  const { propertyId } = await props.params;
  const { context, property } = await loadPropertyPage(propertyId);

  const resource = { organizationId: property.organizationId, propertyId: property.id };
  const canUpdate = can(context, 'property.update', resource) && !property.archived;
  const canArchive = can(context, 'property.archive', resource) && !property.archived;

  const details: { label: string; value: string }[] = [
    { label: 'Quartier', value: property.district ?? 'Non renseigné' },
    { label: 'Ville', value: property.city ?? 'Non renseignée' },
    { label: 'Adresse', value: property.address ?? 'Non renseignée' },
    { label: 'Créé le', value: formatDate(property.createdAt) },
  ];

  if (property.archived && property.archivedAt) {
    details.push({ label: 'Archivé le', value: formatDate(property.archivedAt) });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={property.name}
        description={property.location ?? undefined}
        back={{ href: '/immeubles', label: 'Immeubles' }}
        actions={
          canUpdate ? (
            <Link
              href={`/immeubles/${property.id}/modifier`}
              className={buttonClasses('secondary', 'md')}
            >
              Modifier
            </Link>
          ) : undefined
        }
      />

      {property.archived ? (
        <Card className="border-warning/30 bg-warning/5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <PropertyStatusBadge archived />
            </div>
            <p className="text-sm text-ink">
              Cet immeuble est archivé. Son historique reste consultable, mais il ne peut plus être
              modifié.
            </p>
          </div>
        </Card>
      ) : null}

      <Card>
        <Overline>Informations générales</Overline>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          {details.map((detail) => (
            <div key={detail.label} className="flex flex-col gap-0.5">
              <Overline as="dt">{detail.label}</Overline>
              <dd className="text-sm text-ink">{detail.value}</dd>
            </div>
          ))}
        </dl>

        {property.description ? (
          <div className="mt-4 flex flex-col gap-0.5">
            <Overline as="p">Description</Overline>
            <p className="whitespace-pre-line text-sm text-ink">{property.description}</p>
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Overline>Appartements</Overline>

          <Link
            href={`/immeubles/${property.id}/appartements`}
            className="min-h-11 text-sm text-action-strong underline underline-offset-4 hover:text-brand"
          >
            {property.occupancy.apartmentCount === 0
              ? 'Ajouter des logements'
              : 'Voir les logements'}
          </Link>
        </div>

        {property.occupancy.apartmentCount === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Aucun logement enregistré. La structure de l&apos;immeuble reste à construire.
          </p>
        ) : (
          <p className="mt-3 text-sm text-ink">
            {pluralize(property.occupancy.apartmentCount, 'logement')}
            {/* « dont » se rattache au TOTAL : les travaux chevauchent l'occupation (DEC-050). */}
            {property.occupancy.maintenanceCount > 0
              ? `, dont ${property.occupancy.maintenanceCount} en travaux`
              : ''}
            <span className="text-muted">
              {' : '}
              {property.occupancy.occupiedCount} occupé
              {property.occupancy.occupiedCount > 1 ? 's' : ''}, {property.occupancy.vacantCount}{' '}
              vacant{property.occupancy.vacantCount > 1 ? 's' : ''}
            </span>
          </p>
        )}
      </Card>

      {canArchive ? (
        <Card>
          <Overline>Retirer de l&apos;exploitation</Overline>
          <p className="mt-2 text-sm text-muted">
            L&apos;archivage conserve tout l&apos;historique de l&apos;immeuble et bloque ses
            opérations futures.
          </p>
          <Link
            href={`/immeubles/${property.id}/archiver`}
            className={`${buttonClasses('secondary', 'md')} mt-4`}
          >
            Archiver cet immeuble
          </Link>
        </Card>
      ) : null}
    </div>
  );
}
