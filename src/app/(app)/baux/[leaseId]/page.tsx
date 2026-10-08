import Link from 'next/link';

import { Alert } from '@/components/ui/alert';
import { LeaseStatusBadge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Overline } from '@/components/ui/overline';
import { PageHeader } from '@/components/ui/page-header';
import { formatDate, formatMoney } from '@/lib/ui/format';
import { describeApartment, describePeriod, isEditable } from '@/modules/leases';

import { loadLeasePage } from '../data';

/**
 * Fiche d'un bail (MVP-BACKLOG-035, Component Specification section 27).
 *
 * La section 27 l'exige : le contrat doit se lire comme une RELATION LOCATIVE et
 * non comme un document. La fiche mène donc par les deux termes de la relation,
 * le locataire et son logement, et chacun est un lien vers sa propre fiche :
 * l'Information Architecture veut que « Locataires » et « Immeuble, Appartement,
 * Locataire » conduisent à la même donnée.
 *
 * Deux décisions possibles, selon l'état :
 *
 * ```text
 * ACTIVE   modifier le loyer et les dates, clôturer
 * ENDED    rien : le bail décrit ce qui a eu lieu
 * ```
 *
 * Ce qui n'existe pas encore est ANNONCÉ plutôt que laissé vide : les loyers
 * naîtront de ce bail au lot Loyers, et l'écran le dit, pour qu'un gestionnaire
 * ne cherche pas un bouton absent.
 */
export async function generateMetadata(props: PageProps<'/baux/[leaseId]'>) {
  const { leaseId } = await props.params;
  const lease = await loadLeasePage(leaseId);

  return { title: `Bail de ${lease.tenant.fullName}` };
}

export default async function LeasePage(props: PageProps<'/baux/[leaseId]'>) {
  const { leaseId } = await props.params;
  const lease = await loadLeasePage(leaseId);

  const base = `/baux/${lease.id}`;
  const editable = isEditable(lease);

  const details: { label: string; value: string }[] = [
    { label: 'Période', value: describePeriod(lease, formatDate) },
    { label: 'Loyer mensuel', value: formatMoney(lease.rent.amount, lease.rent.currency) },
    { label: "Jour d'échéance", value: `Le ${lease.dueDay} de chaque mois` },
    {
      label: 'Caution',
      value:
        lease.deposit.amount === 0
          ? 'Aucune'
          : formatMoney(lease.deposit.amount, lease.deposit.currency),
    },
  ];

  if (lease.terminatedAt) {
    details.push({ label: 'Clôturé le', value: formatDate(lease.terminatedAt) });
  }

  if (lease.terminationReason) {
    details.push({ label: 'Raison de la clôture', value: lease.terminationReason });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={lease.tenant.fullName}
        description={describeApartment(lease.apartment)}
        back={{ href: '/baux', label: 'Baux' }}
        actions={
          editable ? (
            <Link href={`${base}/modifier`} className={buttonClasses('secondary', 'md')}>
              Modifier
            </Link>
          ) : undefined
        }
      />

      <div>
        <LeaseStatusBadge status={lease.status} />
      </div>

      {lease.status === 'ENDED' ? (
        <Alert tone="info" title="Bail clôturé">
          Ce bail a pris fin le {lease.endDate ? formatDate(lease.endDate) : 'la date indiquée'}. Il
          reste consultable : c&apos;est de lui que se reconstruit l&apos;historique du logement.
          Aucun accès au produit n&apos;a été retiré au locataire.
        </Alert>
      ) : null}

      <Card className="flex flex-col gap-4">
        <Overline>La relation locative</Overline>

        <dl className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <Overline as="dt">Locataire</Overline>
            <dd className="break-words text-base text-ink">
              {/*
                Le lien part du `userId` et NON de `accessId`.
                `/locataires/:id` attend l'identité métier de la personne, c'est-à-dire
                un `users.id` (DEC-051) : passer l'identifiant de son droit d'accès
                donnait un UUID valide mais inconnu de `users`, donc « introuvable ».
                L'organisation est nommée, le bail la connaissant, ce qui évite le refus
                en 409 lorsque plusieurs organisations connaissent la même personne.

                Et le lien ne dépend PLUS de l'existence d'un accès : depuis DEC-051 une
                personne sans compte a bien une fiche locataire, et la masquer privait
                d'un chemin vers la seule personne qu'on veut justement joindre.
              */}
              <Link
                href={`/locataires/${lease.tenant.userId}?organisation=${lease.organizationId}`}
                className="inline-flex min-h-11 items-center text-action-strong underline underline-offset-4 hover:text-brand"
              >
                {lease.tenant.fullName}
              </Link>
              {lease.tenant.phone ? (
                <span className="block text-sm text-muted">{lease.tenant.phone}</span>
              ) : null}
            </dd>
          </div>

          <div className="flex flex-col gap-0.5">
            <Overline as="dt">Logement</Overline>
            <dd className="break-words text-base text-ink">
              <Link
                href={`/immeubles/${lease.apartment.propertyId}/appartements/${lease.apartment.id}`}
                className="inline-flex min-h-11 items-center text-action-strong underline underline-offset-4 hover:text-brand"
              >
                {describeApartment(lease.apartment)}
              </Link>
              {lease.apartment.archived ? (
                <span className="block text-sm text-muted">Logement archivé</span>
              ) : null}
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="flex flex-col gap-4">
        <Overline>Conditions</Overline>

        <dl className="flex flex-col gap-3">
          {details.map((detail) => (
            <div key={detail.label} className="flex flex-col gap-0.5">
              <Overline as="dt">{detail.label}</Overline>
              <dd className="break-words text-base text-ink">{detail.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="flex flex-col gap-3">
        <Overline>Loyers et paiements</Overline>
        <p className="text-sm text-muted">
          Les échéances de loyer naîtront de ce bail, puis les paiements reçus s&apos;y
          rattacheront. Elles apparaîtront ici, aux lots Loyers et Paiements.
        </p>
      </Card>

      {editable ? (
        <Card className="flex flex-col gap-5">
          <Overline>Mettre fin au bail</Overline>

          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">
              La clôture fixe la fin du bail et libère le logement. Le locataire garde son accès au
              produit : c&apos;est une autre opération.
            </p>
            <Link href={`${base}/cloturer`} className={buttonClasses('secondary', 'md', true)}>
              Clôturer le bail
            </Link>
          </div>
        </Card>
      ) : (
        <Link
          href={`/baux/nouveau?logement=${lease.apartment.id}`}
          className={buttonClasses('primary', 'md', true)}
        >
          Créer un nouveau bail sur ce logement
        </Link>
      )}
    </div>
  );
}
