import { notFound } from 'next/navigation';

import { ConfirmManagerActionForm } from '@/components/manager/confirm-manager-action-form';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';

import { reactivateManagerAction } from '../../actions';
import { loadManagerPage } from '../../data';

/**
 * Confirmation de réactivation d'un gestionnaire suspendu (DEC-044).
 *
 * La réactivation RESTITUE un accès : le bouton n'est donc pas rouge, à la
 * différence de la suspension et de la révocation. La page dit pourtant ce qui va se
 * passer, et sur quels immeubles : rendre un accès est une décision, pas un
 * rétablissement automatique.
 *
 * Seul un accès suspendu se réactive. Un accès révoqué ne se réactive jamais, il
 * revient par la réinvitation (DEC-043) : pour lui, la page n'existe pas.
 */
export async function generateMetadata() {
  return { title: "Réactiver l'accès" };
}

export default async function ReactivateManagerPage(
  props: PageProps<'/gestionnaires/[managerId]/reactiver'>,
) {
  const { managerId } = await props.params;
  const manager = await loadManagerPage(managerId);

  if (manager.status !== 'SUSPENDED') notFound();

  const fiche = `/gestionnaires/${manager.id}`;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={`Réactiver ${manager.fullName} ?`}
        description={manager.phone ?? undefined}
        back={{ href: fiche, label: manager.fullName }}
      />

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 text-sm text-ink">
          <p>En réactivant cet accès :</p>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>la personne retrouve l&apos;accès qu&apos;elle avait, dès sa prochaine action ;</li>
            <li>
              elle revoit exactement les mêmes immeubles :{' '}
              <span className="font-medium text-ink">
                {manager.properties.length > 0
                  ? manager.properties.map((property) => property.name).join(', ')
                  : 'aucun'}
              </span>
              .
            </li>
          </ul>
        </div>

        <ConfirmManagerActionForm
          action={reactivateManagerAction.bind(null, manager.id)}
          cancelHref={fiche}
          submitLabel="Réactiver l'accès"
          pendingLabel="Réactivation..."
          variant="primary"
        />
      </Card>
    </div>
  );
}
