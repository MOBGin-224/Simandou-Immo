import Link from 'next/link';

import { LeaseStatusBadge } from '@/components/ui/badge';
import { Card, linkOverlayClasses } from '@/components/ui/card';
import { formatDate, formatMoney } from '@/lib/ui/format';
import { describeApartment, describePeriod, type LeaseListItem } from '@/modules/leases';

/**
 * Carte d'un bail (Component Specification section 27).
 *
 * La section 27 l'exige : « le contrat doit être facilement identifiable comme
 * une RELATION LOCATIVE, et non comme un simple document ». La carte mène donc
 * avec les deux personnes de la relation, le locataire et son logement, et non
 * avec un numéro de contrat.
 *
 * Sur mobile, la carte remplace le tableau : une ligne à six colonnes est
 * illisible sur un téléphone, qui est l'écran de référence (MVP-UI-001).
 *
 * Le lien porte sur le NOM du locataire et sa zone est étendue à toute la carte
 * (voir `linkOverlayClasses`) : un titre de 22 pixels de haut est trop petit pour
 * un doigt. La carte ne porte qu'UN lien, condition de cette technique.
 */
export type LeaseCardProps = {
  item: LeaseListItem;
};

export function LeaseCard({ item }: LeaseCardProps) {
  return (
    <Card as="li" interactive className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <Link
            href={`/baux/${item.id}`}
            className={`${linkOverlayClasses} break-words font-display text-base font-semibold text-brand`}
          >
            {item.tenant.fullName}
          </Link>
          <span className="break-words text-sm text-muted">
            {describeApartment(item.apartment)}
          </span>
        </div>

        <LeaseStatusBadge status={item.status} />
      </div>

      <p className="text-sm text-ink">
        {formatMoney(item.rent.amount, item.rent.currency)} par mois, le {item.dueDay}
      </p>

      <p className="text-xs text-muted">{describePeriod(item, formatDate)}</p>
    </Card>
  );
}
