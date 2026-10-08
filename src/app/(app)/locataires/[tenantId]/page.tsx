import Link from 'next/link';

import { Alert } from '@/components/ui/alert';
import { AccessStatusBadge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Overline } from '@/components/ui/overline';
import { PageHeader } from '@/components/ui/page-header';
import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { formatDate, formatMoney } from '@/lib/ui/format';
import {
  describeApartment as describeLeaseApartment,
  describePeriod,
  listLeases,
} from '@/modules/leases';
import { describeApartment, hasProductAccess } from '@/modules/tenants';

import { loadTenantPage } from '../data';

/**
 * Fiche d'un locataire (MVP-BACKLOG-031, DEC-046, DEC-047, DEC-051).
 *
 * **Une fiche par PERSONNE** (DEC-051). Elle porte son identité, sa relation avec
 * l'organisation, son logement et son bail. Au Lot 7 il y avait deux fiches, une
 * pour l'accès et une pour l'invitation en attente : le locataire étant désormais
 * une personne, l'invitation n'est plus qu'un état de sa relation, et sa fiche
 * d'invitation ne sert plus qu'à renvoyer ou révoquer le lien.
 *
 * Les décisions possibles, selon l'état du DROIT D'ACCÈS :
 *
 * ```text
 * ACTIVE      suspendre, revoquer l'acces
 * SUSPENDED   reactiver, revoquer l'acces
 * REVOKED     rien : on invite de nouveau la personne (DEC-043)
 * INVITED     rien ici : le lien se renvoie ou se revoque sur l'invitation
 * NO_ACCESS   rien a suspendre : la personne n'utilise pas l'application, et
 *             l'ecran propose de l'inviter plutot que de le taire
 * ```
 *
 * **Aucun bouton de modification du nom** : le nom appartient à la personne
 * (DEC-048, DEC-051), qui le modifie depuis son propre espace. Le téléphone et
 * l'email ne sont modifiables par personne.
 *
 * Chaque décision grave passe par une page de confirmation qui énonce ses
 * conséquences (parcours 2.5), et la première conséquence à dire est celle que
 * DEC-047 veut rendre impossible à confondre : retirer l'accès au produit ne
 * termine aucun bail.
 */
export async function generateMetadata(props: PageProps<'/locataires/[tenantId]'>) {
  const { tenantId } = await props.params;
  const { organisation } = await props.searchParams;
  const tenant = await loadTenantPage(tenantId, first(organisation));

  return { title: tenant.fullName };
}

/** Premier paramètre d'une adresse, qui peut en porter plusieurs. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TenantPage(props: PageProps<'/locataires/[tenantId]'>) {
  const { tenantId } = await props.params;
  const { organisation } = await props.searchParams;
  const organizationId = first(organisation);
  const tenant = await loadTenantPage(tenantId, organizationId);

  /*
   * Baux de cette personne (BR-020).
   *
   * Le bail est la relation locative : c'est lui qui porte le logement, la date
   * d'entrée et le loyer, et la fiche du locataire les lit de lui.
   */
  const context = await requireAccessContextOrSignIn();
  const leases = (await listLeases(getDb(), context, { tenantId: tenant.id })).leases;
  const activeLease = leases.find((lease) => lease.status === 'ACTIVE') ?? null;

  /*
   * L'organisation voyage dans chaque adresse de cette fiche.
   *
   * La ressource est le couple personne et organisation (DEC-051) : la porter
   * évite que les pages de confirmation aient à la redeviner, et rend l'adresse
   * partageable sans ambiguïté.
   */
  const query = `?organisation=${tenant.organizationId}`;
  const actionHref = (action: string) => `/locataires/${tenant.id}/${action}${query}`;

  const hasAccess = hasProductAccess(tenant);
  const isRevoked = tenant.status === 'REVOKED';
  const isSuspended = tenant.status === 'SUSPENDED';
  const isActive = tenant.status === 'ACTIVE';
  const isInvited = tenant.status === 'INVITED' || tenant.status === 'INVITATION_EXPIRED';

  const apartmentLabel = activeLease
    ? describeLeaseApartment(activeLease.apartment)
    : describeApartment(tenant.apartment);

  const details: { label: string; value: string }[] = [
    { label: 'Téléphone', value: tenant.phone ?? 'Non renseigné' },
    { label: 'Adresse email', value: tenant.email ?? 'Non renseignée' },
    { label: 'Logement', value: apartmentLabel },
    {
      label: 'Invité le',
      value: tenant.invitedAt ? formatDate(tenant.invitedAt.toISOString()) : 'Jamais invité',
    },
    {
      label: 'Espace ouvert le',
      value: tenant.activatedAt
        ? formatDate(tenant.activatedAt.toISOString())
        : "Pas d'espace locataire",
    },
  ];

  if (isSuspended && tenant.statusChangedAt) {
    details.push({
      label: 'Suspendu depuis le',
      value: formatDate(tenant.statusChangedAt.toISOString()),
    });
  }

  if (isRevoked && tenant.revokedAt) {
    details.push({
      label: 'Accès révoqué le',
      value: formatDate(tenant.revokedAt.toISOString()),
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={tenant.fullName}
        description={apartmentLabel}
        back={{ href: '/locataires', label: 'Locataires' }}
      />

      <div>
        <AccessStatusBadge status={tenant.status} />
      </div>

      {isSuspended ? (
        <Alert tone="warning" title="Accès suspendu">
          Cette personne ne peut plus ouvrir son espace locataire pour le moment. Elle reste la
          locataire du logement : la suspension ne touche que l&apos;accès au produit.
        </Alert>
      ) : null}

      {isRevoked ? (
        <Alert tone="info" title="Accès révoqué">
          Cette personne n&apos;a plus d&apos;espace locataire. Son historique est conservé.{' '}
          <strong>Aucun bail n&apos;a été terminé</strong> : si elle occupe encore le logement, elle
          en reste la locataire. Pour lui rendre l&apos;accès, invitez-la de nouveau.
        </Alert>
      ) : null}

      {/*
        DEC-051 : ne pas utiliser l'application est un état NORMAL, pas un défaut.
        L'alerte est donc informative et propose l'invitation, sans la réclamer.
      */}
      {tenant.status === 'NO_ACCESS' ? (
        <Alert tone="info" title="Locataire sans compte">
          Cette personne est bien locataire, mais elle n&apos;a aucun accès à l&apos;application :
          elle n&apos;a pas été invitée, ou n&apos;en a pas besoin. Rien ne l&apos;y oblige. Vous
          pouvez l&apos;inviter si elle souhaite consulter ses loyers elle-même.
        </Alert>
      ) : null}

      {isInvited && tenant.invitationId ? (
        <Alert tone="info" title="Invitation en attente">
          Cette personne a été invitée et n&apos;a pas encore ouvert son espace.{' '}
          <Link
            href={`/locataires/invitations/${tenant.invitationId}`}
            className="underline underline-offset-4"
          >
            Renvoyer ou révoquer le lien
          </Link>
          .
        </Alert>
      ) : null}

      <Card className="flex flex-col gap-4">
        <Overline>Détails</Overline>

        <dl className="flex flex-col gap-3">
          {details.map((detail) => (
            <div key={detail.label} className="flex flex-col gap-0.5">
              <Overline as="dt">{detail.label}</Overline>
              <dd className="break-words text-base text-ink">{detail.value}</dd>
            </div>
          ))}
        </dl>

        <p className="text-xs text-muted">
          Le numéro et l&apos;adresse email ne sont modifiables par personne : leur changement
          demanderait une vérification que le produit ne sait pas encore mener. Le nom appartient au
          locataire, qui le modifie depuis son espace.
        </p>
      </Card>

      <Card className="flex flex-col gap-3">
        <Overline>Bail et loyer</Overline>

        {activeLease ? (
          <dl className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <Overline as="dt">Bail en cours</Overline>
              <dd className="break-words text-base text-ink">
                <Link
                  href={`/baux/${activeLease.id}`}
                  className="inline-flex min-h-11 items-center text-action-strong underline underline-offset-4 hover:text-brand"
                >
                  {describeLeaseApartment(activeLease.apartment)}
                </Link>
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <Overline as="dt">Loyer</Overline>
              <dd className="text-base text-ink">
                {formatMoney(activeLease.rent.amount, activeLease.rent.currency)} par mois, le{' '}
                {activeLease.dueDay}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <Overline as="dt">Période</Overline>
              <dd className="text-base text-ink">{describePeriod(activeLease, formatDate)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted">
            Cette personne n&apos;a aucun bail en cours. Créez-en un pour fixer son logement, sa
            date d&apos;entrée et son loyer.
          </p>
        )}

        {leases.length > (activeLease ? 1 : 0) ? (
          <div className="flex flex-col gap-1">
            <Overline as="span">Baux précédents</Overline>
            <ul className="flex flex-col gap-0.5 text-sm text-muted">
              {leases
                .filter((lease) => lease.status !== 'ACTIVE')
                .map((lease) => (
                  <li key={lease.id}>
                    <Link
                      href={`/baux/${lease.id}`}
                      className="inline-flex min-h-11 items-center break-words text-action-strong underline underline-offset-4 hover:text-brand"
                    >
                      {describeLeaseApartment(lease.apartment)}, {describePeriod(lease, formatDate)}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}

        {activeLease === null ? (
          <Link href="/baux/nouveau" className={buttonClasses('secondary', 'md', true)}>
            Créer un bail
          </Link>
        ) : null}
      </Card>

      {/*
        Les actions d'accès n'apparaissent que s'il y a un accès sur lequel agir.
        Sans accès, l'invitation est la seule porte, et c'est elle qu'on propose
        (DEC-051).
      */}
      {!hasAccess || isRevoked ? (
        <Link href="/locataires/inviter" className={buttonClasses('primary', 'md', true)}>
          {isRevoked ? 'Inviter de nouveau cette personne' : 'Inviter cette personne'}
        </Link>
      ) : (
        <Card className="flex flex-col gap-5">
          <Overline>Gérer cet accès</Overline>

          {isSuspended ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted">Lui rendre son espace locataire.</p>
              <Link href={actionHref('reactiver')} className={buttonClasses('primary', 'md', true)}>
                Réactiver l&apos;accès
              </Link>
            </div>
          ) : null}

          {isActive ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted">
                Bloquer son espace pour un temps. Le bail n&apos;est pas touché.
              </p>
              <Link
                href={actionHref('suspendre')}
                className={buttonClasses('secondary', 'md', true)}
              >
                Suspendre l&apos;accès
              </Link>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">
              Mettre fin à son accès au produit. L&apos;historique est conservé, et aucun bail
              n&apos;est terminé.
            </p>
            <Link href={actionHref('revoquer')} className={buttonClasses('secondary', 'md', true)}>
              Révoquer l&apos;accès
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
