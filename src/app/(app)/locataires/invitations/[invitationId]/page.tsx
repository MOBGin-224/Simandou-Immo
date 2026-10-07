import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ResendTenantInvitationForm } from '@/components/tenant/resend-tenant-invitation-form';
import { Alert } from '@/components/ui/alert';
import { InvitationStatusBadge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { ResourceOutOfScopeError } from '@/lib/authorization';
import { formatDate } from '@/lib/ui/format';
import { describeApartment, getTenantInvitation } from '@/modules/tenants';

import { resendTenantInvitationAction } from '../../actions';

/**
 * Fiche d'une invitation de locataire (MVP-BACKLOG-031).
 *
 * Montre ce que l'inviteur sait de l'invitation, et lui permet de la renvoyer ou
 * de la révoquer. Elle ne montre JAMAIS le lien : la base ne conserve que le
 * hachage du jeton (SEC-INV-002), donc le lien ne peut pas être restitué. Un lien
 * perdu se renvoie.
 *
 * C'est aussi l'écran où l'on corrige un numéro mal saisi (DEC-048) : révoquer,
 * puis réinviter. Le texte le dit, parce que c'est la seule correction possible.
 *
 * Un identifiant inconnu, mal formé, d'une invitation de gestionnaire ou hors
 * périmètre donne la même page « introuvable » (ADR-007).
 */
export async function generateMetadata(props: PageProps<'/locataires/invitations/[invitationId]'>) {
  const { invitationId } = await props.params;
  const context = await requireAccessContextOrSignIn();

  try {
    const invitation = await getTenantInvitation(getDb(), context, invitationId);

    return { title: `Invitation de ${invitation.fullName}` };
  } catch (error) {
    if (error instanceof ResourceOutOfScopeError) return { title: 'Invitation introuvable' };

    throw error;
  }
}

export default async function TenantInvitationPage(
  props: PageProps<'/locataires/invitations/[invitationId]'>,
) {
  const { invitationId } = await props.params;
  const context = await requireAccessContextOrSignIn();

  let invitation;

  try {
    invitation = await getTenantInvitation(getDb(), context, invitationId);
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
    { label: 'Logement', value: describeApartment(invitation.apartment) },
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
        description={`Invitation à l'espace locataire, ${describeApartment(invitation.apartment)}`}
        back={
          invitation.userId
            ? {
                href: `/locataires/${invitation.userId}?organisation=${invitation.organizationId}`,
                label: invitation.fullName,
              }
            : { href: '/locataires', label: 'Locataires' }
        }
      />

      <div>
        <InvitationStatusBadge status={invitation.status} />
      </div>

      <Card className="flex flex-col gap-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
          Détails
        </h2>

        <dl className="flex flex-col gap-3">
          {details.map((detail) => (
            <div key={detail.label} className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                {detail.label}
              </dt>
              <dd className="break-words text-base text-ink">{detail.value}</dd>
            </div>
          ))}
        </dl>

        <p className="text-xs text-muted">
          Le loyer et le contrat ne sont pas demandés à l&apos;invitation : ils viendront avec les
          contrats.
        </p>
      </Card>

      {invitation.status === 'ACCEPTED' ? (
        <Alert tone="success">
          Cette invitation a été acceptée : la personne a ouvert son espace locataire. Tout se passe
          désormais sur sa fiche de locataire.
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
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
            {invitation.status === 'EXPIRED' ? 'Le lien a expiré' : 'Lien perdu ou à renouveler'}
          </h2>

          <ResendTenantInvitationForm
            action={resendTenantInvitationAction.bind(null, invitation.id)}
            doneHref="/locataires"
          />

          <hr className="border-line" />

          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">
              Révoquer l&apos;invitation rend son lien inutilisable. Aucun compte n&apos;est
              supprimé. C&apos;est aussi la façon de corriger un numéro mal saisi : révoquez, puis
              invitez de nouveau avec le bon numéro.
            </p>
            <Link
              href={`/locataires/invitations/${invitation.id}/revoquer`}
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
