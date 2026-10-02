import { notFound } from 'next/navigation';

import { ConfirmManagerActionForm } from '@/components/manager/confirm-manager-action-form';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';

import { revokeManagerAction } from '../../actions';
import { loadManagerPage } from '../../data';

/**
 * Confirmation de révocation de l'accès d'un gestionnaire (MVP-FEAT-022, BR-019).
 *
 * C'est la décision la plus grave de ce lot, donc la page la plus explicite. Les
 * conséquences sont écrites en clair, et elles sont vraies :
 *
 *   - l'accès est retiré à la prochaine action de la personne ;
 *   - sa session est fermée, mais seulement si elle n'a plus d'accès nulle part ;
 *   - l'HISTORIQUE est conservé, ses actions passées restent à son nom ;
 *   - la révocation est définitive : pour lui rendre l'accès, il faut l'inviter de
 *     nouveau, avec un nouveau lien (DEC-043).
 *
 * Possible depuis un accès actif comme suspendu. Un accès déjà révoqué n'a plus rien
 * à révoquer : pour lui, la page n'existe pas.
 */
export async function generateMetadata() {
  return { title: "Révoquer l'accès" };
}

export default async function RevokeManagerPage(
  props: PageProps<'/gestionnaires/[managerId]/revoquer'>,
) {
  const { managerId } = await props.params;
  const manager = await loadManagerPage(managerId);

  if (manager.status === 'REVOKED') notFound();

  const fiche = `/gestionnaires/${manager.id}`;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={`Révoquer l'accès de ${manager.fullName} ?`}
        description={manager.phone ?? undefined}
        back={{ href: fiche, label: manager.fullName }}
      />

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 text-sm text-ink">
          <p>En révoquant cet accès :</p>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>la personne perd l&apos;accès à tous vos immeubles dès sa prochaine action ;</li>
            <li>
              sa session est fermée, sauf si elle travaille encore pour un autre propriétaire ;
            </li>
            <li>son historique est conservé : ses actions passées restent à son nom ;</li>
            <li>
              la révocation est définitive : pour lui rendre l&apos;accès, vous devrez
              l&apos;inviter de nouveau, avec un nouveau lien.
            </li>
          </ul>
        </div>

        <ConfirmManagerActionForm
          action={revokeManagerAction.bind(null, manager.id)}
          cancelHref={fiche}
          submitLabel="Révoquer l'accès"
          pendingLabel="Révocation..."
        />
      </Card>
    </div>
  );
}
