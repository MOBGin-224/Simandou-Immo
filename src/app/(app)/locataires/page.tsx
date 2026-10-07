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
 * Réunit **toute personne qui a une relation locative** avec une organisation du
 * périmètre, qu'elle ait ou non un accès à l'application (DEC-051) : une
 * invitation, un accès ou un bail suffit à l'y faire figurer. Ce qui appelle une
 * action, une invitation à renvoyer ou expirée, vient avant les locataires
 * installés.
 *
 * Ouverte au propriétaire ET au gestionnaire, chacun sur son périmètre : le
 * gestionnaire est le principal point d'entrée pour les locataires (Rôles et
 * permissions section 13). Pour un locataire, la page n'existe pas : il ne voit
 * aucun autre locataire (DEC-047).
 *
 * **Aucun montant n'y figure** : le loyer appartient au bail, et c'est la fiche
 * du locataire qui y renvoie.
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

  /*
   * Le décompte se lit par STATUT et non par nature (DEC-051) : la liste ne mêle
   * plus deux sortes d'éléments, elle montre des personnes. Ce qui mérite d'être
   * annoncé en tête, c'est ce qui appelle une action, les invitations en attente.
   */
  const pending = collection.tenants.filter(
    (item) => item.status === 'INVITED' || item.status === 'INVITATION_EXPIRED',
  ).length;
  const settled = collection.tenants.length - pending;

  /*
   * L'adresse d'une fiche porte l'organisation dès que l'appelant en lit
   * plusieurs : la ressource est le couple personne et organisation, et une même
   * personne peut être locataire chez deux bailleurs (DEC-051).
   */
  const organizations = new Set(collection.tenants.map((item) => item.organizationId));
  const withOrganization = organizations.size > 1;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Locataires"
        description={
          collection.meta.total === 0
            ? 'Les personnes qui occupent vos logements apparaîtront ici.'
            : [
                settled > 0 ? pluralize(settled, 'locataire') : null,
                pending > 0 ? pluralize(pending, 'invitation') + ' en attente' : null,
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
            <TenantCard
              key={`${item.organizationId}-${item.id}`}
              item={item}
              withOrganization={withOrganization}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
