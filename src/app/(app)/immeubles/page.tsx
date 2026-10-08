import Link from 'next/link';

import { PropertyCard } from '@/components/property/property-card';
import { buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { notFound } from 'next/navigation';

import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { organizationsWhereAllowed, readablePropertyScopes } from '@/lib/authorization';
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
 *
 * **La page n'existe pas pour un locataire** (DEC-046), ce que le Lot 7 a rendu
 * visible : il n'atteint aucun immeuble, et l'écran lui annonçait pourtant qu'un
 * patrimoine « apparaîtra ici ». Le contrôle porte sur le RÔLE et non sur le
 * périmètre : un gestionnaire sans immeuble attribué doit bien voir la page, et y
 * lire qu'aucun immeuble ne lui a encore été confié.
 */
export const metadata = { title: 'Immeubles' };

const FILTER_TABS: { value: PropertyListFilter; label: string }[] = [
  { value: 'ACTIVE', label: 'Actifs' },
  { value: 'ARCHIVED', label: 'Archivés' },
  { value: 'ALL', label: 'Tous' },
];

export default async function PropertiesPage(props: PageProps<'/immeubles'>) {
  const context = await requireAccessContextOrSignIn();

  const manages = context.memberships.some(
    (membership) => membership.role === 'OWNER' || membership.role === 'MANAGER',
  );

  if (!manages) notFound();

  const searchParams = await props.searchParams;

  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

  const collection = await listProperties(getDb(), context, {
    page: first(searchParams.page),
    search: first(searchParams.recherche),
    filter: first(searchParams.filtre),
  });

  const canCreate = organizationsWhereAllowed(context, 'property.create').length > 0;
  const canManageManagers = organizationsWhereAllowed(context, 'manager.read').length > 0;
  /*
   * Point d'entrée des locataires, ouvert au gestionnaire comme au propriétaire : le
   * gestionnaire est le principal point d'entrée pour les locataires (Rôles et
   * permissions section 13). Le périmètre décide, et non le seul rôle : un
   * gestionnaire sans immeuble attribué n'a aucun locataire à voir.
   */
  /*
   * Point d'entrée des baux. Même raison que les deux précédents : sans lien,
   * l'écran ne serait atteignable qu'en tapant son adresse, la barre d'onglets
   * n'arrivant pas avant le Lot 9.
   */
  const canManageLeases = readablePropertyScopes(context, 'lease.read').length > 0;
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
          canCreate || canManageManagers || canManageLeases ? (
            <>
              {/*
                Ce qui RESTE ici depuis que la navigation principale existe (Lot 9).
                Elle porte les immeubles, les locataires, les loyers et le compte,
                soit les destinations de premier niveau. Deux liens n'y entrent pas
                et vivent donc ici.

                Les BAUX, parce que l'architecture de l'information ne les place pas
                au premier niveau : ils se rejoignent depuis un immeuble, un
                appartement, un locataire ou un loyer.

                Les GESTIONNAIRES, parce qu'ils sont réservés au propriétaire
                (DEC-025) et que la charte limite la navigation à cinq entrées : une
                entrée visible d'un seul rôle y aurait coûté la place de « Loyers ».

                Le lien vers les locataires a été RETIRÉ : la navigation l'offre
                maintenant partout, et le garder ici donnait deux chemins côte à côte
                vers le même écran.
              */}
              {canManageLeases ? (
                <Link href="/baux" className={buttonClasses('secondary', 'md')}>
                  Baux
                </Link>
              ) : null}
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
