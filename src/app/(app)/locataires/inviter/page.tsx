import Link from 'next/link';
import { notFound } from 'next/navigation';

import { InviteTenantForm, type ApartmentChoice } from '@/components/tenant/invite-tenant-form';
import { buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { readablePropertyScopes } from '@/lib/authorization';
import { listApartments } from '@/modules/apartments';
import { listProperties } from '@/modules/properties';

import { inviteTenantAction } from '../actions';

/**
 * Invitation d'un locataire (parcours 7, MVP-BACKLOG-029).
 *
 * L'écran est refusé d'emblée à qui ne porte `tenant.invite` sur aucun immeuble :
 * sans périmètre, la page n'existe pas pour cet utilisateur. Cela évite de
 * laisser remplir un formulaire qui serait rejeté à la fin.
 *
 * Seuls les logements ACTIFS d'immeubles ACTIFS sont proposés : un logement
 * archivé ne peut pas recevoir de locataire (DEC-020, BR-025). Les logements
 * occupés le sont, en revanche : ce parcours sert précisément à inscrire des
 * locataires déjà en place, et une invitation ne change aucun statut d'occupation
 * (DEC-050).
 *
 * Le logement peut venir du parcours, par `?logement=`, quand on arrive depuis sa
 * fiche. Il est alors imposé et affiché, non ressaisi.
 */
export const metadata = { title: 'Inviter un locataire' };

/** Bornes de pagination du serveur, celles des deux listes appelées. */
const PAGE_SIZE = 100;

export default async function InviteTenantPage(props: PageProps<'/locataires/inviter'>) {
  const context = await requireAccessContextOrSignIn();
  const scopes = readablePropertyScopes(context, 'tenant.invite');

  if (scopes.length === 0) notFound();

  const searchParams = await props.searchParams;
  const requested = Array.isArray(searchParams.logement)
    ? searchParams.logement[0]
    : searchParams.logement;

  /*
   * Les immeubles d'abord, puis les logements de chacun. Deux niveaux de lecture
   * sont inévitables : un logement ne se liste que par son immeuble (BR-026), et
   * c'est l'immeuble qui porte le périmètre d'un gestionnaire (ADR-007).
   */
  const choices: ApartmentChoice[] = [];

  for (const scope of scopes) {
    const properties = await listProperties(getDb(), context, {
      organizationId: scope.organizationId,
      filter: 'ACTIVE',
      pageSize: PAGE_SIZE,
    });

    for (const property of properties.properties) {
      if (scope.propertyIds !== 'all' && !scope.propertyIds.includes(property.id)) continue;

      const apartments = await listApartments(getDb(), context, property.id, {
        status: 'ALL',
        pageSize: PAGE_SIZE,
      });

      for (const apartment of apartments.apartments) {
        if (apartment.archived) continue;

        choices.push({ id: apartment.id, label: `${apartment.number}, ${property.name}` });
      }
    }
  }

  choices.sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }));

  // Un logement demandé par l'adresse n'est imposé que s'il fait partie des choix :
  // sinon il est hors périmètre, et le silence vaut mieux qu'un refus bavard.
  const fixedApartmentId = choices.some((choice) => choice.id === requested)
    ? requested
    : undefined;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Inviter un locataire"
        description="Vous obtiendrez un lien à transmettre vous-même. La personne l'ouvrira pour ouvrir son espace locataire. Le loyer et le contrat viendront ensuite."
        back={{ href: '/locataires', label: 'Locataires' }}
      />

      {choices.length > 0 ? (
        <InviteTenantForm
          action={inviteTenantAction}
          apartments={choices}
          fixedApartmentId={fixedApartmentId}
          cancelHref="/locataires"
        />
      ) : (
        <EmptyState
          title="Aucun logement disponible"
          description="Un locataire est invité à un logement précis. Créez d'abord un logement dans un de vos immeubles."
          action={
            <Link href="/immeubles" className={buttonClasses('primary', 'md')}>
              Voir mes immeubles
            </Link>
          }
        />
      )}
    </div>
  );
}
