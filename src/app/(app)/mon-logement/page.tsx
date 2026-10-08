import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Alert } from '@/components/ui/alert';
import { Amount } from '@/components/ui/amount';
import { AccessStatusBadge, ReceivableStatusBadge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Overline } from '@/components/ui/overline';
import { PageHeader } from '@/components/ui/page-header';
import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { formatDate, formatMoney, formatMonth } from '@/lib/ui/format';
import {
  describeApartment as describeLeaseApartment,
  describePeriod,
  listMyLeases,
} from '@/modules/leases';
import {
  describePeriod as describeRentPeriod,
  getMyOutstanding,
  isOpen,
  listMyRents,
} from '@/modules/rents';
import { describeApartment, getMyTenantSpace } from '@/modules/tenants';

/**
 * Espace locataire, racine de l'architecture du locataire (Information
 * Architecture 7.3, MVP-BACKLOG-030).
 *
 * Cet espace montre ce qui existe : le logement, l'organisation qui le gère, le
 * statut de l'accès, le nom que la personne peut corriger (DEC-048), et depuis le
 * Lot 8 SON CONTRAT, que BR-021 lui ouvre explicitement. Il ne peut pas le
 * modifier : les données financières de référence ne sont pas les siennes
 * (BR-022).
 *
 * **Depuis le Lot 9, il montre aussi CE QU'IL DOIT.** Le total dû est calculé par
 * le serveur et affiché en premier, avant le détail : c'est le montant qu'une
 * personne lit avant de payer, et BR-039 interdit au frontend de le recomposer.
 *
 * **Et il dit ce qui n'existe pas encore.** « Paiements », « Quittances »,
 * « Mes charges » et « Mes incidents » sont des destinations de l'architecture
 * cible que les lots suivants rempliront. Les afficher vides laisserait croire à
 * une panne ; les annoncer explique l'attente.
 *
 * La page n'existe pas pour qui n'est pas locataire : un propriétaire ou un
 * gestionnaire n'a pas d'espace locataire, et c'est la liste des locataires qui
 * lui sert.
 */
export const metadata = { title: 'Mon logement' };

export default async function MyApartmentPage() {
  const context = await requireAccessContextOrSignIn();
  const tenant = await getMyTenantSpace(getDb(), context);

  if (!tenant) notFound();

  /*
   * SON contrat (BR-021).
   *
   * Le locataire consulte son bail : c'est l'une des informations que BR-021 lui
   * ouvre explicitement. Il ne peut pas le modifier, les données financières de
   * référence n'étant pas les siennes (BR-022).
   */
  const leases = await listMyLeases(getDb(), context);
  const activeLease = leases.find((lease) => lease.status === 'ACTIVE') ?? null;

  /*
   * SES loyers, et ce qu'il doit (BR-021, BR-039).
   *
   * Deux lectures et non une, parce qu'elles répondent à deux questions
   * différentes. Le TOTAL vient du serveur, qui est seul à le calculer : la
   * section 18 de l'API l'impose, « le frontend ne le recompose jamais », et
   * c'est le chiffre sur lequel une personne décide de payer. La LISTE sert
   * ensuite à savoir de quels mois il s'agit.
   *
   * Le total porte sur les créances OUVERTES, la liste sur toutes : un locataire
   * doit pouvoir vérifier ce qu'il a déjà réglé, c'est même la première chose
   * qu'il viendra chercher en cas de désaccord.
   */
  const outstanding = await getMyOutstanding(getDb(), context);
  const rents = await listMyRents(getDb(), context);
  const openRents = rents.filter((rent) => isOpen(rent.status));
  const settledRents = rents.filter((rent) => !isOpen(rent.status));
  /* L'ordre place les créances soldées les plus récentes en tête (`compareRentItems`). */
  const lastSettled = settledRents[0];

  /*
   * Le logement vient du BAIL dès qu'il y en a un.
   *
   * L'espace locataire du Lot 7 lisait le logement de l'invitation acceptée,
   * faute de bail (DEC-046). Les deux peuvent diverger : on invite une personne
   * sur un logement, puis on lui loue un autre. Afficher les deux sources côte à
   * côte donnerait un écran qui se contredit, exactement ce que DEC-050 reproche
   * à une saisie concurrente. Le bail fait donc foi, et l'invitation ne sert plus
   * qu'en son absence, tant que la bascule complète du module Locataires n'est
   * pas faite.
   */
  const apartmentLabel = activeLease
    ? describeLeaseApartment(activeLease.apartment)
    : describeApartment(tenant.apartment);

  const details: { label: string; value: string }[] = [
    { label: 'Logement', value: apartmentLabel },
    { label: 'Gestion assurée par', value: tenant.organizationName },
    { label: 'Votre numéro de connexion', value: tenant.phone ?? 'Non renseigné' },
    { label: 'Votre adresse email', value: tenant.email ?? 'Non renseignée' },
    {
      label: 'Espace ouvert le',
      value: tenant.activatedAt ? formatDate(tenant.activatedAt.toISOString()) : 'Non renseigné',
    },
  ];

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title={`Bonjour ${tenant.fullName}`} description="Votre espace locataire" />

      <div>
        <AccessStatusBadge status={tenant.status} />
      </div>

      {/* Ni bail ni invitation ne donnent de logement : il n'y a rien à montrer. */}
      {activeLease === null && tenant.apartment === null ? (
        <Alert tone="info" title="Logement non renseigné">
          Votre logement n&apos;est pas encore rattaché à votre espace. Adressez-vous à la personne
          qui gère l&apos;immeuble.
        </Alert>
      ) : null}

      <Card className="flex flex-col gap-4">
        <Overline>Mon logement</Overline>

        <dl className="flex flex-col gap-3">
          {details.map((detail) => (
            <div key={detail.label} className="flex flex-col gap-0.5">
              <Overline as="dt">{detail.label}</Overline>
              <dd className="break-words text-base text-ink">{detail.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="flex flex-col gap-4">
        <Overline>Mon profil</Overline>

        <p className="text-sm text-muted">
          Vous pouvez corriger votre nom. Votre numéro de téléphone sert à vous connecter, et ni lui
          ni votre adresse email ne sont modifiables pour le moment : les changer demanderait une
          vérification que le produit ne sait pas encore mener.
        </p>

        <Link href="/mon-logement/nom" className={buttonClasses('secondary', 'md', true)}>
          Modifier mon nom
        </Link>
      </Card>

      <Card className="flex flex-col gap-4">
        <Overline>Mon contrat</Overline>

        {activeLease ? (
          <dl className="flex flex-col gap-3">
            {/* Le logement est déjà en tête de page : le répéter ici n'ajouterait rien. */}
            <div className="flex flex-col gap-0.5">
              <Overline as="dt">Période</Overline>
              <dd className="text-base text-ink">{describePeriod(activeLease, formatDate)}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <Overline as="dt">Loyer mensuel</Overline>
              <dd className="text-base text-ink">
                {formatMoney(activeLease.rent.amount, activeLease.rent.currency)}, dû le{' '}
                {activeLease.dueDay} de chaque mois
              </dd>
            </div>
            {activeLease.deposit.amount > 0 ? (
              <div className="flex flex-col gap-0.5">
                <Overline as="dt">Caution</Overline>
                <dd className="text-base text-ink">
                  {formatMoney(activeLease.deposit.amount, activeLease.deposit.currency)}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="text-sm text-muted">
            Vous n&apos;avez pas encore de contrat enregistré. La personne qui gère l&apos;immeuble
            le créera, et il apparaîtra ici.
          </p>
        )}

        <p className="text-xs text-muted">
          Ces informations sont celles du contrat. Pour les corriger, adressez-vous à la personne
          qui gère l&apos;immeuble.
        </p>
      </Card>

      <Card className="flex flex-col gap-4">
        <Overline>Mes loyers</Overline>

        {/*
          Le total AVANT le détail, et seulement s'il y a quelque chose à devoir.
          Afficher « 0 GNF » en grand à qui est à jour transformerait une bonne
          nouvelle en alerte.
        */}
        {outstanding.totalOutstanding > 0 ? (
          <div className="flex flex-col gap-1">
            <Overline as="h3">Total à payer</Overline>
            <Amount
              amount={outstanding.totalOutstanding}
              currency={outstanding.currency}
              scale="hero"
            />
          </div>
        ) : null}

        {openRents.length === 0 ? (
          <p className="text-sm text-muted">
            {rents.length === 0
              ? "Aucun loyer ne vous est encore réclamé. Ils apparaîtront ici dès que la personne qui gère l'immeuble les aura établis."
              : 'Vous êtes à jour : aucun loyer ne reste à payer.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {openRents.map((rent) => (
              <li
                key={rent.id}
                className="flex flex-col gap-1 border-t border-line pt-3 first:border-t-0 first:pt-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-display text-base font-semibold text-ink">
                    {describeRentPeriod(rent.periodStart, formatMonth)}
                  </span>
                  <ReceivableStatusBadge status={rent.displayStatus} />
                </div>
                <Amount amount={rent.balance} currency={rent.currency} scale="key" />
                <span className="text-xs text-muted">
                  {rent.amountPaid > 0
                    ? `Échéance du ${formatDate(rent.dueDate)}, acompte de ${formatMoney(rent.amountPaid, rent.currency)} déjà reçu`
                    : `Échéance du ${formatDate(rent.dueDate)}`}
                </span>
              </li>
            ))}
          </ul>
        )}

        {lastSettled ? (
          <p className="text-xs text-muted">
            {settledRents.length === 1
              ? '1 loyer déjà réglé.'
              : `${settledRents.length} loyers déjà réglés.`}{' '}
            Le dernier portait sur le mois de {formatMonth(lastSettled.periodStart)}.
          </p>
        ) : null}

        <p className="text-xs text-muted">
          Le paiement en ligne n&apos;est pas encore disponible. Réglez comme vous le faites
          d&apos;habitude, et la personne qui gère l&apos;immeuble enregistrera votre paiement.
        </p>
      </Card>

      <Card className="flex flex-col gap-3">
        <Overline>Prochainement</Overline>
        <p className="text-sm text-muted">
          Vos paiements, vos quittances, vos charges et vos incidents apparaîtront ici. Ils
          arriveront avec les prochaines étapes du produit, et rien ne vous est demandé en
          attendant.
        </p>
      </Card>
    </div>
  );
}
