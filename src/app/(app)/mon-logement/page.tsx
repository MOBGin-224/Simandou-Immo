import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Alert } from '@/components/ui/alert';
import { AccessStatusBadge } from '@/components/ui/badge';
import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { formatDate } from '@/lib/ui/format';
import { describeApartment, getMyTenantSpace } from '@/modules/tenants';

/**
 * Espace locataire, racine de l'architecture du locataire (Information
 * Architecture 7.3, MVP-BACKLOG-030).
 *
 * Au Lot 7, cet espace montre ce qui existe : le logement, l'organisation qui le
 * gère, le statut de l'accès, et le nom que la personne peut corriger (DEC-048).
 *
 * **Et il dit ce qui n'existe pas encore.** « À payer », « Paiements »,
 * « Quittances », « Mes charges » et « Mes incidents » sont des destinations de
 * l'architecture cible, pas du Lot 7 : le locataire n'a pas encore de bail, donc
 * aucune de ces notions n'a de contenu (DEC-046). Les afficher vides laisserait
 * croire à une panne ; les annoncer explique l'attente.
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

  const details: { label: string; value: string }[] = [
    { label: 'Logement', value: describeApartment(tenant.apartment) },
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

      {tenant.apartment === null ? (
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

      <Card className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
          Prochainement
        </h2>
        <p className="text-sm text-muted">
          Votre contrat, vos loyers, vos paiements, vos quittances, vos charges et vos incidents
          apparaîtront ici. Ils arriveront avec les prochaines étapes du produit, et rien ne vous
          est demandé en attendant.
        </p>
      </Card>
    </div>
  );
}
