import Link from 'next/link';
import { notFound } from 'next/navigation';

import { LeaseCard } from '@/components/lease/lease-card';
import { buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { ResourceOutOfScopeError, readablePropertyScopes } from '@/lib/authorization';
import { cn } from '@/lib/ui/cn';
import { pluralize } from '@/lib/ui/format';
import { listLeases, type LeaseListFilter } from '@/modules/leases';

/**
 * Liste des baux (MVP-BACKLOG-035).
 *
 * C'est aussi l'HISTORIQUE locatif : il se reconstruit des baux et n'est pas
 * dupliqué dans une table dédiée (Database Schema section 18). L'onglet « En
 * cours » est donc l'état du moment, et « Tous » l'histoire complète.
 *
 * Les filtres passent par l'URL et non par un état local. Trois bénéfices
 * concrets : la page est partageable, le bouton retour du navigateur fonctionne,
 * et le filtrage marche sans JavaScript.
 *
 * Ouverte au propriétaire ET au gestionnaire, chacun sur son périmètre. Pour un
 * locataire, la page n'existe pas : il consulte SON contrat depuis son espace,
 * son rattachement étant lui-même et non un immeuble (BR-021).
 */
export const metadata = { title: 'Baux' };

const FILTER_TABS: { value: LeaseListFilter; label: string }[] = [
  { value: 'ACTIVE', label: 'En cours' },
  { value: 'ENDED', label: 'Clôturés' },
  { value: 'ALL', label: 'Tous' },
];

export default async function LeasesPage(props: PageProps<'/baux'>) {
  const context = await requireAccessContextOrSignIn();
  const searchParams = await props.searchParams;

  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const status = (first(searchParams.statut) ?? 'ACTIVE') as LeaseListFilter;

  let collection;

  try {
    collection = await listLeases(getDb(), context, {
      status,
      page: first(searchParams.page),
      propertyId: first(searchParams.immeuble) ?? null,
      apartmentId: first(searchParams.logement) ?? null,
      tenantId: first(searchParams.locataire) ?? null,
    });
  } catch (error) {
    if (error instanceof ResourceOutOfScopeError) notFound();

    throw error;
  }

  const canCreate = readablePropertyScopes(context, 'lease.create').length > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Baux"
        description={
          collection.meta.total === 0
            ? 'Les relations locatives de vos logements apparaîtront ici.'
            : pluralize(collection.meta.total, 'bail', 'baux')
        }
        back={{ href: '/immeubles', label: 'Immeubles' }}
        actions={
          canCreate ? (
            <Link href="/baux/nouveau" className={buttonClasses('primary', 'md')}>
              Créer un bail
            </Link>
          ) : undefined
        }
      />

      <nav aria-label="Filtrer les baux" className="flex gap-1">
        {FILTER_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === 'ACTIVE' ? '/baux' : `/baux?statut=${tab.value}`}
            aria-current={status === tab.value ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-11 items-center rounded-md px-3 text-sm',
              status === tab.value
                ? 'bg-brand text-white'
                : 'text-muted hover:bg-surface hover:text-ink',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {collection.leases.length === 0 ? (
        <EmptyState
          title={status === 'ACTIVE' ? 'Aucun bail en cours' : 'Aucun bail'}
          description="Un bail rattache un locataire à un logement, avec son loyer et sa date de début. C'est lui qui fera naître les loyers à payer."
          action={
            canCreate ? (
              <Link href="/baux/nouveau" className={buttonClasses('primary', 'md')}>
                Créer un bail
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {collection.leases.map((item) => (
            <LeaseCard key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
