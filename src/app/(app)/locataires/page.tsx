import Link from 'next/link';
import { notFound } from 'next/navigation';

import { TenantCard } from '@/components/tenant/tenant-card';
import { buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { ResourceOutOfScopeError, readablePropertyScopes } from '@/lib/authorization';
import { pluralize } from '@/lib/ui/format';
import { listTenants } from '@/modules/tenants';

/**
 * Liste des locataires (MVP-BACKLOG-031, API section 15, PRD 10.2).
 *
 * Réunit les locataires, de tout statut, et les invitations en attente. Ce qui
 * appelle une action, une invitation à renvoyer ou expirée, vient avant les
 * locataires actifs.
 *
 * Ouverte au propriétaire ET au gestionnaire, chacun sur son périmètre : le
 * gestionnaire est le principal point d'entrée pour les locataires (Rôles et
 * permissions section 13). Pour un locataire, la page n'existe pas : il ne voit
 * aucun autre locataire (DEC-047).
 *
 * **Aucun montant n'y figure** : le loyer naît du bail, au Lot 8 (DEC-046).
 */
export const metadata = { title: 'Locataires' };

export default async function TenantsPage() {
  const context = await requireAccessContextOrSignIn();

  let collection;

  try {
    collection = await listTenants(getDb(), context);
  } catch (error) {
    if (error instanceof ResourceOutOfScopeError) notFound();

    throw error;
  }

  const canInvite = readablePropertyScopes(context, 'tenant.invite').length > 0;
  const invitations = collection.tenants.filter((item) => item.kind === 'INVITATION').length;
  const accesses = collection.tenants.length - invitations;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Locataires"
        description={
          collection.meta.total === 0
            ? 'Les personnes qui occupent vos logements apparaîtront ici.'
            : [
                accesses > 0 ? pluralize(accesses, 'locataire') : null,
                invitations > 0 ? pluralize(invitations, 'invitation') + ' en attente' : null,
              ]
                .filter(Boolean)
                .join(', ')
        }
        back={{ href: '/immeubles', label: 'Immeubles' }}
        actions={
          canInvite ? (
            <Link href="/locataires/inviter" className={buttonClasses('primary', 'md')}>
              Inviter un locataire
            </Link>
          ) : undefined
        }
      />

      {collection.tenants.length === 0 ? (
        <EmptyState
          title="Aucun locataire pour le moment"
          description="Invitez la personne qui occupe un de vos logements. Elle ouvrira son espace avec un lien que vous lui transmettez."
          action={
            canInvite ? (
              <Link href="/locataires/inviter" className={buttonClasses('primary', 'md')}>
                Inviter un locataire
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {collection.tenants.map((item) => (
            <TenantCard key={`${item.kind}-${item.id}`} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
