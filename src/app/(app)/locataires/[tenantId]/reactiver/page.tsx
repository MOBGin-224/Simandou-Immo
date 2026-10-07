import { notFound } from 'next/navigation';

import { ConfirmTenantActionForm } from '@/components/tenant/confirm-tenant-action-form';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { describeApartment } from '@/modules/tenants';

import { reactivateTenantAction } from '../../actions';
import { loadTenantPage } from '../../data';

/**
 * Confirmation de réactivation de l'accès d'un locataire (DEC-047).
 *
 * Même structure que la suspension, mais SANS le ton destructif : rendre un accès
 * n'est pas une perte. Le bouton principal est donc celui d'une action ordinaire.
 *
 * Seul un accès SUSPENDU se réactive : pour tout autre état, la page n'existe
 * pas. Un accès révoqué ne se réactive jamais, c'est la réinvitation qui le fait
 * revenir (DEC-043).
 */
export async function generateMetadata() {
  return { title: "Réactiver l'accès" };
}

export default async function ReactivateTenantPage(
  props: PageProps<'/locataires/[tenantId]/reactiver'>,
) {
  const { tenantId } = await props.params;
  const tenant = await loadTenantPage(tenantId);

  if (tenant.status !== 'SUSPENDED') notFound();

  const fiche = `/locataires/${tenant.id}`;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={`Réactiver ${tenant.fullName} ?`}
        description={describeApartment(tenant.apartment)}
        back={{ href: fiche, label: tenant.fullName }}
      />

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 text-sm text-ink">
          <p>En réactivant cet accès :</p>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>la personne retrouve son espace locataire dès sa prochaine visite ;</li>
            <li>elle se connecte avec le mot de passe qu&apos;elle avait déjà ;</li>
            <li>vous pourrez la suspendre de nouveau si besoin.</li>
          </ul>
        </div>

        <ConfirmTenantActionForm
          action={reactivateTenantAction.bind(null, tenant.id)}
          cancelHref={fiche}
          submitLabel="Réactiver l'accès"
          pendingLabel="Réactivation..."
          variant="primary"
        />
      </Card>
    </div>
  );
}
