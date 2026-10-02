import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  InviteManagerForm,
  type InvitablePropertyGroup,
} from '@/components/manager/invite-manager-form';
import { buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { listAllowedOrganizations } from '@/modules/organizations';
import { describeLocation, listProperties } from '@/modules/properties';

import { inviteManagerAction } from '../actions';

/**
 * Invitation d'un gestionnaire (parcours 4, MVP-BACKLOG-026).
 *
 * L'écran est refusé d'emblée à qui ne porte pas `manager.invite`, réservée au
 * propriétaire (DEC-025) : sans organisation recevable, la page n'existe pas pour
 * cet utilisateur. Cela évite de laisser remplir un formulaire qui serait rejeté à
 * la fin.
 *
 * Seuls les immeubles ACTIFS sont proposés : un immeuble archivé ne peut pas être
 * confié (DEC-020).
 */
export const metadata = { title: 'Inviter un gestionnaire' };

export default async function InviteManagerPage() {
  const context = await requireAccessContextOrSignIn();
  const organizations = await listAllowedOrganizations(getDb(), context, 'manager.invite');

  if (organizations.length === 0) notFound();

  const groups: InvitablePropertyGroup[] = [];

  for (const organization of organizations) {
    // 100 est la borne de pagination du serveur, et celle d'une invitation (DEC-041).
    const collection = await listProperties(getDb(), context, {
      organizationId: organization.id,
      filter: 'ACTIVE',
      pageSize: 100,
    });

    groups.push({
      organization,
      properties: collection.properties.map((property) => ({
        id: property.id,
        name: property.name,
        location: describeLocation(property),
      })),
    });
  }

  const hasProperties = groups.some((group) => group.properties.length > 0);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Inviter un gestionnaire"
        description="Vous obtiendrez un lien à transmettre vous-même. La personne l'ouvrira pour activer son compte."
        back={{ href: '/gestionnaires', label: 'Gestionnaires' }}
      />

      {hasProperties ? (
        <InviteManagerForm action={inviteManagerAction} groups={groups} />
      ) : (
        <EmptyState
          title="Aucun immeuble à confier"
          description="Un gestionnaire se voit confier au moins un immeuble. Créez d'abord un immeuble."
          action={
            <Link href="/immeubles/nouveau" className={buttonClasses('primary', 'md')}>
              Ajouter un immeuble
            </Link>
          }
        />
      )}
    </div>
  );
}
