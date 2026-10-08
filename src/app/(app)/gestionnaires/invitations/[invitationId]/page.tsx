import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ResendInvitationForm } from '@/components/manager/resend-invitation-form';
import { Alert } from '@/components/ui/alert';
import { InvitationStatusBadge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Overline } from '@/components/ui/overline';
import { PageHeader } from '@/components/ui/page-header';
import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { ResourceOutOfScopeError } from '@/lib/authorization';
import { formatDate } from '@/lib/ui/format';
import { getManagerInvitation } from '@/modules/managers';

import { resendInvitationAction } from '../../actions';

/**
 * Fiche d'une invitation de gestionnaire (MVP-BACKLOG-026).
 *
 * Montre ce que le propriétaire sait de l'invitation, et lui permet de la renvoyer
 * ou de la révoquer. Elle ne montre JAMAIS le lien : la base ne conserve que le
 * hachage du jeton (SEC-INV-002), donc le lien ne peut pas être restitué. Un lien
 * perdu se renvoie.
 *
 * Un identifiant inconnu, mal formé, d'une autre organisation ou d'un autre rôle
 * donne la même page « introuvable » (ADR-007).
 */
export async function generateMetadata(
  props: PageProps<'/gestionnaires/invitations/[invitationId]'>,
) {
  const { invitationId } = await props.params;
  const context = await requireAccessContextOrSignIn();

  try {
    const invitation = await getManagerInvitation(getDb(), context, invitationId);

    return { title: `Invitation de ${invitation.fullName}` };
  } catch (error) {
    if (error instanceof ResourceOutOfScopeError) return { title: 'Invitation introuvable' };

    throw error;
  }
}

export default async function InvitationPage(
  props: PageProps<'/gestionnaires/invitations/[invitationId]'>,
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

  // Renvoyer ou révoquer n'a de sens que tant que l'invitation n'est ni acceptée,
  // ni révoquée. Expirée, elle se renvoie : c'est précisément l'usage du renvoi.
  const actionable = invitation.status !== 'ACCEPTED' && invitation.status !== 'REVOKED';

  const details: { label: string; value: string }[] = [
    { label: 'Téléphone', value: invitation.phone ?? 'Non renseigné' },
    { label: 'Adresse email', value: invitation.email ?? 'Non renseignée' },
    { label: 'Invitation émise le', value: formatDate(invitation.issuedAt.toISOString()) },
    {
      label: invitation.status === 'EXPIRED' ? 'Lien expiré le' : 'Lien valable jusqu’au',
      value: formatDate(invitation.expiresAt.toISOString()),
    },
  ];

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={invitation.fullName}
        description="Invitation à gérer vos immeubles"
        back={{ href: '/gestionnaires', label: 'Gestionnaires' }}
      />

      <div>
        <InvitationStatusBadge status={invitation.status} />
      </div>

      <Card className="flex flex-col gap-4">
        <Overline>Détails</Overline>

        <dl className="flex flex-col gap-3">
          {details.map((detail) => (
            <div key={detail.label} className="flex flex-col gap-0.5">
              <Overline as="dt">{detail.label}</Overline>
              <dd className="break-words text-base text-ink">{detail.value}</dd>
            </div>
          ))}

          <div className="flex flex-col gap-0.5">
            <Overline as="dt">Immeubles confiés</Overline>
            <dd>
              <ul className="flex flex-col gap-0.5 text-base text-ink">
                {invitation.properties.map((property) => (
                  <li key={property.id}>
                    {property.name}
                    {property.archived ? ' (archivé)' : ''}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
      </Card>

      {invitation.status === 'ACCEPTED' ? (
        <Alert tone="success">
          Cette invitation a été acceptée : la personne a activé son compte. Elle figure dans la
          liste des gestionnaires.
        </Alert>
      ) : null}

      {invitation.status === 'REVOKED' ? (
        <Alert tone="info">
          Cette invitation a été révoquée : son lien ne fonctionne plus. Vous pouvez inviter de
          nouveau cette personne.
        </Alert>
      ) : null}

      {actionable ? (
        <Card className="flex flex-col gap-5">
          <Overline>
            {invitation.status === 'EXPIRED' ? 'Le lien a expiré' : 'Lien perdu ou à renouveler'}
          </Overline>

          <ResendInvitationForm
            action={resendInvitationAction.bind(null, invitation.id)}
            doneHref="/gestionnaires"
          />

          <hr className="border-line" />

          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">
              Révoquer l&apos;invitation rend son lien inutilisable. Aucun compte n&apos;est
              supprimé.
            </p>
            <Link
              href={`/gestionnaires/invitations/${invitation.id}/revoquer`}
              className={buttonClasses('secondary', 'md')}
            >
              Révoquer l&apos;invitation
            </Link>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
