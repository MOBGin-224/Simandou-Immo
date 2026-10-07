import Link from 'next/link';

import { AccessStatusBadge } from '@/components/ui/badge';
import { Card, linkOverlayClasses } from '@/components/ui/card';
import { formatDate } from '@/lib/ui/format';
import { describeApartment, type TenantListItem } from '@/modules/tenants';

/**
 * Carte d'un élément de la liste des locataires (Component Specification
 * section 25, MVP-UI-005).
 *
 * Sur mobile, la carte remplace le tableau : une ligne à plusieurs colonnes est
 * illisible sur un téléphone, qui est l'écran de référence (MVP-UI-001).
 *
 * **Ni montant, ni statut financier** (DEC-046). Ces deux informations naissent
 * du bail, au Lot 8 : la carte ne les affiche pas, et ne réserve pas un
 * emplacement vide à leur place. Elle montre le logement, qui est ce qui
 * identifie un locataire pour un gestionnaire.
 *
 * Les deux natures mènent à leur fiche, qui n'est pas la même : une INVITATION,
 * où l'on renvoie ou révoque le lien ; un ACCÈS, où l'on suspend, réactive ou
 * révoque.
 *
 * Le lien porte sur le NOM et sa zone est étendue à toute la carte (voir
 * `linkOverlayClasses`) : un titre de 22 pixels de haut est trop petit pour un
 * doigt. La carte ne porte qu'UN lien, condition de cette technique.
 */
export type TenantCardProps = {
  item: TenantListItem;
};

export function TenantCard({ item }: TenantCardProps) {
  const href =
    item.kind === 'INVITATION' ? `/locataires/invitations/${item.id}` : `/locataires/${item.id}`;

  const apartment = item.apartment
    ? item.apartment.archived
      ? `${describeApartment(item.apartment)} (logement archivé)`
      : describeApartment(item.apartment)
    : 'Logement non renseigné';

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

        <AccessStatusBadge status={item.status} />
      </div>

      <p className="break-words text-sm text-ink">{apartment}</p>

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
