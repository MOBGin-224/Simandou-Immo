import { notFound } from 'next/navigation';

import { ConfirmTenantActionForm } from '@/components/tenant/confirm-tenant-action-form';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { describeApartment } from '@/modules/tenants';

import { suspendTenantAction } from '../../actions';
import { loadTenantPage } from '../../data';

/**
 * Confirmation de suspension de l'accès d'un locataire (DEC-047).
 *
 * Structure imposée par la Component Specification section 45 : titre,
 * CONSÉQUENCE, action secondaire, action principale. Les conséquences sont
 * écrites en clair, et elles sont vraies : l'espace locataire se referme à la
 * prochaine action de la personne, et le bail n'est pas touché.
 *
 * La dernière ligne est celle que DEC-047 veut rendre impossible à confondre :
 * retirer l'accès au produit ne termine jamais le bail.
 *
 * Seul un accès actif se suspend : pour tout autre état, la page n'existe pas.
 */
export async function generateMetadata() {
  return { title: "Suspendre l'accès" };
}

export default async function SuspendTenantPage(
  props: PageProps<'/locataires/[tenantId]/suspendre'>,
) {
  const { tenantId } = await props.params;
  const { organisation } = await props.searchParams;
  const requested = Array.isArray(organisation) ? organisation[0] : organisation;
  const tenant = await loadTenantPage(tenantId, requested);

  if (tenant.status !== 'ACTIVE') notFound();

  // L'organisation voyage dans l'adresse : la ressource est le couple personne
  // et organisation (DEC-051), et le retour doit viser la bonne relation.
  const fiche = `/locataires/${tenant.id}?organisation=${tenant.organizationId}`;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={`Suspendre ${tenant.fullName} ?`}
        description={describeApartment(tenant.apartment)}
        back={{ href: fiche, label: tenant.fullName }}
      />

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 text-sm text-ink">
          <p>En suspendant cet accès :</p>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>la personne ne peut plus ouvrir son espace locataire ;</li>
            <li>vous pourrez la réactiver, et elle retrouvera le même accès ;</li>
            <li>son compte, et ses accès chez d&apos;autres bailleurs, ne changent pas ;</li>
            <li>
              <span className="font-medium text-ink">aucun bail n&apos;est terminé</span> : elle
              reste la locataire du logement.
            </li>
          </ul>
        </div>

        <ConfirmTenantActionForm
          action={suspendTenantAction.bind(null, tenant.id, tenant.organizationId)}
          cancelHref={fiche}
          submitLabel="Suspendre l'accès"
          pendingLabel="Suspension..."
        />
      </Card>
    </div>
  );
}
