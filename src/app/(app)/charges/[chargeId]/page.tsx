import Link from 'next/link';

import { ChargeDistribution } from '@/components/charge/charge-distribution';
import { Alert } from '@/components/ui/alert';
import { Amount } from '@/components/ui/amount';
import { ChargeStatusBadge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Overline } from '@/components/ui/overline';
import { PageHeader } from '@/components/ui/page-header';
import { formatDate, formatMoney, formatMonth, formatMonthOf, pluralize } from '@/lib/ui/format';
import {
  describeAllocationMethod,
  describeCharge,
  describeChargeType,
  isCancellable,
  isPublishable,
} from '@/modules/charges';

import { loadChargeWithPreview } from '../data';

/**
 * Fiche d'une charge (MVP-BACKLOG-054, Component Specification 31 et 32).
 *
 * **Un écran, deux moments.** Avant publication, il montre l'APERÇU : les
 * logements concernés, la part de chacun, et le bouton qui engage. Après
 * publication, il montre les CRÉANCES réellement créées, avec leur statut de
 * règlement. C'est volontairement le même écran, parce que c'est le même objet,
 * et parce que la comparaison entre ce qui était annoncé et ce qui a été créé
 * doit se faire au même endroit.
 *
 * **Le montant mis en avant est le total de la facture**, et non un solde : une
 * charge est une facture répartie (BR-049), et c'est sous ce montant qu'on en
 * parle. Ce qu'il reste à encaisser figure juste en dessous dès qu'une
 * publication a eu lieu.
 *
 * **Ce qui MANQUE est annoncé plutôt que laissé vide.** L'enregistrement d'un
 * paiement arrive au Lot 11 : l'écran le dit, pour qu'un gestionnaire ne cherche
 * pas un bouton absent. C'est la même convention que la fiche d'un loyer.
 *
 * **Aucun bouton de modification**, et c'est une règle du produit : BR-053
 * interdit de corriger une charge en silence. Un brouillon erroné s'annule et se
 * recrée, ce qui laisse les deux dans l'historique (BR-054).
 */
export async function generateMetadata(props: PageProps<'/charges/[chargeId]'>) {
  const { chargeId } = await props.params;
  const { charge } = await loadChargeWithPreview(chargeId);

  return { title: describeCharge(charge, formatMonth) };
}

export default async function ChargePage(props: PageProps<'/charges/[chargeId]'>) {
  const { chargeId } = await props.params;
  const { charge, preview } = await loadChargeWithPreview(chargeId);

  const published = charge.status === 'PUBLISHED';

  const details: { label: string; value: string }[] = [
    { label: 'Nature', value: describeChargeType(charge.type) },
    { label: 'Immeuble', value: charge.property.name },
    { label: 'Période couverte', value: `Mois ${formatMonthOf(charge.periodStart)}` },
    { label: "Date d'échéance", value: formatDate(charge.dueDate) },
    { label: 'Répartition', value: describeAllocationMethod(charge.allocationMethod) },
    { label: 'Fournisseur', value: charge.supplierName ?? 'Non renseigné' },
  ];

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={describeCharge(charge, formatMonth)}
        description={charge.property.name}
        back={{ href: '/charges', label: 'Charges' }}
      />

      <div>
        <ChargeStatusBadge status={charge.status} />
      </div>

      {/*
        Le chiffre que l'écran existe pour montrer. `hero` parce que c'est le
        seul nombre qu'on vient chercher, et la charte réserve cette échelle au
        chiffre clé d'un écran.
      */}
      <Card className="flex flex-col gap-1">
        <Overline as="h2">Montant de la facture</Overline>
        <Amount amount={charge.totalAmount} currency={charge.currency} scale="hero" />
        {published ? (
          <p className="text-xs text-muted">
            Réparti entre {pluralize(charge.unitCount, 'logement')}.{' '}
            {charge.totalOutstanding > 0
              ? `Il reste ${formatMoney(charge.totalOutstanding, charge.currency)} à encaisser.`
              : 'Tout est encaissé.'}
          </p>
        ) : null}
      </Card>

      {charge.status === 'DRAFT' ? (
        <Alert tone="info" title="Brouillon : rien n'est dû">
          Cette charge n&apos;a créé aucune créance et n&apos;est visible d&apos;aucun locataire.
          Vérifiez la répartition ci-dessous, puis publiez-la pour que chaque part devienne payable.
        </Alert>
      ) : null}

      {charge.status === 'CANCELLED' ? (
        <Alert tone="warning" title="Charge annulée">
          Les parts de cette charge ont été annulées et ne sont plus dues. Rien n&apos;a été
          supprimé : la facture, ses parts et les paiements déjà reçus restent consultables.
        </Alert>
      ) : null}

      <Card className="flex flex-col gap-4">
        <Overline>La facture</Overline>

        <dl className="flex flex-col gap-3">
          {details.map((detail) => (
            <div key={detail.label} className="flex flex-col gap-0.5">
              <Overline as="dt">{detail.label}</Overline>
              <dd data-numeric className="break-words text-base text-ink">
                {detail.value}
              </dd>
            </div>
          ))}
          {charge.publishedAt ? (
            <div className="flex flex-col gap-0.5">
              <Overline as="dt">Publiée le</Overline>
              <dd className="text-base text-ink">{formatDate(charge.publishedAt.slice(0, 10))}</dd>
            </div>
          ) : null}
          {charge.cancelledAt ? (
            <div className="flex flex-col gap-0.5">
              <Overline as="dt">Annulée le</Overline>
              <dd className="text-base text-ink">{formatDate(charge.cancelledAt.slice(0, 10))}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      {/*
        Les parts RÉELLES quand la charge est publiée ou annulée, l'aperçu quand
        elle est encore un brouillon. Les deux se lisent avec le même composant :
        c'est la même répartition, avant et après qu'elle engage quelqu'un.
      */}
      {charge.allocations.length > 0 ? (
        <Card className="flex flex-col gap-4">
          <Overline>Répartition</Overline>
          <ChargeDistribution
            summary={{
              method: charge.allocationMethod,
              totalAmount: charge.totalAmount,
              unitCount: charge.unitCount,
              baseShare: charge.allocations[0]?.explanation.baseShare ?? 0,
              adjustedUnitCount: charge.allocations.filter(
                (allocation) => allocation.explanation.roundingAdjustment === 1,
              ).length,
              allocatedAmount: charge.allocations.reduce(
                (sum, allocation) => sum + allocation.amountDue,
                0,
              ),
            }}
            currency={charge.currency}
            shares={charge.allocations.map((allocation) => ({
              apartmentId: allocation.apartment.id,
              number: allocation.apartment.number,
              amountDue: allocation.amountDue,
              occupied: allocation.tenant !== null,
              tenantName: allocation.tenant?.fullName ?? null,
              status: allocation.displayStatus,
              balance: allocation.balance,
            }))}
          />
        </Card>
      ) : null}

      {charge.allocations.length === 0 && preview !== null ? (
        <Card className="flex flex-col gap-4">
          <Overline>Répartition prévue</Overline>
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
      ) : null}

      {charge.allocations.length === 0 && preview === null ? (
        <Alert tone="warning" title="Aucun logement à répartir">
          Cet immeuble n&apos;a aucun logement actif : il n&apos;y a personne entre qui répartir
          cette charge. Ajoutez un logement, ou annulez la charge.
        </Alert>
      ) : null}

      {/*
        Les deux gestes du lot. « Publier » est primaire tant qu'il reste à
        faire : c'est l'action que cet écran attend. L'annulation est secondaire
        et reste offerte après publication, parce que retirer une facture
        publiée à tort est précisément ce que BR-054 prévoit.
      */}
      {isPublishable(charge) || isCancellable(charge) ? (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {isCancellable(charge) ? (
            <Link
              href={`/charges/${charge.id}/annuler`}
              className={buttonClasses('secondary', 'md')}
            >
              Annuler la charge
            </Link>
          ) : null}
          {isPublishable(charge) && preview !== null ? (
            <Link href={`/charges/${charge.id}/publier`} className={buttonClasses('primary', 'md')}>
              Publier la charge
            </Link>
          ) : null}
        </div>
      ) : null}

      {published ? (
        <Alert tone="info" title="Enregistrer un paiement">
          L&apos;enregistrement des paiements arrive au lot suivant. D&apos;ici là, une part
          encaissée en main propre ou par transfert reste à marquer hors de l&apos;application : les
          soldes affichés ici ne tiennent compte que des paiements enregistrés.
        </Alert>
      ) : null}
    </div>
  );
}
