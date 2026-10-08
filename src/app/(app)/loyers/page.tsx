import Link from 'next/link';
import { notFound } from 'next/navigation';

import { GenerateRentsForm } from '@/components/rent/generate-rents-form';
import { RentCard } from '@/components/rent/rent-card';
import { Amount } from '@/components/ui/amount';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Overline } from '@/components/ui/overline';
import { PageHeader } from '@/components/ui/page-header';
import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { ResourceOutOfScopeError, readablePropertyScopes } from '@/lib/authorization';
import { cn } from '@/lib/ui/cn';
import { pluralize } from '@/lib/ui/format';
import { RENT_LIST_FILTERS, listRents, type RentListFilter } from '@/modules/rents';

import { generateRentsAction } from './actions';

/**
 * Liste des échéances de loyer (MVP-BACKLOG-039).
 *
 * **Ce que cet écran sert à faire : savoir qui doit de l'argent.** C'est pourquoi
 * l'onglet par défaut est « Impayés » et non « Tous », pourquoi l'ordre place le
 * retard le plus ancien en tête, et pourquoi le total dû est affiché en haut,
 * avant la liste : la première question d'un bailleur n'est pas « quelles sont
 * mes créances » mais « combien me doit-on ».
 *
 * Les filtres passent par l'URL et non par un état local. Trois bénéfices
 * concrets : la page est partageable, le bouton retour du navigateur fonctionne,
 * et le filtrage marche sans JavaScript.
 *
 * Ouverte au propriétaire ET au gestionnaire, chacun sur son périmètre. Pour un
 * locataire, la page n'existe pas : il consulte SES loyers depuis son espace,
 * son rattachement étant lui-même et non un immeuble (BR-021). C'est la même
 * frontière que pour les baux.
 */
export const metadata = { title: 'Loyers' };

/**
 * Onglets de l'écran.
 *
 * Le premier s'appelle « À régler » et NON « Impayés », et ce n'est pas un
 * détail de vocabulaire. Il porte les créances OUVERTES au sens de BR-039,
 * c'est-à-dire `UNPAID`, `PARTIALLY_PAID` et `OVERDUE` : un loyer du mois dont
 * l'échéance n'est pas encore atteinte en fait partie, et il s'affiche « À
 * venir ». Un onglet « Impayés » contenant des lignes marquées « À venir » se
 * contredisait à l'écran, constaté en le regardant.
 *
 * C'est aussi le même ensemble que le TOTAL DÛ affiché au-dessus : les deux
 * doivent se lire ensemble, et un onglet plus étroit que le total aurait donné
 * une somme qu'aucune liste ne justifie.
 */
const FILTER_TABS: { value: RentListFilter; label: string }[] = [
  { value: 'OUTSTANDING', label: 'À régler' },
  { value: 'UPCOMING', label: 'À venir' },
  { value: 'PAID', label: 'Payés' },
  { value: 'ALL', label: 'Tous' },
];

/**
 * Ce que l'écran dit quand un filtre ne ramène rien.
 *
 * Les HUIT filtres y figurent, et pas seulement les quatre onglets : les autres
 * restent atteignables par l'URL, et une table partielle y afficherait le
 * message d'un autre état. Un vide bien formulé est une information, « tout est
 * à jour » n'étant pas la même chose que « rien n'a encore été généré ».
 */
const EMPTY_BY_FILTER: Record<RentListFilter, { title: string; description: string }> = {
  OUTSTANDING: {
    title: 'Aucun loyer à régler',
    description: 'Tout est à jour sur votre périmètre. Les loyers du mois apparaîtront ici.',
  },
  UPCOMING: {
    title: 'Aucun loyer à venir',
    description:
      "Un loyer est « à venir » tant que sa date d'échéance n'est pas atteinte. Générez les loyers du mois pour les voir arriver.",
  },
  UNPAID: {
    title: 'Aucun loyer impayé',
    description: "Aucun loyer n'attend de paiement sur votre périmètre.",
  },
  PARTIALLY_PAID: {
    title: 'Aucun loyer partiellement payé',
    description: 'Les loyers sur lesquels un acompte a été reçu apparaîtront ici.',
  },
  PAID: {
    title: 'Aucun loyer payé',
    description: 'Les loyers soldés apparaîtront ici, du plus récent au plus ancien.',
  },
  OVERDUE: {
    title: 'Aucun loyer en retard',
    description: "Aucune échéance dépassée n'attend de règlement sur votre périmètre.",
  },
  CANCELLED: {
    title: 'Aucun loyer annulé',
    description: "Un loyer annulé reste consultable ici, l'annulation laissant une trace.",
  },
  ALL: {
    title: 'Aucun loyer',
    description:
      'Les loyers naissent des baux en cours, un par mois et par contrat. Générez ceux du mois, ou attendez le passage automatique.',
  },
};

export default async function RentsPage(props: PageProps<'/loyers'>) {
  const context = await requireAccessContextOrSignIn();
  const searchParams = await props.searchParams;

  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

  /*
   * Un filtre inconnu retombe sur le défaut au lieu de faire échouer l'écran.
   *
   * Une adresse bricolée à la main, ou un lien devenu obsolète, ne doit pas
   * produire une page d'erreur : le schéma du cas d'usage refuserait la valeur,
   * et c'est bien le rôle d'un schéma, mais ici la question « quel onglet
   * afficher » a une réponse raisonnable.
   */
  const requested = first(searchParams.statut);
  const status: RentListFilter = (RENT_LIST_FILTERS as readonly string[]).includes(requested ?? '')
    ? (requested as RentListFilter)
    : 'OUTSTANDING';

  let collection;

  try {
    collection = await listRents(getDb(), context, {
      status,
      page: first(searchParams.page),
      propertyId: first(searchParams.immeuble) ?? null,
      apartmentId: first(searchParams.logement) ?? null,
      tenantId: first(searchParams.locataire) ?? null,
      leaseId: first(searchParams.bail) ?? null,
      period: first(searchParams.periode) ?? null,
    });
  } catch (error) {
    if (error instanceof ResourceOutOfScopeError) notFound();

    throw error;
  }

  const canGenerate = readablePropertyScopes(context, 'rent.generate').length > 0;
  const empty = EMPTY_BY_FILTER[status];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Loyers"
        description={
          collection.meta.total === 0
            ? 'Les loyers de vos baux en cours apparaîtront ici.'
            : pluralize(collection.meta.total, 'loyer')
        }
        back={{ href: '/immeubles', label: 'Immeubles' }}
      />

      {/*
        Le total dû AVANT la liste, et seulement s'il y a quelque chose à devoir.
        Il est calculé par le serveur sur l'ensemble du filtre et non sur la page
        affichée (BR-039) : une somme des cartes visibles annoncerait une dette
        fausse dès la deuxième page.
      */}
      {collection.totalOutstanding > 0 && collection.currency !== null ? (
        <Card className="flex flex-col gap-1">
          <Overline as="h2">Total dû</Overline>
          <Amount
            amount={collection.totalOutstanding}
            currency={collection.currency}
            scale="hero"
          />
          <p className="text-xs text-muted">
            Somme des soldes restants sur ce filtre, loyers en retard compris.
          </p>
        </Card>
      ) : null}

      {canGenerate ? (
        <GenerateRentsForm
          action={generateRentsAction}
          propertyId={first(searchParams.immeuble) ?? undefined}
        />
      ) : null}

      <nav aria-label="Filtrer les loyers" className="flex flex-wrap gap-1">
        {FILTER_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === 'OUTSTANDING' ? '/loyers' : `/loyers?statut=${tab.value}`}
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

      {collection.rents.length === 0 ? (
        <EmptyState title={empty.title} description={empty.description} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {collection.rents.map((item) => (
            <RentCard key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
