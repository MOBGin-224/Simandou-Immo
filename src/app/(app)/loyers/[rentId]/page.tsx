import Link from 'next/link';

import { Amount } from '@/components/ui/amount';
import { Alert } from '@/components/ui/alert';
import { ReceivableStatusBadge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Overline } from '@/components/ui/overline';
import { PageHeader } from '@/components/ui/page-header';
import { formatDate, formatMoney, formatMonth } from '@/lib/ui/format';
import { describeApartment, describePeriod, isOpen } from '@/modules/rents';

import { loadRentPage } from '../data';

/**
 * Fiche d'une échéance de loyer (MVP-BACKLOG-039, Component Specification 29).
 *
 * MVP-BACKLOG-039 demande cinq choses de cet écran : la liste, le détail, le
 * statut, le SOLDE et l'historique. Les quatre premières sont ici ; la
 * cinquième, l'historique, est le lien vers les autres loyers du même bail,
 * parce que l'historique d'une créance se reconstruit de ses voisines et n'est
 * pas une table à part.
 *
 * **Le solde est le chiffre mis en avant, pas le montant dû.** C'est la somme
 * qu'il reste à réclamer, et c'est elle qui sert à agir. Le montant dû et le
 * montant payé restent lisibles juste en dessous, pour que le calcul se relise :
 * sans eux, un solde réduit par un acompte deviendrait inexplicable.
 *
 * **Aucune action de modification, et c'est une règle du produit.** Le montant
 * vient du contrat (BR-036), le statut de la situation financière (BR-037) : les
 * réécrire à la main reviendrait à mentir sur une dette. Ce qui MANQUE est
 * annoncé plutôt que laissé vide : l'enregistrement d'un paiement arrive au Lot
 * 11, et l'écran le dit, pour qu'un gestionnaire ne cherche pas un bouton
 * absent. C'est la même convention que la fiche d'un bail, qui annonçait les
 * loyers avant ce lot.
 */
export async function generateMetadata(props: PageProps<'/loyers/[rentId]'>) {
  const { rentId } = await props.params;
  const rent = await loadRentPage(rentId);

  return { title: describePeriod(rent.periodStart, formatMonth) };
}

export default async function RentPage(props: PageProps<'/loyers/[rentId]'>) {
  const { rentId } = await props.params;
  const rent = await loadRentPage(rentId);

  const open = isOpen(rent.status);
  const partiallyPaid = rent.amountPaid > 0 && rent.balance > 0;

  const details: { label: string; value: string }[] = [
    { label: 'Montant du loyer', value: formatMoney(rent.amountDue, rent.currency) },
    { label: 'Déjà payé', value: formatMoney(rent.amountPaid, rent.currency) },
    { label: "Date d'échéance", value: formatDate(rent.dueDate) },
    {
      label: 'Période couverte',
      value: `Mois de ${formatMonth(rent.periodStart)}`,
    },
  ];

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={describePeriod(rent.periodStart, formatMonth)}
        description={`${rent.tenant.fullName}, ${describeApartment(rent.apartment)}`}
        back={{ href: '/loyers', label: 'Loyers' }}
      />

      <div>
        <ReceivableStatusBadge status={rent.displayStatus} />
      </div>

      {/*
        Le chiffre que l'écran existe pour montrer. `hero` parce que c'est le
        seul nombre qu'on vient chercher, et la charte réserve cette échelle au
        chiffre clé d'un écran.
      */}
      <Card className="flex flex-col gap-1">
        <Overline as="h2">{open ? 'Reste à payer' : 'Solde'}</Overline>
        <Amount amount={rent.balance} currency={rent.currency} scale="hero" />
        {partiallyPaid ? (
          <p className="text-xs text-muted">
            Un acompte de {formatMoney(rent.amountPaid, rent.currency)} a déjà été reçu sur les{' '}
            {formatMoney(rent.amountDue, rent.currency)} attendus.
          </p>
        ) : null}
      </Card>

      {rent.displayStatus === 'UPCOMING' ? (
        <Alert tone="info" title="Loyer à venir">
          Ce loyer n&apos;est pas encore dû : son échéance tombe le {formatDate(rent.dueDate)}. Il
          n&apos;apparaît donc pas comme impayé.
        </Alert>
      ) : null}

      {rent.displayStatus === 'OVERDUE' ? (
        <Alert tone="warning" title="Échéance dépassée">
          L&apos;échéance du {formatDate(rent.dueDate)} est passée et le solde n&apos;est pas réglé.
          {rent.tenant.phone ? ' Le numéro du locataire figure ci-dessous.' : ''}
        </Alert>
      ) : null}

      <Card className="flex flex-col gap-4">
        <Overline>La créance</Overline>

        <dl className="flex flex-col gap-3">
          {details.map((detail) => (
            <div key={detail.label} className="flex flex-col gap-0.5">
              <Overline as="dt">{detail.label}</Overline>
              <dd data-numeric className="break-words text-base text-ink">
                {detail.value}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="flex flex-col gap-4">
        <Overline>Qui doit ce loyer</Overline>

        <dl className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <Overline as="dt">Locataire</Overline>
            <dd className="break-words text-base text-ink">
              {/*
                Le lien part du `userId`, l'identité métier de la personne
                (DEC-051), parce que c'est ce que `/locataires/:id` attend.
                `accessId` ne sert qu'à savoir si une fiche existe : une personne
                sans accès au produit a bien une fiche locataire, mais seulement
                si une organisation la connaît, ce que l'existence de cette
                créance garantit.
              */}
              <Link
                href={`/locataires/${rent.tenant.userId}?organisation=${rent.organizationId}`}
                className="inline-flex min-h-11 items-center text-action-strong underline underline-offset-4 hover:text-brand"
              >
                {rent.tenant.fullName}
              </Link>
              {rent.tenant.phone ? (
                /*
                  Le numéro est un lien d'APPEL et non un texte : un loyer impayé
                  se règle en téléphonant, et sur un mobile recopier un numéro à
                  la main est la friction qui fait remettre l'appel à plus tard.
                */
                <a
                  href={`tel:${rent.tenant.phone}`}
                  className="block min-h-11 text-sm text-action-strong underline underline-offset-4 hover:text-brand"
                >
                  {rent.tenant.phone}
                </a>
              ) : null}
            </dd>
          </div>

          <div className="flex flex-col gap-0.5">
            <Overline as="dt">Logement</Overline>
            <dd className="break-words text-base text-ink">
              <Link
                href={`/immeubles/${rent.apartment.propertyId}/appartements/${rent.apartment.id}`}
                className="inline-flex min-h-11 items-center text-action-strong underline underline-offset-4 hover:text-brand"
              >
                {describeApartment(rent.apartment)}
              </Link>
            </dd>
          </div>

          <div className="flex flex-col gap-0.5">
            <Overline as="dt">Contrat</Overline>
            <dd className="text-base text-ink">
              <Link
                href={`/baux/${rent.leaseId}`}
                className="inline-flex min-h-11 items-center text-action-strong underline underline-offset-4 hover:text-brand"
              >
                Voir le bail
              </Link>
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="flex flex-col gap-3">
        <Overline>Historique de ce contrat</Overline>
        <p className="text-sm text-muted">
          Les autres loyers du même bail, du plus urgent au plus ancien.
        </p>
        <div>
          <Link
            href={`/loyers?bail=${rent.leaseId}&statut=ALL`}
            className={buttonClasses('secondary', 'md')}
          >
            Voir tous les loyers de ce bail
          </Link>
        </div>
      </Card>

      <Alert tone="info" title="Enregistrer un paiement">
        L&apos;enregistrement des paiements arrive au lot suivant. D&apos;ici là, un loyer encaissé
        en main propre ou par transfert reste à marquer hors de l&apos;application : le solde
        affiché ici ne tient compte que des paiements enregistrés.
      </Alert>
    </div>
  );
}
