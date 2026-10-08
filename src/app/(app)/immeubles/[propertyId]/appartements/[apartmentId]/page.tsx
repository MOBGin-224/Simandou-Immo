import Link from 'next/link';

import {
  AccessStatusBadge,
  ApartmentMaintenanceBadge,
  ApartmentOccupancyBadge,
  ArchivedBadge,
} from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Overline } from '@/components/ui/overline';
import { PageHeader } from '@/components/ui/page-header';
import { getDb } from '@/db/client';
import { can } from '@/lib/authorization';
import { formatArea, formatDate, formatMoney } from '@/lib/ui/format';
import { describeFloor } from '@/modules/apartments';
import { describePeriod, listLeases } from '@/modules/leases';
import { listTenants } from '@/modules/tenants';

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

  /*
   * Locataires de CE logement (DEC-046, parcours 7).
   *
   * L'Information Architecture exige que « Locataires » et « Immeuble, Appartement,
   * Locataire » conduisent à la même donnée : la liste est donc la même, filtrée
   * sur ce logement. Un logement archivé n'accueille plus de locataire (BR-025).
   */
  const canInviteTenant =
    can(context, 'tenant.invite', resource) && !apartment.archived && !property.archived;
  const tenants = can(context, 'tenant.read', resource)
    ? (await listTenants(getDb(), context, { apartmentId: apartment.id })).tenants
    : [];

  /*
   * Baux de CE logement (BR-027, Database Schema section 18).
   *
   * L'historique locatif se reconstruit des baux et n'est pas dupliqué : la liste
   * des baux du logement EST son historique, le bail en cours en tête.
   */
  const leases = can(context, 'lease.read', resource)
    ? (await listLeases(getDb(), context, { apartmentId: apartment.id })).leases
    : [];
  const activeLease = leases.find((lease) => lease.status === 'ACTIVE') ?? null;
  const canCreateLease =
    can(context, 'lease.create', resource) &&
    activeLease === null &&
    !apartment.archived &&
    !property.archived;

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
        <ApartmentOccupancyBadge occupancy={apartment.occupancy} />
        {apartment.underMaintenance ? <ApartmentMaintenanceBadge /> : null}
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
        <Overline>Caractéristiques</Overline>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          {details.map((detail) => (
            <div key={detail.label} className="flex flex-col gap-0.5">
              <Overline as="dt">{detail.label}</Overline>
              <dd className="text-sm text-ink">{detail.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <Overline>Bail</Overline>

        {activeLease ? (
          <dl className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <Overline as="dt">En cours</Overline>
              <dd className="text-sm text-ink">
                <Link
                  href={`/baux/${activeLease.id}`}
                  className="inline-flex min-h-11 items-center break-words text-action-strong underline underline-offset-4 hover:text-brand"
                >
                  {activeLease.tenant.fullName}
                </Link>
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <Overline as="dt">Loyer</Overline>
              <dd className="text-sm text-ink">
                {formatMoney(activeLease.rent.amount, activeLease.rent.currency)} par mois, le{' '}
                {activeLease.dueDay}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <Overline as="dt">Période</Overline>
              <dd className="text-sm text-ink">{describePeriod(activeLease, formatDate)}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-muted">Aucun bail en cours sur ce logement.</p>
        )}

        {canCreateLease ? (
          <Link
            href={`/baux/nouveau?logement=${apartment.id}`}
            className={`${buttonClasses('secondary', 'md')} mt-4`}
          >
            Créer un bail
          </Link>
        ) : null}

        {leases.length > 0 ? (
          <div className="mt-4 flex flex-col gap-1">
            <Overline as="span">Historique du logement</Overline>
            <ul className="flex flex-col gap-0.5 text-sm text-muted">
              {leases
                .filter((lease) => lease.status !== 'ACTIVE')
                .map((lease) => (
                  <li key={lease.id}>
                    <Link
                      href={`/baux/${lease.id}`}
                      className="inline-flex min-h-11 items-center break-words text-action-strong underline underline-offset-4 hover:text-brand"
                    >
                      {lease.tenant.fullName}, {describePeriod(lease, formatDate)}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <Card>
        <Overline>Locataires</Overline>

        {tenants.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-3">
            {tenants.map((item) => (
              <li key={item.id} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  {/*
                    `min-h-11` : une ligne de texte de 20 px de haut est une cible
                    trop petite pour un doigt, et la vérification mobile le relève
                    (MVP-UI-001). La hauteur minimale de 44 px est portée par le lien
                    lui-même, et non par la ligne, pour que la zone touchable soit
                    bien celle que l'on voit.
                  */}
                  {/* Une seule fiche par personne depuis DEC-051 : l'invitation en
                      attente n'est plus un élément à part, c'est un état. */}
                  <Link
                    href={`/locataires/${item.id}`}
                    className="inline-flex min-h-11 items-center break-words text-sm font-medium text-action-strong underline underline-offset-4 hover:text-brand"
                  >
                    {item.fullName}
                  </Link>
                  <AccessStatusBadge status={item.status} />
                </div>
                {item.phone ? <span className="text-xs text-muted">{item.phone}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Aucun locataire rattaché à ce logement pour le moment.
          </p>
        )}

        {canInviteTenant ? (
          <Link
            href={`/locataires/inviter?logement=${apartment.id}`}
            className={`${buttonClasses('secondary', 'md')} mt-4`}
          >
            Inviter un locataire
          </Link>
        ) : null}

        <p className="mt-4 text-xs text-muted">
          Le bail, la date d&apos;entrée et le loyer sont dans la section Bail, ci-dessus.
        </p>
      </Card>

      {UPCOMING_SECTIONS.map((section) => (
        <Card key={section.title}>
          <Overline>{section.title}</Overline>
          <p className="mt-3 text-sm text-muted">{section.description}</p>
        </Card>
      ))}

      {canArchive ? (
        <Card>
          <Overline>Retirer de l&apos;exploitation</Overline>
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
