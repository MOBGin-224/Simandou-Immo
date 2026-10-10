import { notFound } from 'next/navigation';

import { ChargeDistribution } from '@/components/charge/charge-distribution';
import { ConfirmChargeActionForm } from '@/components/charge/confirm-charge-action-form';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Overline } from '@/components/ui/overline';
import { PageHeader } from '@/components/ui/page-header';
import { formatDate, formatMonth } from '@/lib/ui/format';
import { describeAllocationMethod, describeCharge, isPublishable } from '@/modules/charges';

import { publishChargeAction } from '../../actions';
import { loadChargeWithPreview } from '../../data';

/**
 * Confirmation de publication (Component Specification section 65, parcours 18
 * étapes 6 et 7).
 *
 * La section 65 décrit cet écran au mot : « Publier les charges ? 12
 * appartements, 3 600 000 GNF, Répartition égale, Annuler, Publier ». Le
 * RÉCAPITULATIF est donc ce que la page porte, et il est calculé par le même
 * chemin que la publication : l'aperçu annonce exactement ce qui sera écrit.
 *
 * **Pourquoi un écran de confirmation, et non un bouton sur la fiche.** La
 * publication crée des créances que des locataires devront, et elle n'est pas
 * rejouable (BR-052) : un clic de trop engagerait douze personnes sans retour
 * possible, sinon par une annulation. C'est la même raison qui fait qu'un
 * archivage ou une révocation passent par un écran dédié, là où la génération
 * des loyers, idempotente, se fait d'un geste.
 *
 * Une charge qui n'est plus publiable, parce qu'elle vient de l'être ou d'être
 * annulée, mène à « introuvable » : l'écran n'a plus d'objet, et proposer un
 * bouton qui refusera ne sert personne.
 */
export async function generateMetadata(props: PageProps<'/charges/[chargeId]/publier'>) {
  const { chargeId } = await props.params;
  const { charge } = await loadChargeWithPreview(chargeId);

  return { title: `Publier ${describeCharge(charge, formatMonth)}` };
}

export default async function PublishChargePage(props: PageProps<'/charges/[chargeId]/publier'>) {
  const { chargeId } = await props.params;
  const { charge, preview } = await loadChargeWithPreview(chargeId);

  if (!isPublishable(charge) || preview === null) notFound();

  const vacantCount = preview.shares.filter((share) => !share.occupied).length;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Publier cette charge ?"
        description={describeCharge(charge, formatMonth)}
        back={{ href: `/charges/${charge.id}`, label: 'La charge' }}
      />

      {/*
        Ce que la publication va FAIRE, en une phrase, avant les nombres : le
        récapitulatif de la section 65 répond à « combien », l'alerte répond à
        « et ensuite ».
      */}
      <Alert tone="warning" title="Chaque part deviendra payable">
        {preview.summary.unitCount === 1
          ? '1 créance sera créée'
          : `${preview.summary.unitCount} créances seront créées, une par logement`}
        , {preview.summary.unitCount === 1 ? 'due' : 'dues'} le {formatDate(charge.dueDate)}. Les
        locataires concernés verront leur part apparaître. Une charge publiée ne peut pas être
        publiée une seconde fois : pour la corriger, il faudra l&apos;annuler et en créer une autre.
      </Alert>

      <Card className="flex flex-col gap-4">
        <Overline>{describeAllocationMethod(charge.allocationMethod)}</Overline>
        <ChargeDistribution
          summary={preview.summary}
          currency={preview.currency}
          shares={preview.shares.map((share) => ({
            apartmentId: share.apartmentId,
            number: share.number,
            amountDue: share.amountDue,
            occupied: share.occupied,
            tenantName: share.tenantName,
          }))}
        />
      </Card>

      {/*
        Le cas que BR-052 traite explicitement, et qu'un gestionnaire doit voir
        AVANT de publier : la part d'un logement vacant reste à la charge du
        bailleur, personne ne la doit.
      */}
      {vacantCount > 0 ? (
        <Alert tone="info" title="Logements vacants">
          {vacantCount === 1
            ? '1 logement sans bail en cours recevra aussi une part'
            : `${vacantCount} logements sans bail en cours recevront aussi une part`}
          . Elle restera à votre charge, aucun locataire n&apos;en étant redevable.
        </Alert>
      ) : null}

      <ConfirmChargeActionForm
        action={publishChargeAction}
        chargeId={charge.id}
        cancelHref={`/charges/${charge.id}`}
        submitLabel="Publier la charge"
        pendingLabel="Publication..."
      />
    </div>
  );
}
