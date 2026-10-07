import Link from 'next/link';

import { AccessStatusBadge } from '@/components/ui/badge';
import { Card, linkOverlayClasses } from '@/components/ui/card';
import { formatDate } from '@/lib/ui/format';
import { describeApartment, type TenantListItem } from '@/modules/tenants';

/**
 * Carte d'un locataire (Component Specification section 25, MVP-UI-005).
 *
 * Sur mobile, la carte remplace le tableau : une ligne à plusieurs colonnes est
 * illisible sur un téléphone, qui est l'écran de référence (MVP-UI-001).
 *
 * **Une carte par PERSONNE, et plus par nature** (DEC-051). Au Lot 7 la liste
 * mêlait deux sortes d'éléments, un accès et une invitation en attente, qui
 * menaient à deux fiches différentes. Le locataire étant désormais une personne,
 * il a UNE fiche, et l'invitation en attente n'est plus qu'un état de sa
 * relation, lisible dans son statut.
 *
 * **Ni montant, ni statut financier.** Le loyer appartient au bail, et la fiche
 * du locataire y renvoie : la carte montre le logement, qui est ce qui identifie
 * un locataire pour un gestionnaire.
 *
 * Le lien porte sur le NOM et sa zone est étendue à toute la carte (voir
 * `linkOverlayClasses`) : un titre de 22 pixels de haut est trop petit pour un
 * doigt. La carte ne porte qu'UN lien, condition de cette technique.
 */
export type TenantCardProps = {
  item: TenantListItem;
  /**
   * Vrai lorsque l'appelant lit plusieurs organisations.
   *
   * L'adresse porte alors l'organisation : la ressource est le couple personne et
   * organisation, et `users.id` seul serait ambigu pour qui en voit plusieurs
   * (DEC-051).
   */
  withOrganization?: boolean;
};

export function TenantCard({ item, withOrganization = false }: TenantCardProps) {
  const href = withOrganization
    ? `/locataires/${item.id}?organisation=${item.organizationId}`
    : `/locataires/${item.id}`;

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

      {withOrganization ? (
        <p className="break-words text-xs text-muted">{item.organizationName}</p>
      ) : null}

      <p className="text-xs text-muted">{describeState(item)}</p>
    </Card>
  );
}

/**
 * Ce que la carte dit sous le logement, selon l'état de la relation.
 *
 * Chaque statut a sa phrase, et `NO_ACCESS` en a une qui RASSURE plutôt que
 * d'alerter : ne pas utiliser l'application est le cas courant du locataire qui
 * paie en main propre, pas une anomalie à corriger (DEC-051).
 */
function describeState(item: TenantListItem): string | null {
  if (item.status === 'INVITATION_EXPIRED' && item.expiresAt) {
    return `Lien expiré le ${formatDate(item.expiresAt.toISOString())}`;
  }

  if (item.status === 'INVITED' && item.expiresAt) {
    const invited = item.invitedAt ? formatDate(item.invitedAt.toISOString()) : '-';

    return `Invité le ${invited}, lien valable jusqu'au ${formatDate(item.expiresAt.toISOString())}`;
  }

  if (item.status === 'NO_ACCESS') {
    return item.leaseId
      ? "Locataire sans compte : il n'utilise pas l'application"
      : 'Aucun accès au produit';
  }

  if (item.status === 'REVOKED') return 'Accès révoqué';
  if (item.status === 'SUSPENDED') return 'Accès suspendu';

  if (item.activatedAt) return `Actif depuis le ${formatDate(item.activatedAt.toISOString())}`;

  return null;
}
