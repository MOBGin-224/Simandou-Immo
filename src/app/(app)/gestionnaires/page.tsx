import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ManagerCard } from '@/components/manager/manager-card';
import { buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { ResourceOutOfScopeError, organizationsWhereAllowed } from '@/lib/authorization';
import { pluralize } from '@/lib/ui/format';
import { listManagers } from '@/modules/managers';

/**
 * Liste des gestionnaires (MVP-BACKLOG-026, PRD 10.2).
 *
 * Réunit les gestionnaires, de tout statut, et les invitations en attente. Ce qui
 * appelle une action du propriétaire, une invitation à renvoyer ou expirée, vient
 * avant les gestionnaires actifs.
 *
 * Réservée au propriétaire (DEC-025) : pour un gestionnaire ou un locataire, la
 * page n'existe pas. C'est le même raisonnement que le 404 de l'API, appliqué à un
 * écran, et cela évite de montrer une page que rien d'autre ne permet d'utiliser.
 */
export const metadata = { title: 'Gestionnaires' };

export default async function ManagersPage() {
  const context = await requireAccessContextOrSignIn();

  let collection;

  try {
    collection = await listManagers(getDb(), context);
  } catch (error) {
    if (error instanceof ResourceOutOfScopeError) notFound();

    throw error;
  }

  const canInvite = organizationsWhereAllowed(context, 'manager.invite').length > 0;
  const invitations = collection.managers.filter((item) => item.kind === 'INVITATION').length;
  const accesses = collection.meta.total - invitations;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Gestionnaires"
        description={
          collection.meta.total === 0
            ? 'Les personnes qui gèrent vos immeubles apparaîtront ici.'
            : [
                accesses > 0 ? pluralize(accesses, 'gestionnaire') : null,
                invitations > 0 ? pluralize(invitations, 'invitation') + ' en attente' : null,
              ]
                .filter(Boolean)
                .join(', ')
        }
        back={{ href: '/immeubles', label: 'Immeubles' }}
        actions={
          canInvite ? (
            <Link href="/gestionnaires/inviter" className={buttonClasses('primary', 'md')}>
              Inviter un gestionnaire
            </Link>
          ) : undefined
        }
      />

      {collection.managers.length === 0 ? (
        <EmptyState
          title="Aucun gestionnaire pour le moment"
          description="Invitez la personne qui gérera vos immeubles. Elle activera son compte avec un lien que vous lui transmettez."
          action={
            canInvite ? (
              <Link href="/gestionnaires/inviter" className={buttonClasses('primary', 'md')}>
                Inviter un gestionnaire
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {collection.managers.map((item) => (
            <ManagerCard key={`${item.kind}-${item.id}`} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
