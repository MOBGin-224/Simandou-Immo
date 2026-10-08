import Link from 'next/link';

import { Amount } from '@/components/ui/amount';
import { ReceivableStatusBadge } from '@/components/ui/badge';
import { Card, linkOverlayClasses } from '@/components/ui/card';
import { formatDate, formatMoney, formatMonth } from '@/lib/ui/format';
import { describeApartment, describePeriod, type RentListItem } from '@/modules/rents';

/**
 * Carte d'une échéance de loyer (Component Specification sections 26 et 29).
 *
 * Sur mobile, la carte remplace le tableau : une ligne à six colonnes est
 * illisible sur un téléphone, qui est l'écran de référence (MVP-UI-001).
 *
 * **Ce que la carte mène avec, et pourquoi.** La PÉRIODE, parce que c'est elle
 * qui identifie la créance sans ambiguïté (BR-035) et que c'est sous ce nom
 * qu'on en parle, « le loyer d'octobre ». Puis la personne et son logement, parce
 * que la question suivante est toujours « qui », et le montant, parce que c'est
 * la raison d'être de l'écran.
 *
 * **Le montant affiché est le SOLDE quand il diffère du montant dû**, et c'est le
 * point de lecture le plus important de la carte : sur une créance
 * partiellement payée, montrer le loyer entier laisserait réclamer une somme
 * déjà en partie versée. Le montant dû reste visible juste en dessous, pour que
 * le calcul se relise.
 *
 * Le lien porte sur la période et sa zone est étendue à toute la carte (voir
 * `linkOverlayClasses`) : un titre de 22 pixels de haut est trop petit pour un
 * doigt. La carte ne porte qu'UN lien, condition de cette technique, et c'est
 * pourquoi le téléphone du locataire n'y est pas cliquable : il l'est sur la
 * fiche.
 */
export type RentCardProps = {
  item: RentListItem;
};

export function RentCard({ item }: RentCardProps) {
  const partiallyPaid = item.amountPaid > 0 && item.balance > 0;

  return (
    <Card as="li" interactive className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <Link
            href={`/loyers/${item.id}`}
            className={`${linkOverlayClasses} break-words font-display text-base font-semibold text-brand`}
          >
            {describePeriod(item.periodStart, formatMonth)}
          </Link>
          <span className="break-words text-sm text-muted">{item.tenant.fullName}</span>
          <span className="break-words text-xs text-muted">
            {describeApartment(item.apartment)}
          </span>
        </div>

        <ReceivableStatusBadge status={item.displayStatus} />
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <Amount amount={item.balance} currency={item.currency} scale="key" />
        {partiallyPaid ? (
          <span className="text-xs text-muted">
            restant sur {formatMoney(item.amountDue, item.currency)}
          </span>
        ) : null}
      </div>

      <p className="text-xs text-muted">Échéance du {formatDate(item.dueDate)}</p>
    </Card>
  );
}
