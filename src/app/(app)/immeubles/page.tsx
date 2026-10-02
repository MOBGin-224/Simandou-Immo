import Link from 'next/link';

import { PropertyCard } from '@/components/property/property-card';
import { buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { organizationsWhereAllowed } from '@/lib/authorization';
import { cn } from '@/lib/ui/cn';
import { pluralize } from '@/lib/ui/format';
import { listProperties, type PropertyListFilter } from '@/modules/properties';

/**
 * Liste des immeubles (MVP-BACKLOG-018).
 *
 * Le périmètre est appliqué par le cas d'usage : un gestionnaire ne voit que ses
 * immeubles, et cet écran n'a aucun filtrage à faire de son côté (API section 67).
 *
 * Recherche et filtres passent par l'URL et non par un état local. Trois bénéfices
 * concrets : la page est partageable, le bouton retour du navigateur fonctionne, et
 * la recherche marche sans JavaScript.
 */
export const metadata = { title: 'Immeubles' };

const FILTER_TABS: { value: PropertyListFilter; label: string }[] = [
  { value: 'ACTIVE', label: 'Actifs' },
  { value: 'ARCHIVED', label: 'Archivés' },
  { value: 'ALL', label: 'Tous' },
];

export default async function PropertiesPage(props: PageProps<'/immeubles'>) {
  const context = await requireAccessContextOrSignIn();
  const searchParams = await props.searchParams;

  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

  const collection = await listProperties(getDb(), context, {
    page: first(searchParams.page),
    search: first(searchParams.recherche),
    filter: first(searchParams.filtre),
  });

  const canCreate = organizationsWhereAllowed(context, 'property.create').length > 0;
  const canManageManagers = organizationsWhereAllowed(context, 'manager.read').length > 0;
  const activeFilter = (first(searchParams.filtre) ?? 'ACTIVE') as PropertyListFilter;
  const search = first(searchParams.recherche) ?? '';

  /** Conserve la recherche en changeant d'onglet, et inversement. */
  const hrefWith = (params: Record<string, string>) => {
    const query = new URLSearchParams();

    if (search) query.set('recherche', search);
    if (activeFilter !== 'ACTIVE') query.set('filtre', activeFilter);

    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }

    const suffix = query.toString();

    return suffix ? `/immeubles?${suffix}` : '/immeubles';
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Immeubles"
        description={
          collection.meta.total === 0
            ? 'Votre patrimoine apparaîtra ici.'
            : `${pluralize(collection.meta.total, 'immeuble')} dans votre périmètre.`
        }
        actions={
          canCreate || canManageManagers ? (
            <>
              {/*
                Point d'entrée de la gestion des gestionnaires, réservé au
                propriétaire (DEC-025). La barre d'onglets n'existe pas encore : elle
                prendra son sens aux lots Loyers et Maintenance, et d'ici là un lien
                depuis l'écran du patrimoine suffit.
              */}
              {canManageManagers ? (
                <Link href="/gestionnaires" className={buttonClasses('secondary', 'md')}>
                  Gestionnaires
                </Link>
              ) : null}
              {canCreate ? (
                <Link href="/immeubles/nouveau" className={buttonClasses('primary', 'md')}>
                  Ajouter un immeuble
                </Link>
              ) : null}
            </>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Filtrer les immeubles" className="flex gap-1">
          {FILTER_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={hrefWith({ filtre: tab.value === 'ACTIVE' ? '' : tab.value, page: '' })}
              aria-current={activeFilter === tab.value ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-11 items-center rounded-md px-3 text-sm',
                activeFilter === tab.value
                  ? 'bg-brand text-white'
                  : 'text-muted hover:bg-surface hover:text-ink',
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {/* Formulaire GET : la recherche vit dans l'URL, donc sans JavaScript. */}
        <form method="get" action="/immeubles" className="flex gap-2">
          {activeFilter !== 'ACTIVE' ? (
            <input type="hidden" name="filtre" value={activeFilter} />
          ) : null}
          <label htmlFor="recherche" className="sr-only">
            Rechercher un immeuble
          </label>
          <Input
            id="recherche"
            name="recherche"
            type="search"
            defaultValue={search}
            placeholder="Nom, ville, quartier"
            className="sm:w-64"
          />
          <button type="submit" className={buttonClasses('secondary', 'md')}>
            Rechercher
          </button>
        </form>
      </div>

      {collection.properties.length === 0 ? (
        <EmptyState
          title={search ? 'Aucun immeuble ne correspond' : 'Aucun immeuble pour le moment'}
          description={
            search
              ? 'Essayez un autre nom, une autre ville ou un autre quartier.'
              : canCreate
                ? 'Créez votre premier immeuble, puis ajoutez-y ses appartements.'
                : 'Aucun immeuble ne vous a encore été confié.'
          }
          action={
            !search && canCreate ? (
              <Link href="/immeubles/nouveau" className={buttonClasses('primary', 'md')}>
                Ajouter un immeuble
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {collection.properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </ul>
      )}

      {collection.meta.pageCount > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-4 text-sm">
          {collection.meta.page > 1 ? (
            <Link
              href={hrefWith({ page: String(collection.meta.page - 1) })}
              className={buttonClasses('secondary', 'md')}
            >
              Page précédente
            </Link>
          ) : (
            <span />
          )}

          <span className="text-muted">
            Page {collection.meta.page} sur {collection.meta.pageCount}
          </span>

          {collection.meta.page < collection.meta.pageCount ? (
            <Link
              href={hrefWith({ page: String(collection.meta.page + 1) })}
              className={buttonClasses('secondary', 'md')}
            >
              Page suivante
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
