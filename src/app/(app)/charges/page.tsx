import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ChargeCard } from '@/components/charge/charge-card';
import { Amount } from '@/components/ui/amount';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Overline } from '@/components/ui/overline';
import { PageHeader } from '@/components/ui/page-header';
import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { ResourceOutOfScopeError, readablePropertyScopes } from '@/lib/authorization';
import { cn } from '@/lib/ui/cn';
import { pluralize } from '@/lib/ui/format';
import { CHARGE_LIST_FILTERS, listCharges, type ChargeListFilter } from '@/modules/charges';

/**
 * Liste des charges communes (MVP-BACKLOG-054).
 *
 * **Ce que cet écran sert à faire : suivre les factures de l'immeuble et ce
 * qu'elles ont produit.** D'où l'onglet « Toutes » par défaut, à l'inverse de
 * l'écran des loyers qui ouvre sur les impayés : une charge n'est pas une file
 * d'attente, c'est un historique, et un brouillon masqué par défaut serait un
 * brouillon oublié.
 *
 * Les filtres passent par l'URL et non par un état local. Trois bénéfices
 * concrets : la page est partageable, le bouton retour du navigateur fonctionne,
 * et le filtrage marche sans JavaScript.
 *
 * Le total affiché en tête est ce qu'il RESTE À ENCAISSER sur les charges du
 * filtre, calculé par le serveur sur l'ensemble du filtre et non sur la page
 * (BR-039) : c'est la question que se pose un bailleur après avoir réparti une
 * facture.
 *
 * Ouverte au propriétaire ET au gestionnaire, chacun sur son périmètre. Pour un
 * locataire, la page n'existe pas : il consulte SA part depuis son espace, son
 * rattachement étant lui-même et non un immeuble (BR-021). C'est la même
 * frontière que pour les loyers.
 */
export const metadata = { title: 'Charges' };

/**
 * Onglets de l'écran.
 *
 * « Toutes » en premier, puis les trois états. Trois et non quatre questions :
 * ce qui est publié doit de l'argent, ce qui est en brouillon attend une
 * décision, ce qui est annulé n'est plus qu'une trace.
 */
const FILTER_TABS: { value: ChargeListFilter; label: string }[] = [
  { value: 'ALL', label: 'Toutes' },
  { value: 'PUBLISHED', label: 'Publiées' },
  { value: 'DRAFT', label: 'Brouillons' },
  { value: 'CANCELLED', label: 'Annulées' },
];

/**
 * Ce que l'écran dit quand un filtre ne ramène rien.
 *
 * Un vide bien formulé est une information : « aucune charge publiée » et
 * « aucune charge enregistrée » n'appellent pas le même geste.
 */
const EMPTY_BY_FILTER: Record<ChargeListFilter, { title: string; description: string }> = {
  ALL: {
    title: 'Aucune charge',
    description:
      "Une charge part d'une facture reçue par l'immeuble, l'eau ou l'électricité par exemple. Enregistrez-la, vérifiez la répartition, puis publiez-la.",
  },
  PUBLISHED: {
    title: 'Aucune charge publiée',
    description:
      "Aucune facture n'a encore été répartie entre les logements. Une charge ne doit rien à personne tant qu'elle n'est pas publiée.",
  },
  DRAFT: {
    title: 'Aucun brouillon',
    description: 'Les charges enregistrées mais non encore publiées apparaîtront ici.',
  },
  CANCELLED: {
    title: 'Aucune charge annulée',
    description: "Une charge annulée reste consultable ici, l'annulation laissant une trace.",
  },
};

export default async function ChargesPage(props: PageProps<'/charges'>) {
  const context = await requireAccessContextOrSignIn();
  const searchParams = await props.searchParams;

  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

  /*
   * Un filtre inconnu retombe sur le défaut au lieu de faire échouer l'écran.
   *
   * Une adresse bricolée à la main, ou un lien devenu obsolète, ne doit pas
   * produire une page d'erreur : la question « quel onglet afficher » a une
   * réponse raisonnable.
   */
  const requested = first(searchParams.statut);
  const status: ChargeListFilter = (CHARGE_LIST_FILTERS as readonly string[]).includes(
    requested ?? '',
  )
    ? (requested as ChargeListFilter)
    : 'ALL';

  const propertyId = first(searchParams.immeuble) ?? null;

  let collection;

  try {
    collection = await listCharges(getDb(), context, {
      status,
      page: first(searchParams.page),
      propertyId,
      period: first(searchParams.periode) ?? null,
      type: first(searchParams.nature) ?? null,
    });
  } catch (error) {
    if (error instanceof ResourceOutOfScopeError) notFound();

    throw error;
  }

  const canCreate = readablePropertyScopes(context, 'charge.create').length > 0;
  const empty = EMPTY_BY_FILTER[status];

  /* Le filtre par immeuble est conservé d'un onglet à l'autre : on ne fait pas
     perdre le périmètre choisi en changeant d'état. */
  const hrefFor = (value: ChargeListFilter) => {
    const params = new URLSearchParams();

    if (value !== 'ALL') params.set('statut', value);
    if (propertyId) params.set('immeuble', propertyId);

    const query = params.toString();

    return query.length > 0 ? `/charges?${query}` : '/charges';
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Charges"
        description={
          collection.meta.total === 0
            ? 'Les factures communes de vos immeubles apparaîtront ici.'
            : pluralize(collection.meta.total, 'charge')
        }
        back={{ href: '/immeubles', label: 'Immeubles' }}
      />

      {/*
        Ce qu'il reste à encaisser AVANT la liste, et seulement s'il reste
        quelque chose. Calculé par le serveur sur l'ensemble du filtre (BR-039) :
        une somme des cartes visibles annoncerait un reste faux dès la deuxième
        page.
      */}
      {collection.totalOutstanding > 0 && collection.currency !== null ? (
        <Card className="flex flex-col gap-1">
          <Overline as="h2">Reste à encaisser</Overline>
          <Amount
            amount={collection.totalOutstanding}
            currency={collection.currency}
            scale="hero"
          />
          <p className="text-xs text-muted">
            Somme des soldes restants sur les parts de ce filtre, parts en retard comprises.
          </p>
        </Card>
      ) : null}

      {canCreate ? (
        <div>
          <Link
            href={propertyId ? `/charges/nouvelle?immeuble=${propertyId}` : '/charges/nouvelle'}
            className={buttonClasses('primary', 'md')}
          >
            Nouvelle charge
          </Link>
        </div>
      ) : null}

      <nav aria-label="Filtrer les charges" className="flex flex-wrap gap-1">
        {FILTER_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={hrefFor(tab.value)}
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

      {collection.charges.length === 0 ? (
        <EmptyState title={empty.title} description={empty.description} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {collection.charges.map((item) => (
            <ChargeCard key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
