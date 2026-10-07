import { notFound } from 'next/navigation';

import { TenantNameForm } from '@/components/tenant/tenant-name-form';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { getMyTenantSpace } from '@/modules/tenants';

import { renameTenantAction } from '../../locataires/actions';

/**
 * Modification de son propre nom par le locataire (DEC-048).
 *
 * UN seul champ, et c'est le fond de la décision : le locataire modifie son nom,
 * et rien d'autre. Le téléphone et l'email ne sont modifiables par personne au
 * MVP, parce que SEC-049 et SEC-050 exigent une vérification du changement et que
 * DEC-008 ne fournit aucun canal pour la mener. L'écran le dit, plutôt que de
 * laisser chercher un bouton qui n'existe pas.
 *
 * La page n'existe pas pour qui n'est pas locataire : un propriétaire n'a pas de
 * nom de locataire à corriger, et le nom d'autrui ne lui appartient pas.
 */
export const metadata = { title: 'Modifier mon nom' };

export default async function MyNamePage() {
  const context = await requireAccessContextOrSignIn();
  const tenant = await getMyTenantSpace(getDb(), context);

  if (!tenant) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Modifier mon nom"
        description="C'est le nom sous lequel la personne qui gère l'immeuble vous voit."
        back={{ href: '/mon-logement', label: 'Mon logement' }}
      />

      <TenantNameForm
        action={renameTenantAction.bind(null, tenant.id)}
        currentName={tenant.fullName}
        cancelHref="/mon-logement"
      />

      <Card className="flex flex-col gap-2">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted">
          Ce qui n&apos;est pas modifiable
        </h2>
        <dl className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">
              Numéro de téléphone
            </dt>
            <dd className="text-base text-ink">{tenant.phone ?? 'Non renseigné'}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted">
              Adresse email
            </dt>
            <dd className="break-words text-base text-ink">{tenant.email ?? 'Non renseignée'}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted">
          Votre numéro vous sert à vous connecter. Le changer demanderait de vérifier le nouveau
          numéro, ce que le produit ne sait pas encore faire.
        </p>
      </Card>
    </div>
  );
}
