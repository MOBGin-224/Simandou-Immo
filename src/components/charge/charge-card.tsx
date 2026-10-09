import Link from 'next/link';

import { Amount } from '@/components/ui/amount';
import { ChargeStatusBadge } from '@/components/ui/badge';
import { Card, linkOverlayClasses } from '@/components/ui/card';
import { formatDate, formatMoney, formatMonth, pluralize } from '@/lib/ui/format';
import {
  describeAllocationMethod,
  describeCharge,
  type ChargeListItem,
} from '@/modules/charges/client';

/**
 * Carte d'une charge commune (Component Specification section 31).
 *
 * La section demande six informations, et elles sont toutes là : le type, la
 * période, le montant, la méthode, le statut et le nombre d'appartements
 * concernés.
 *
 * Sur mobile, la carte remplace le tableau : une ligne à six colonnes est
 * illisible sur un téléphone, qui est l'écran de référence (MVP-UI-001).
 *
 * **Le montant affiché est le TOTAL de la facture, et non le reste à encaisser**,
 * à l'inverse de la carte d'un loyer. C'est la différence de nature entre les
 * deux objets : un loyer EST une créance, donc ce qui compte est son solde ; une
 * charge est une facture répartie, et ce qui l'identifie est son montant global
 * (BR-049). Le reste à encaisser figure en dessous, quand il reste quelque chose.
 *
 * **Le nombre de logements n'est pas le même nombre selon l'état.** Publiée, la
 * carte montre les créances créées, qui existent. En brouillon, elle n'annonce
 * aucun nombre : la charge n'a rien réparti, et afficher « 0 logement » laisserait
 * croire à une répartition vide plutôt qu'à une répartition à venir.
 *
 * Le lien porte sur le libellé et sa zone est étendue à toute la carte (voir
 * `linkOverlayClasses`) : un titre de 22 pixels de haut est trop petit pour un
 * doigt. La carte ne porte qu'UN lien, condition de cette technique.
 */
export type ChargeCardProps = {
  item: ChargeListItem;
};

export function ChargeCard({ item }: ChargeCardProps) {
  return (
    <Card as="li" interactive className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <Link
            href={`/charges/${item.id}`}
            className={`${linkOverlayClasses} break-words font-display text-base font-semibold text-brand`}
          >
            {describeCharge(item, formatMonth)}
          </Link>
          <span className="break-words text-sm text-muted">{item.property.name}</span>
          <span className="break-words text-xs text-muted">
            {describeAllocationMethod(item.allocationMethod)}
            {item.status === 'PUBLISHED' ? ` · ${pluralize(item.unitCount, 'logement')}` : ''}
          </span>
        </div>

        <ChargeStatusBadge status={item.status} />
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <Amount amount={item.totalAmount} currency={item.currency} scale="key" />
        {/*
          Le reste à encaisser n'est écrit que s'il DIFFÈRE du total. Vu à
          l'écran : sur une charge fraîchement publiée, « 1 000 000 GNF » suivi
          de « dont 1 000 000 GNF à encaisser » répète le même nombre à deux
          lignes d'intervalle, et fait chercher une différence qui n'existe pas.
          La ligne n'apparaît donc qu'une fois un paiement reçu, c'est-à-dire
          quand elle apprend quelque chose.
        */}
        {item.totalOutstanding > 0 && item.totalOutstanding !== item.totalAmount ? (
          <span className="text-xs text-muted">
            dont {formatMoney(item.totalOutstanding, item.currency)} à encaisser
          </span>
        ) : null}
      </div>

      <p className="text-xs text-muted">Échéance du {formatDate(item.dueDate)}</p>
    </Card>
  );
}
