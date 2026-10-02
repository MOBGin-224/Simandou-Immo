import Link from 'next/link';

import { ManagerStatusBadge } from '@/components/ui/badge';
import { Card, linkOverlayClasses } from '@/components/ui/card';
import { formatDate } from '@/lib/ui/format';
import type { ManagerListItem } from '@/modules/managers';

/**
 * Carte d'un élément de la liste des gestionnaires (Component Specification
 * section 22, MVP-UI-005).
 *
 * Sur mobile, la carte remplace le tableau : une ligne à cinq colonnes est
 * illisible sur un téléphone, qui est l'écran de référence (MVP-UI-001).
 *
 * Les deux natures mènent à leur fiche, qui n'est pas la même : une INVITATION, où
 * l'on renvoie ou révoque le lien ; un ACCÈS, où l'on gère le périmètre, la
 * suspension et la révocation.
 *
 * Le lien porte sur le NOM et sa zone est étendue à toute la carte (voir
 * `linkOverlayClasses`) : un titre de 22 pixels de haut est trop petit pour un
 * doigt. La carte ne porte qu'UN lien, condition de cette technique.
 */
export type ManagerCardProps = {
  item: ManagerListItem;
};

export function ManagerCard({ item }: ManagerCardProps) {
  const href =
    item.kind === 'INVITATION'
      ? `/gestionnaires/invitations/${item.id}`
      : `/gestionnaires/${item.id}`;

  const propertyNames = item.properties.map((property) =>
    property.archived ? `${property.name} (archivé)` : property.name,
  );

  return (
    <Card as="li" interactive className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <Link
            href={href}
            className={`${linkOverlayClasses} break-words font-display text-base font-semibold text-brand`}
          >
            {item.fullName}
          </Link>

          {item.phone ? <span className="text-sm text-muted">{item.phone}</span> : null}
        </div>

        <ManagerStatusBadge status={item.status} />
      </div>

      <p className="text-sm text-ink">
        {propertyNames.length > 0 ? propertyNames.join(', ') : 'Aucun immeuble'}
      </p>

      <p className="text-xs text-muted">
        {item.kind === 'INVITATION' && item.expiresAt
          ? item.status === 'INVITATION_EXPIRED'
            ? `Lien expiré le ${formatDate(item.expiresAt.toISOString())}`
            : `Invité le ${item.invitedAt ? formatDate(item.invitedAt.toISOString()) : '-'}, lien valable jusqu'au ${formatDate(item.expiresAt.toISOString())}`
          : item.status === 'REVOKED'
            ? 'Accès révoqué'
            : item.status === 'SUSPENDED'
              ? 'Accès suspendu'
              : item.activatedAt
                ? `Actif depuis le ${formatDate(item.activatedAt.toISOString())}`
                : null}
      </p>
    </Card>
  );
}
