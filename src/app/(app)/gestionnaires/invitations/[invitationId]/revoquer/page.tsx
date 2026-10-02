import { notFound } from 'next/navigation';

import { ConfirmManagerActionForm } from '@/components/manager/confirm-manager-action-form';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { ResourceOutOfScopeError } from '@/lib/authorization';
import { getManagerInvitation } from '@/modules/managers';

import { revokeInvitationAction } from '../../../actions';

/**
 * Confirmation de révocation d'une invitation (SEC-INV-005).
 *
 * Structure imposée par la Component Specification section 45 : titre,
 * CONSÉQUENCE, action secondaire, action principale. La conséquence est écrite en
 * clair, et elle est vraie : le lien devient inutilisable, aucun compte n'est
 * supprimé, et la personne peut être invitée de nouveau.
 *
 * Une page plutôt qu'une boîte de dialogue : sur un téléphone, une confirmation en
 * plein écran est plus lisible qu'une fenêtre superposée, elle est atteignable au
 * clavier, elle fonctionne sans JavaScript, et son adresse est partageable.
 *
 * Une invitation déjà acceptée ou révoquée n'a rien à révoquer : la page n'existe
 * pas pour elle. Pour un accès déjà ouvert, c'est la révocation de l'accès qu'il
 * faut, une autre opération.
 */
export async function generateMetadata() {
  return { title: "Révoquer l'invitation" };
}

export default async function RevokeInvitationPage(
  props: PageProps<'/gestionnaires/invitations/[invitationId]/revoquer'>,
) {
  const { invitationId } = await props.params;
  const context = await requireAccessContextOrSignIn();

  let invitation;

  try {
    invitation = await getManagerInvitation(getDb(), context, invitationId);
  } catch (error) {
    if (error instanceof ResourceOutOfScopeError) notFound();

    throw error;
  }

  if (invitation.status === 'ACCEPTED' || invitation.status === 'REVOKED') notFound();

  const fiche = `/gestionnaires/invitations/${invitation.id}`;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={`Révoquer l'invitation de ${invitation.fullName} ?`}
        description={invitation.phone ?? undefined}
        back={{ href: fiche, label: invitation.fullName }}
      />

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 text-sm text-ink">
          <p>En révoquant cette invitation :</p>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>son lien devient inutilisable immédiatement ;</li>
            <li>la personne ne pourra plus activer son compte avec ce lien ;</li>
            <li>aucun compte n&apos;est supprimé ;</li>
            <li>vous pourrez inviter de nouveau cette personne, avec un nouveau lien.</li>
          </ul>
        </div>

        <ConfirmManagerActionForm
          action={revokeInvitationAction.bind(null, invitation.id)}
          cancelHref={fiche}
          submitLabel="Révoquer l'invitation"
          pendingLabel="Révocation..."
        />
      </Card>
    </div>
  );
}
