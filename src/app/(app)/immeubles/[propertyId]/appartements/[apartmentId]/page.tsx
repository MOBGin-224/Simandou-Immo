import Link from 'next/link';

import { ApartmentStatusBadge, ArchivedBadge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { can } from '@/lib/authorization';
import { formatArea, formatDate, formatMoney } from '@/lib/ui/format';
import { describeFloor } from '@/modules/apartments';

import { loadApartmentPage } from '../data';

/**
 * Fiche d'un appartement (MVP-BACKLOG-023, Information Architecture niveau 3).
 *
 * Cette page est la CHARNIÈRE du produit. L'appartement est l'unité
 * opérationnelle : c'est à lui que se rattacheront le locataire, le bail, les
 * loyers, les paiements, les charges, les incidents et l'historique. La fiche
 * est donc construite dès maintenant comme un point de départ, avec ses
 * sections annoncées, et non comme un simple affichage de champs.
 *
 * Ce qui est absent est ANNONCÉ plutôt que laissé vide, afin qu'un écran
 * clairsemé se lise comme « à venir » et non comme « cassé ». Chaque section
 * nomme le lot qui la remplira : l'utilisateur sait ce qu'il attend, et le
 * développeur suivant sait où brancher.
 *
 * Les actions n'apparaissent que si l'utilisateur les porte réellement
 * (PermissionGuard, section 68) : proposer « Modifier » à qui ne le peut pas
 * produirait un refus, donc une impasse. Le masquage n'est pas la sécurité, que
 * le cas d'usage assure de son côté ; c'est une question d'honnêteté de
 * l'interface.
 */
export async function generateMetadata(
  props: PageProps<'/immeubles/[propertyId]/appartements/[apartmentId]'>,
) {
  const { propertyId, apartmentId } = await props.params;
  const { apartment, property } = await loadApartmentPage(propertyId, apartmentId);

  return { title: `${apartment.number} · ${property.name}` };
}

/** Sections que les lots suivants viendront garnir (MVP-BACKLOG-023). */
const UPCOMING_SECTIONS = [
  {
    title: 'Locataire et bail',
    description: 'Le locataire en place et son contrat apparaîtront ici, au lot Contrats.',
  },
  {
    title: 'Loyers et paiements',
    description:
      'Les échéances, leur état et les paiements reçus apparaîtront ici, aux lots Loyers et Paiements.',
  },
  {
    title: 'Charges',
    description: 'La part de charges affectée à ce logement apparaîtra ici, au lot Charges.',
  },
  {
    title: 'Incidents et interventions',
    description:
      'Les incidents signalés et les interventions menées apparaîtront ici, aux lots Incidents et Interventions.',
  },
  {
    title: 'Historique',
    description:
      "L'historique des occupants et des opérations apparaîtra ici, au lot Activity et Audit.",
  },
] as const;

export default async function ApartmentDetailPage(
  props: PageProps<'/immeubles/[propertyId]/appartements/[apartmentId]'>,
) {
  const { propertyId, apartmentId } = await props.params;
  const { context, property, apartment } = await loadApartmentPage(propertyId, apartmentId);

  const resource = { organizationId: property.organizationId, propertyId: property.id };
  const canUpdate =
    can(context, 'apartment.update', resource) && !apartment.archived && !property.archived;

  /*
   * DEC-039 : l'archivage est reserve au proprietaire, retirer un logement de
   * l'exploitation etant un acte patrimonial. L'action est donc masquee pour un
   * gestionnaire, qui obtiendrait un refus, et pour un logement deja archive ou
   * dont l'immeuble l'est.
   */
  const canArchive =
    can(context, 'apartment.archive', resource) && !apartment.archived && !property.archived;

  const base = `/immeubles/${property.id}/appartements`;

  const details: { label: string; value: string }[] = [
    { label: 'Étage', value: describeFloor(apartment.floor) ?? 'Non renseigné' },
    { label: 'Type', value: apartment.type ?? 'Non renseigné' },
    {
      label: 'Surface',
      value: apartment.area === null ? 'Non renseignée' : formatArea(apartment.area),
    },
    {
      label: 'Loyer de référence',
      value: apartment.referenceRent
        ? formatMoney(apartment.referenceRent.amount, apartment.referenceRent.currency)
        : 'Non fixé',
    },
    { label: 'Créé le', value: formatDate(apartment.createdAt) },
  ];

  if (apartment.archived && apartment.archivedAt) {
    details.push({ label: 'Archivé le', value: formatDate(apartment.archivedAt) });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={apartment.number}
        description={property.name}
        back={{ href: base, label: 'Appartements' }}
        actions={
          canUpdate ? (
            <Link
              href={`${base}/${apartment.id}/modifier`}
              className={buttonClasses('secondary', 'md')}
            >
              Modifier
            </Link>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <ApartmentStatusBadge status={apartment.status} />
        {apartment.archived ? <ArchivedBadge /> : null}
      </div>

      {property.archived && !apartment.archived ? (
        <Card className="border-warning/30 bg-warning/5">
          <p className="text-sm text-ink">
            L&apos;immeuble est archivé. Ce logement reste consultable, mais il ne peut plus être
            modifié.
          </p>
        </Card>
      ) : null}

      <Card>
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
          Caractéristiques
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          {details.map((detail) => (
            <div key={detail.label} className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-muted">{detail.label}</dt>
              <dd className="text-sm text-ink">{detail.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {UPCOMING_SECTIONS.map((section) => (
        <Card key={section.title}>
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
            {section.title}
          </h2>
          <p className="mt-3 text-sm text-muted">{section.description}</p>
        </Card>
      ))}

      {canArchive ? (
        <Card>
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
            Retirer de l&apos;exploitation
          </h2>
          <p className="mt-2 text-sm text-muted">
            L&apos;archivage conserve tout l&apos;historique du logement et bloque ses opérations
            futures.
          </p>
          <Link
            href={`${base}/${apartment.id}/archiver`}
            className={`${buttonClasses('secondary', 'md')} mt-4`}
          >
            Archiver cet appartement
          </Link>
        </Card>
      ) : null}
    </div>
  );
}
