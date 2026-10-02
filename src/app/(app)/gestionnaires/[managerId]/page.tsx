import Link from 'next/link';

import { Alert } from '@/components/ui/alert';
import { ManagerStatusBadge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { formatDate } from '@/lib/ui/format';

import { loadManagerPage } from '../data';

/**
 * Fiche d'un gestionnaire (MVP-BACKLOG-026, PRD 10.2).
 *
 * Porte les informations minimales du PRD : nom, téléphone, email, statut, immeubles
 * accessibles, dates d'invitation et d'activation. Et les décisions que le
 * propriétaire peut prendre, selon l'état de l'accès :
 *
 * ```text
 * ACTIVE      modifier le périmètre, suspendre, révoquer
 * SUSPENDED   réactiver, modifier le périmètre, révoquer
 * REVOKED     rien : on invite de nouveau la personne (DEC-043)
 * ```
 *
 * Chaque décision grave passe par une page de confirmation qui énonce ses
 * conséquences (parcours 2.5) : suspendre et révoquer privent quelqu'un de son
 * accès, ce que ni un bouton isolé ni une boîte de dialogue native ne disent bien
 * sur un téléphone.
 */
export async function generateMetadata(props: PageProps<'/gestionnaires/[managerId]'>) {
  const { managerId } = await props.params;
  const manager = await loadManagerPage(managerId);

  return { title: manager.fullName };
}

export default async function ManagerPage(props: PageProps<'/gestionnaires/[managerId]'>) {
  const { managerId } = await props.params;
  const manager = await loadManagerPage(managerId);

  const base = `/gestionnaires/${manager.id}`;
  const isRevoked = manager.status === 'REVOKED';
  const isSuspended = manager.status === 'SUSPENDED';

  const details: { label: string; value: string }[] = [
    { label: 'Téléphone', value: manager.phone ?? 'Non renseigné' },
    { label: 'Adresse email', value: manager.email ?? 'Non renseignée' },
    {
      label: 'Invité le',
      value: manager.invitedAt ? formatDate(manager.invitedAt.toISOString()) : 'Non renseigné',
    },
    {
      label: 'Compte activé le',
      value: manager.activatedAt ? formatDate(manager.activatedAt.toISOString()) : 'Non renseigné',
    },
  ];

  if (isSuspended) {
    details.push({
      label: 'Suspendu depuis le',
      value: formatDate(manager.statusChangedAt.toISOString()),
    });
  }

  if (isRevoked && manager.revokedAt) {
    details.push({
      label: 'Accès révoqué le',
      value: formatDate(manager.revokedAt.toISOString()),
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={manager.fullName}
        description={manager.organizationName}
        back={{ href: '/gestionnaires', label: 'Gestionnaires' }}
      />

      <div>
        <ManagerStatusBadge status={manager.status} />
      </div>

      {isSuspended ? (
        <Alert tone="warning" title="Accès suspendu">
          Cette personne ne peut plus rien consulter pour le moment. Son périmètre est conservé : la
          réactiver lui rend exactement le même accès.
        </Alert>
      ) : null}

      {isRevoked ? (
        <Alert tone="info" title="Accès révoqué">
          Cette personne n&apos;a plus accès à vos immeubles. Son historique est conservé, et ses
          actions passées restent à son nom. Pour lui rendre l&apos;accès, invitez-la de nouveau.
        </Alert>
      ) : null}

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
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
          Immeubles confiés
        </h2>

        {manager.properties.length > 0 ? (
          <ul className="flex flex-col gap-1 text-base text-ink">
            {manager.properties.map((property) => (
              <li key={property.id} className="break-words">
                {property.name}
                {property.archived ? ' (archivé)' : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">
            {isRevoked ? "Aucun immeuble : l'accès est révoqué." : 'Aucun immeuble pour le moment.'}
          </p>
        )}
      </Card>

      {isRevoked ? (
        <Link href="/gestionnaires/inviter" className={buttonClasses('primary', 'md', true)}>
          Inviter de nouveau cette personne
        </Link>
      ) : (
        <Card className="flex flex-col gap-5">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
            Gérer cet accès
          </h2>

          {isSuspended ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted">Lui rendre l&apos;accès qu&apos;elle avait.</p>
              <Link href={`${base}/reactiver`} className={buttonClasses('primary', 'md', true)}>
                Réactiver l&apos;accès
              </Link>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">Choisir les immeubles que cette personne voit.</p>
            <Link href={`${base}/perimetre`} className={buttonClasses('secondary', 'md', true)}>
              Modifier le périmètre
            </Link>
          </div>

          {!isSuspended ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted">
                Bloquer l&apos;accès pour un temps, en gardant le périmètre.
              </p>
              <Link href={`${base}/suspendre`} className={buttonClasses('secondary', 'md', true)}>
                Suspendre l&apos;accès
              </Link>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">
              Mettre fin à l&apos;accès. L&apos;historique est conservé.
            </p>
            <Link href={`${base}/revoquer`} className={buttonClasses('secondary', 'md', true)}>
              Révoquer l&apos;accès
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
