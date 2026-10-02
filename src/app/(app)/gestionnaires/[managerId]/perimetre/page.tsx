import { notFound } from 'next/navigation';

import { ManagerScopeForm } from '@/components/manager/manager-scope-form';
import type { ChecklistGroup } from '@/components/manager/property-checklist';
import { PageHeader } from '@/components/ui/page-header';
import { getDb } from '@/db/client';
import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { describeLocation, listProperties } from '@/modules/properties';

import { updateManagerScopeAction } from '../../actions';
import { loadManagerPage } from '../../data';

/**
 * Modification du périmètre d'un gestionnaire (MVP-FEAT-021, DEC-042).
 *
 * L'écran propose les immeubles ACTIFS de l'organisation, plus ceux, archivés
 * depuis, qui sont déjà dans le périmètre : on peut les y laisser, mais pas en
 * attribuer de nouveaux (DEC-020).
 *
 * Un accès révoqué n'a plus de périmètre à modifier : la page n'existe pas pour lui,
 * on le réinvite avec un périmètre neuf (DEC-043).
 */
export async function generateMetadata() {
  return { title: 'Modifier le périmètre' };
}

export default async function ManagerScopePage(
  props: PageProps<'/gestionnaires/[managerId]/perimetre'>,
) {
  const { managerId } = await props.params;
  const manager = await loadManagerPage(managerId);

  if (manager.status === 'REVOKED') notFound();

  const context = await requireAccessContextOrSignIn();
  const collection = await listProperties(getDb(), context, {
    organizationId: manager.organizationId,
    filter: 'ACTIVE',
    pageSize: 100,
  });

  const offered = new Map<
    string,
    { id: string; name: string; location: string | null; archived: boolean }
  >();

  for (const property of collection.properties) {
    offered.set(property.id, {
      id: property.id,
      name: property.name,
      location: describeLocation(property),
      archived: false,
    });
  }

  // Un immeuble archivé depuis qu'il est dans le périmètre reste proposé, pour pouvoir
  // le garder ou le retirer : le faire disparaître de la liste le retirerait en silence.
  for (const property of manager.properties) {
    if (!offered.has(property.id)) {
      offered.set(property.id, {
        id: property.id,
        name: property.name,
        location: null,
        archived: property.archived,
      });
    }
  }

  const groups: ChecklistGroup[] = [
    {
      organization: { id: manager.organizationId, name: manager.organizationName },
      properties: [...offered.values()],
    },
  ];

  const fiche = `/gestionnaires/${manager.id}`;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Modifier le périmètre"
        description={`${manager.fullName} verra uniquement les immeubles cochés.`}
        back={{ href: fiche, label: manager.fullName }}
      />

      <ManagerScopeForm
        action={updateManagerScopeAction.bind(null, manager.id)}
        groups={groups}
        initialSelection={manager.properties.map((property) => property.id)}
        cancelHref={fiche}
      />
    </div>
  );
}
