import { notFound } from 'next/navigation';

import { ConfirmTenantActionForm } from '@/components/tenant/confirm-tenant-action-form';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { describeApartment, hasProductAccess } from '@/modules/tenants';

import { revokeTenantAction } from '../../actions';
import { loadTenantPage } from '../../data';

/**
 * Confirmation de révocation de l'accès d'un locataire (DEC-047).
 *
 * Structure imposée par la Component Specification section 45 : titre,
 * CONSÉQUENCE, action secondaire, action principale.
 *
 * La conséquence la plus importante est celle qui N'A PAS lieu, et c'est
 * exactement la confusion que DEC-047 veut écarter : **révoquer l'accès au
 * produit ne termine aucun bail**. Elle est donc écrite en premier et en clair,
 * avant la liste.
 *
 * Un accès déjà révoqué n'a rien à révoquer : la page n'existe pas pour lui.
 */
export async function generateMetadata() {
  return { title: "Révoquer l'accès" };
}

export default async function RevokeTenantPage(
  props: PageProps<'/locataires/[tenantId]/revoquer'>,
) {
  const { tenantId } = await props.params;
  const { organisation } = await props.searchParams;
  const requested = Array.isArray(organisation) ? organisation[0] : organisation;
  const tenant = await loadTenantPage(tenantId, requested);

  // Sans accès au produit, il n'y a rien à révoquer (DEC-051), et un accès déjà
  // révoqué n'a rien à révoquer non plus.
  if (!hasProductAccess(tenant) || tenant.status === 'REVOKED') notFound();

  // L'organisation voyage dans l'adresse : la ressource est le couple personne
  // et organisation (DEC-051), et le retour doit viser la bonne relation.
  const fiche = `/locataires/${tenant.id}?organisation=${tenant.organizationId}`;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={`Révoquer l'accès de ${tenant.fullName} ?`}
        description={describeApartment(tenant.apartment)}
        back={{ href: fiche, label: tenant.fullName }}
      />

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 text-sm text-ink">
          <p className="font-medium text-ink">
            Cette opération retire l&apos;accès au produit. Elle ne termine aucun bail.
          </p>
          <p>En révoquant cet accès :</p>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>la personne n&apos;a plus d&apos;espace locataire ;</li>
            <li>si elle n&apos;a aucun autre accès actif, ses sessions sont fermées ;</li>
            <li>son historique est conservé, et aucun compte n&apos;est supprimé ;</li>
            <li>
              <span className="font-medium text-ink">elle reste la locataire du logement</span> tant
              que son bail n&apos;est pas terminé, ce qui est une autre opération ;
            </li>
            <li>vous pourrez l&apos;inviter de nouveau, avec un nouveau lien.</li>
          </ul>
        </div>

        <ConfirmTenantActionForm
          action={revokeTenantAction.bind(null, tenant.id, tenant.organizationId)}
          cancelHref={fiche}
          submitLabel="Révoquer l'accès"
          pendingLabel="Révocation..."
        />
      </Card>
    </div>
  );
}
