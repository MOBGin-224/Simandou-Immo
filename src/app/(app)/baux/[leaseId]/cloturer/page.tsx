import { notFound } from 'next/navigation';

import { TerminateLeaseForm } from '@/components/lease/terminate-lease-form';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { describeApartment, isEditable, today } from '@/modules/leases';

import { terminateLeaseAction } from '../../actions';
import { loadLeasePage } from '../../data';

/**
 * Clôture d'un bail (API section 17, Component Specification section 45).
 *
 * Structure imposée par la section 45 : titre, CONSÉQUENCE, action secondaire,
 * action principale. Les conséquences sont écrites en clair, et elles sont
 * vraies : le logement redevient louable, la personne redevient libre de prendre
 * un autre logement du même bailleur, et son accès au produit n'est PAS touché.
 *
 * Cette dernière ligne est la frontière de DEC-047, vue depuis le bail : révoquer
 * un accès ne termine aucun bail, et clôturer un bail ne retire aucun accès.
 *
 * Un bail déjà clôturé n'a rien à clôturer : la page n'existe pas pour lui.
 */
export async function generateMetadata() {
  return { title: 'Clôturer le bail' };
}

export default async function TerminateLeasePage(props: PageProps<'/baux/[leaseId]/cloturer'>) {
  const { leaseId } = await props.params;
  const lease = await loadLeasePage(leaseId);

  if (!isEditable(lease)) notFound();

  const fiche = `/baux/${lease.id}`;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={`Clôturer le bail de ${lease.tenant.fullName} ?`}
        description={describeApartment(lease.apartment)}
        back={{ href: fiche, label: lease.tenant.fullName }}
      />

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 text-sm text-ink">
          <p>En clôturant ce bail :</p>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>la relation locative prend fin à la date que vous indiquez ;</li>
            <li>aucun loyer ne sera dû au-delà de cette date ;</li>
            <li>le logement redevient louable, et vous pourrez y créer un nouveau bail ;</li>
            <li>le bail reste consultable : il fait partie de l&apos;histoire du logement ;</li>
            <li>
              <span className="font-medium text-ink">
                son accès au produit n&apos;est pas touché
              </span>{' '}
              : retirer l&apos;accès est une autre opération, depuis sa fiche de locataire.
            </li>
          </ul>
        </div>

        <TerminateLeaseForm
          action={terminateLeaseAction.bind(null, lease.id)}
          cancelHref={fiche}
          defaultDate={today()}
          startDate={lease.startDate}
        />
      </Card>
    </div>
  );
}
