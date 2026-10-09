import { notFound } from 'next/navigation';

import { ChargeForm } from '@/components/charge/charge-form';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { readablePropertyScopes } from '@/lib/authorization';
import { today } from '@/modules/receivables';
import { listProperties } from '@/modules/properties';

import { createChargeAction } from '../actions';

/**
 * Enregistrement d'une charge (parcours 18, MVP-BACKLOG-051 et 054).
 *
 * L'écran ne porte que les quatre premières étapes du parcours : la nature, le
 * montant, la période et l'immeuble. La répartition, sa vérification et la
 * publication viennent APRÈS, sur la fiche, parce qu'elles n'engagent personne
 * tant que la charge est un brouillon (BR-052). C'est ce découpage qui rend
 * l'étape 6 du parcours possible, « le gestionnaire vérifie ».
 *
 * Les immeubles proposés sont ceux où l'appelant peut réellement enregistrer une
 * charge : le périmètre vient du point de décision unique, et les archivés sont
 * écartés, un immeuble sorti de l'exploitation ne recevant plus de facture
 * nouvelle (DEC-020).
 *
 * Sans aucun immeuble, l'écran le DIT au lieu d'afficher un formulaire dont la
 * première liste serait vide : une charge appartient à un immeuble, et sans
 * immeuble il n'y a rien à saisir.
 */
export const metadata = { title: 'Nouvelle charge' };

export default async function NewChargePage(props: PageProps<'/charges/nouvelle'>) {
  const context = await requireAccessContextOrSignIn();
  const searchParams = await props.searchParams;

  // Un locataire n'a aucun périmètre de création : la page n'existe pas pour lui,
  // et le refus est « introuvable » comme partout ailleurs (ADR-007).
  if (readablePropertyScopes(context, 'charge.create').length === 0) notFound();

  const collection = await listProperties(getDb(), context, {
    status: 'ACTIVE',
    pageSize: 100,
  });

  const requested = searchParams.immeuble;
  const fixedPropertyId = Array.isArray(requested) ? requested[0] : requested;

  /*
   * La devise affichée sous le montant est celle du premier immeuble lisible :
   * une seule devise existe au MVP (DEC-014), et le champ n'a pas à la demander.
   * Le cas d'usage prendra celle de l'organisation de l'immeuble choisi.
   */
  const currency = 'GNF';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nouvelle charge"
        description="Une facture reçue par l'immeuble, à répartir entre les logements."
        back={{ href: '/charges', label: 'Charges' }}
      />

      {collection.properties.length === 0 ? (
        <EmptyState
          title="Aucun immeuble"
          description="Une charge appartient à un immeuble. Créez d'abord un immeuble, ou demandez qu'un immeuble vous soit confié."
        />
      ) : (
        <ChargeForm
          action={createChargeAction}
          cancelHref="/charges"
          properties={collection.properties.map((property) => ({
            id: property.id,
            name: property.name,
          }))}
          fixedPropertyId={
            collection.properties.some((property) => property.id === fixedPropertyId)
              ? fixedPropertyId
              : undefined
          }
          /* Le mois en cours : la facture qu'on enregistre est presque toujours celle du mois. */
          defaultPeriod={today().slice(0, 7)}
          currency={currency}
        />
      )}
    </div>
  );
}
