import Link from 'next/link';

import { Alert } from '@/components/ui/alert';
import { AccessStatusBadge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { formatDate } from '@/lib/ui/format';
import { describeApartment } from '@/modules/tenants';

import { loadTenantPage } from '../data';

/**
 * Fiche d'un locataire (MVP-BACKLOG-031, DEC-046 et DEC-047).
 *
 * Porte l'identité, le statut d'accès, le logement et les dates d'invitation et
 * d'activation. Et les décisions possibles, selon l'état de l'accès :
 *
 * ```text
 * ACTIVE      suspendre, révoquer l'accès
 * SUSPENDED   réactiver, révoquer l'accès
 * REVOKED     rien : on invite de nouveau la personne (DEC-043)
 * ```
 *
 * **Aucune donnée financière, et c'est voulu** (DEC-046) : ni loyer, ni paiement,
 * ni quittance. Ils naissent du bail, au Lot 8, et la fiche l'annonce plutôt que
 * de laisser un emplacement vide.
 *
 * **Aucun bouton de modification du nom** : le nom appartient au locataire
 * (DEC-048), qui le modifie depuis son propre espace. Le téléphone et l'email ne
 * sont modifiables par personne.
 *
 * Chaque décision grave passe par une page de confirmation qui énonce ses
 * conséquences (parcours 2.5), et la première conséquence à dire est celle que
 * DEC-047 veut rendre impossible à confondre : retirer l'accès au produit ne
 * termine aucun bail.
 */
export async function generateMetadata(props: PageProps<'/locataires/[tenantId]'>) {
  const { tenantId } = await props.params;
  const tenant = await loadTenantPage(tenantId);

  return { title: tenant.fullName };
}

export default async function TenantPage(props: PageProps<'/locataires/[tenantId]'>) {
  const { tenantId } = await props.params;
  const tenant = await loadTenantPage(tenantId);

  const base = `/locataires/${tenant.id}`;
  const isRevoked = tenant.status === 'REVOKED';
  const isSuspended = tenant.status === 'SUSPENDED';

  const details: { label: string; value: string }[] = [
    { label: 'Téléphone', value: tenant.phone ?? 'Non renseigné' },
    { label: 'Adresse email', value: tenant.email ?? 'Non renseignée' },
    { label: 'Logement', value: describeApartment(tenant.apartment) },
    {
      label: 'Invité le',
      value: tenant.invitedAt ? formatDate(tenant.invitedAt.toISOString()) : 'Non renseigné',
    },
    {
      label: 'Espace ouvert le',
      value: tenant.activatedAt ? formatDate(tenant.activatedAt.toISOString()) : 'Non renseigné',
    },
  ];

  if (isSuspended) {
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
        description={describeApartment(tenant.apartment)}
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
          Le numéro et l&apos;adresse email ne sont modifiables par personne : leur changement
          demanderait une vérification que le produit ne sait pas encore mener. Le nom appartient au
          locataire, qui le modifie depuis son espace.
        </p>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
          Loyer et contrat
        </h2>
        <p className="text-sm text-muted">
          Le contrat, la date d&apos;entrée et le loyer n&apos;existent pas encore dans le produit.
          Ils arriveront avec les contrats, et cette fiche les affichera alors ici.
        </p>
      </Card>

      {isRevoked ? (
        <Link href="/locataires/inviter" className={buttonClasses('primary', 'md', true)}>
          Inviter de nouveau cette personne
        </Link>
      ) : (
        <Card className="flex flex-col gap-5">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
            Gérer cet accès
          </h2>

          {isSuspended ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted">Lui rendre son espace locataire.</p>
              <Link href={`${base}/reactiver`} className={buttonClasses('primary', 'md', true)}>
                Réactiver l&apos;accès
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted">
                Bloquer son espace pour un temps. Le bail n&apos;est pas touché.
              </p>
              <Link href={`${base}/suspendre`} className={buttonClasses('secondary', 'md', true)}>
                Suspendre l&apos;accès
              </Link>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">
              Mettre fin à son accès au produit. L&apos;historique est conservé, et aucun bail
              n&apos;est terminé.
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
