import { notFound } from 'next/navigation';

import { ConfirmManagerActionForm } from '@/components/manager/confirm-manager-action-form';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';

import { suspendManagerAction } from '../../actions';
import { loadManagerPage } from '../../data';

/**
 * Confirmation de suspension d'un gestionnaire (DEC-044).
 *
 * Structure imposée par la Component Specification section 45 : titre,
 * CONSÉQUENCE, action secondaire, action principale. Les conséquences sont écrites
 * en clair, et elles sont vraies : l'accès est bloqué à la prochaine action de la
 * personne, le périmètre est CONSERVÉ, et la réactivation restitue le même accès.
 *
 * Elle ne ferme pas la session et ne touche pas aux accès de la personne chez
 * d'autres propriétaires : la suspension ne concerne que ce rattachement-ci.
 *
 * Seul un accès actif se suspend : pour tout autre état, la page n'existe pas.
 */
export async function generateMetadata() {
  return { title: "Suspendre l'accès" };
}

export default async function SuspendManagerPage(
  props: PageProps<'/gestionnaires/[managerId]/suspendre'>,
) {
  const { managerId } = await props.params;
  const manager = await loadManagerPage(managerId);

  if (manager.status !== 'ACTIVE') notFound();

  const fiche = `/gestionnaires/${manager.id}`;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={`Suspendre ${manager.fullName} ?`}
        description={manager.phone ?? undefined}
        back={{ href: fiche, label: manager.fullName }}
      />

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 text-sm text-ink">
          <p>En suspendant cet accès :</p>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>la personne ne voit plus vos immeubles dès sa prochaine action ;</li>
            <li>son périmètre est conservé, rien n&apos;est effacé ;</li>
            <li>vous pourrez la réactiver, et elle retrouvera exactement le même accès ;</li>
            <li>son compte, et ses accès chez d&apos;autres propriétaires, ne changent pas.</li>
          </ul>
        </div>

        <ConfirmManagerActionForm
          action={suspendManagerAction.bind(null, manager.id)}
          cancelHref={fiche}
          submitLabel="Suspendre l'accès"
          pendingLabel="Suspension..."
        />
      </Card>
    </div>
  );
}
