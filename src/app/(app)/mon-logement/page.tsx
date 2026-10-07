import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Alert } from '@/components/ui/alert';
import { AccessStatusBadge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { formatDate, formatMoney } from '@/lib/ui/format';
import {
  describeApartment as describeLeaseApartment,
  describePeriod,
  listMyLeases,
} from '@/modules/leases';
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
 * **Et il dit ce qui n'existe pas encore.** « À payer », « Paiements »,
 * « Quittances », « Mes charges » et « Mes incidents » sont des destinations de
 * l'architecture cible que les lots suivants rempliront. Les afficher vides
 * laisserait croire à une panne ; les annoncer explique l'attente.
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
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
          Mon logement
        </h2>

        <dl className="flex flex-col gap-3">
          {details.map((detail) => (
            <div key={detail.label} className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                {detail.label}
              </dt>
              <dd className="break-words text-base text-ink">{detail.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
          Mon profil
        </h2>

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
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
          Mon contrat
        </h2>

        {activeLease ? (
          <dl className="flex flex-col gap-3">
            {/* Le logement est déjà en tête de page : le répéter ici n'ajouterait rien. */}
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Période</dt>
              <dd className="text-base text-ink">{describePeriod(activeLease, formatDate)}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                Loyer mensuel
              </dt>
              <dd className="text-base text-ink">
                {formatMoney(activeLease.rent.amount, activeLease.rent.currency)}, dû le{' '}
                {activeLease.dueDay} de chaque mois
              </dd>
            </div>
            {activeLease.deposit.amount > 0 ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted">Caution</dt>
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

      <Card className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
          Prochainement
        </h2>
        <p className="text-sm text-muted">
          Vos loyers à payer, vos paiements, vos quittances, vos charges et vos incidents
          apparaîtront ici. Ils arriveront avec les prochaines étapes du produit, et rien ne vous
          est demandé en attendant.
        </p>
      </Card>
    </div>
  );
}
