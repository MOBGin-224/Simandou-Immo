import Link from 'next/link';

import { ApartmentCard } from '@/components/apartment/apartment-card';
import { buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { getDb } from '@/db/client';
import { can } from '@/lib/authorization';
import { cn } from '@/lib/ui/cn';
import { pluralize } from '@/lib/ui/format';
import { listApartments } from '@/modules/apartments';

import { loadPropertyPage } from '../../data';

/**
 * Liste des appartements d'un immeuble (MVP-BACKLOG-022).
 *
 * L'écran vit SOUS l'immeuble, et non au premier niveau de la navigation :
 * l'appartement est un niveau 3 de l'architecture d'information, et l'URL
 * conserve le contexte de l'immeuble d'un bout à l'autre du parcours. C'est ce
 * que demande le principe du contexte persistant : entré dans un immeuble,
 * l'utilisateur n'a pas à le resélectionner.
 *
 * Recherche et filtres passent par l'URL et non par un état local. Trois
 * bénéfices concrets : la page est partageable, le bouton retour du navigateur
 * fonctionne, et la recherche marche sans JavaScript.
 */
export async function generateMetadata(props: PageProps<'/immeubles/[propertyId]/appartements'>) {
  const { propertyId } = await props.params;
  const { property } = await loadPropertyPage(propertyId);

  return { title: `Appartements · ${property.name}` };
}

const STATUS_TABS = [
  { value: 'ALL', label: 'Tous' },
  { value: 'VACANT', label: 'Vacants' },
  { value: 'OCCUPIED', label: 'Occupés' },
  { value: 'MAINTENANCE', label: 'En maintenance' },
] as const;

export default async function ApartmentsPage(
  props: PageProps<'/immeubles/[propertyId]/appartements'>,
) {
  const { propertyId } = await props.params;
  const { context, property } = await loadPropertyPage(propertyId);
  const searchParams = await props.searchParams;

  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

  const activeStatus = first(searchParams.statut) ?? 'ALL';
  const search = first(searchParams.recherche) ?? '';
  /**
   * L'URL accepte `archives=1` et la liste l'honore, mais AUCUN lien ne l'offre.
   *
   * Ce n'est pas un oubli. L'archivage d'un appartement n'existe pas à ce lot :
   * la matrice des rôles prévoit bien « Archiver un appartement », mais la
   * permission correspondante n'est pas au catalogue et DEC-025 ne l'a pas
   * tranchée. Un lien « Afficher les archivés » ne pourrait donc rien révéler,
   * et une commande sans effet possible est un ornement.
   *
   * Le paramètre reste en place parce que le modèle le prévoit depuis le Lot 1
   * (DEC-020) et que l'API l'expose : le lien reviendra avec l'archivage, sans
   * rien à recâbler.
   */
  const includeArchived = first(searchParams.archives) === '1';

  const collection = await listApartments(getDb(), context, property.id, {
    page: first(searchParams.page),
    search,
    status: activeStatus,
    includeArchived,
  });

  const resource = { organizationId: property.organizationId, propertyId: property.id };
  const canCreate = can(context, 'apartment.create', resource) && !property.archived;
  const base = `/immeubles/${property.id}/appartements`;

  /** Conserve la recherche en changeant d'onglet, et inversement. */
  const hrefWith = (params: Record<string, string>) => {
    const query = new URLSearchParams();

    if (search) query.set('recherche', search);
    if (activeStatus !== 'ALL') query.set('statut', activeStatus);
    if (includeArchived) query.set('archives', '1');

    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }

    const suffix = query.toString();

    return suffix ? `${base}?${suffix}` : base;
  };

  /**
   * Description qui dit ce que la liste montre RÉELLEMENT.
   *
   * Sans le qualificatif, « 13 logements · Immeuble Camayenne » se lit comme le
   * total de l'immeuble alors que c'est le décompte du filtre : vu à l'écran, en
   * filtrant sur les vacants d'un immeuble qui en compte quinze.
   */
  const FILTER_NOUNS: Record<string, string> = {
    VACANT: 'vacant',
    OCCUPIED: 'occupé',
    MAINTENANCE: 'en maintenance',
  };

  const describeCount = () => {
    if (collection.meta.total === 0) return property.name;

    const noun = FILTER_NOUNS[activeStatus];
    const counted = pluralize(collection.meta.total, 'logement');

    if (noun === undefined) return `${counted} · ${property.name}`;

    // « en maintenance » est invariable, les deux autres s'accordent.
    const qualifier = noun === 'en maintenance' || collection.meta.total === 1 ? noun : `${noun}s`;

    return `${counted} ${qualifier} · ${property.name}`;
  };
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Appartements"
        description={describeCount()}
        back={{ href: `/immeubles/${property.id}`, label: property.name }}
        actions={
          canCreate ? (
            <Link href={`${base}/nouveau`} className={buttonClasses('primary', 'md')}>
              Ajouter
            </Link>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3">
        {/*
          Les onglets défilent horizontalement à 360 px : quatre libellés ne
          tiennent pas sur une ligne, et les replier sur deux rangées ferait
          sauter le contenu à chaque changement de filtre.
        */}
        <nav
          aria-label="Filtrer par statut"
          className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0"
        >
          {STATUS_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={hrefWith({ statut: tab.value === 'ALL' ? '' : tab.value, page: '' })}
              aria-current={activeStatus === tab.value ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm',
                activeStatus === tab.value
                  ? 'bg-brand text-white'
                  : 'text-muted hover:bg-surface hover:text-ink',
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <div>
          {/* Formulaire GET : la recherche vit dans l'URL, donc sans JavaScript. */}
          <form method="get" action={base} className="flex gap-2">
            {activeStatus !== 'ALL' ? (
              <input type="hidden" name="statut" value={activeStatus} />
            ) : null}
            {includeArchived ? <input type="hidden" name="archives" value="1" /> : null}
            <label htmlFor="recherche" className="sr-only">
              Rechercher un appartement
            </label>
            <Input
              id="recherche"
              name="recherche"
              type="search"
              defaultValue={search}
              placeholder="Référence ou type"
              className="sm:w-64"
            />
            <button type="submit" className={buttonClasses('secondary', 'md')}>
              Rechercher
            </button>
          </form>
        </div>
      </div>

      {collection.apartments.length === 0 ? (
        <EmptyState
          title={
            search || activeStatus !== 'ALL'
              ? 'Aucun appartement ne correspond'
              : 'Aucun appartement pour le moment'
          }
          description={
            search || activeStatus !== 'ALL'
              ? 'Essayez une autre référence, un autre type ou un autre statut.'
              : canCreate
                ? 'Créez la structure de cet immeuble, un logement à la fois ou toute une série.'
                : property.archived
                  ? 'Cet immeuble est archivé : sa structure ne peut plus être complétée.'
                  : 'Aucun logement ne vous a encore été confié dans cet immeuble.'
          }
          action={
            !search && activeStatus === 'ALL' && canCreate ? (
              <Link href={`${base}/nouveau`} className={buttonClasses('primary', 'md')}>
                Ajouter des appartements
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {collection.apartments.map((apartment) => (
            <ApartmentCard key={apartment.id} apartment={apartment} propertyId={property.id} />
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
