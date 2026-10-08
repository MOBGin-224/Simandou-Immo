import Link from 'next/link';
import { notFound } from 'next/navigation';

import { LeaseForm, type ApartmentChoice, type TenantChoice } from '@/components/lease/lease-form';
import { buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { readablePropertyScopes } from '@/lib/authorization';
import { describeApartment, listLeasableApartments } from '@/modules/leases';
import { organizationDefaultCurrency } from '@/modules/organizations';
import { listTenants } from '@/modules/tenants';

import { createLeaseAction } from '../actions';

/**
 * Création d'un bail (parcours 11, MVP-BACKLOG-035).
 *
 * L'écran est refusé d'emblée à qui ne porte `lease.create` sur aucun immeuble :
 * sans périmètre, la page n'existe pas pour cet utilisateur. Cela évite de
 * laisser remplir un formulaire qui serait rejeté à la fin.
 *
 * **Seuls les logements SANS bail en cours sont proposés** : en proposer un déjà
 * loué ferait remplir un formulaire que BR-028 rejetterait. Et seules les
 * personnes déjà invitées comme locataires : le bail s'appuie sur ce que le Lot 7
 * produit, et créer la personne depuis le bail est l'étape qui vient ensuite.
 *
 * Le logement peut venir du parcours, par `?logement=`, quand on arrive depuis sa
 * fiche. Il est alors imposé et affiché, et son loyer de référence prérenseigne
 * le montant.
 */
export const metadata = { title: 'Créer un bail' };

export default async function NewLeasePage(props: PageProps<'/baux/nouveau'>) {
  const context = await requireAccessContextOrSignIn();
  const scopes = readablePropertyScopes(context, 'lease.create');

  if (scopes.length === 0) notFound();

  const searchParams = await props.searchParams;
  const requested = Array.isArray(searchParams.logement)
    ? searchParams.logement[0]
    : searchParams.logement;

  const leasable = await listLeasableApartments(getDb(), context);

  /*
   * Toute personne connue de l'organisation comme locataire, quel que soit son
   * accès au produit (DEC-051) : un accès suspendu, révoqué ou absent n'empêche
   * pas d'occuper un logement. Même une personne encore invitée peut recevoir un
   * bail, l'identité métier existant dès l'invitation.
   *
   * Une liste VIDE n'empêche plus de créer un bail depuis le Lot 8b : le
   * formulaire propose alors de décrire la personne, qu'il crée (DEC-051 point 8).
   * C'est pourquoi le seul état bloquant restant est l'absence de logement.
   */
  const tenants = await listTenants(getDb(), context, { pageSize: 100 });
  const tenantChoices: TenantChoice[] = tenants.tenants.map((item) => ({
    id: item.id,
    label: item.phone ? `${item.fullName} (${item.phone})` : item.fullName,
  }));

  const apartmentChoices: ApartmentChoice[] = leasable.map((apartment) => ({
    id: apartment.id,
    label: describeApartment(apartment),
    referenceRent: apartment.referenceRent,
  }));

  const fixedApartmentId = apartmentChoices.some((choice) => choice.id === requested)
    ? requested
    : undefined;

  const currency = await organizationDefaultCurrency(getDb(), scopes[0]?.organizationId ?? '');

  const missing =
    apartmentChoices.length === 0
      ? {
          title: 'Aucun logement disponible',
          description:
            'Un bail porte sur un logement sans bail en cours. Créez un logement, ou clôturez le bail qui occupe celui que vous visez.',
          href: '/immeubles',
          label: 'Voir mes immeubles',
        }
      : null;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Créer un bail"
        description="Le bail rattache un locataire à un logement, avec son loyer et sa date de début. C'est lui qui fera naître les loyers à payer."
        back={{ href: '/baux', label: 'Baux' }}
      />

      {missing ? (
        <EmptyState
          title={missing.title}
          description={missing.description}
          action={
            <Link href={missing.href} className={buttonClasses('primary', 'md')}>
              {missing.label}
            </Link>
          }
        />
      ) : (
        <LeaseForm
          action={createLeaseAction}
          cancelHref="/baux"
          submitLabel="Créer le bail"
          pendingLabel="Création..."
          defaultCurrency={currency}
          apartments={apartmentChoices}
          tenants={tenantChoices}
          fixedApartmentId={fixedApartmentId}
        />
      )}
    </div>
  );
}
