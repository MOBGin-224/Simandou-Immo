import { notFound } from 'next/navigation';

import { LeaseForm } from '@/components/lease/lease-form';
import { PageHeader } from '@/components/ui/page-header';
import { describeApartment, isEditable } from '@/modules/leases';

import { updateLeaseAction } from '../../actions';
import { loadLeasePage } from '../../data';

/**
 * Modification d'un bail (API section 17, BR-032).
 *
 * Ni le logement ni le locataire : ils DÉFINISSENT la relation locative, et en
 * changer un ferait un autre bail. Ils sont donc affichés et non ressaisis, et
 * l'écran dit la marche à suivre pour un changement d'occupant, clôturer puis
 * recréer, ce qui conserve l'historique du logement (BR-027).
 *
 * Un bail clôturé ne se modifie plus : la page n'existe pas pour lui, son contenu
 * décrivant ce qui a eu lieu.
 */
export async function generateMetadata() {
  return { title: 'Modifier le bail' };
}

export default async function EditLeasePage(props: PageProps<'/baux/[leaseId]/modifier'>) {
  const { leaseId } = await props.params;
  const lease = await loadLeasePage(leaseId);

  if (!isEditable(lease)) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Modifier le bail"
        description={`${lease.tenant.fullName}, ${describeApartment(lease.apartment)}`}
        back={{ href: `/baux/${lease.id}`, label: lease.tenant.fullName }}
      />

      <LeaseForm
        action={updateLeaseAction.bind(null, lease.id)}
        cancelHref={`/baux/${lease.id}`}
        submitLabel="Enregistrer"
        pendingLabel="Enregistrement..."
        defaultCurrency={lease.rent.currency}
        existing={{
          apartmentLabel: describeApartment(lease.apartment),
          tenantLabel: lease.tenant.fullName,
          startDate: lease.startDate,
          endDate: lease.endDate,
          rentAmount: lease.rent.amount,
          dueDay: lease.dueDay,
          depositAmount: lease.deposit.amount,
        }}
      />
    </div>
  );
}
