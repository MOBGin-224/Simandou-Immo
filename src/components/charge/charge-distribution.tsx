import { Amount } from '@/components/ui/amount';
import { ReceivableStatusBadge } from '@/components/ui/badge';
import { Overline } from '@/components/ui/overline';
import { formatMoney } from '@/lib/ui/format';
import type { AllocationSummary } from '@/modules/charges/client';

/**
 * Répartition d'une charge, logement par logement (Component Specification
 * section 32).
 *
 * La section demande une LISTE sur mobile et autorise un tableau sur grand
 * écran. C'est une liste ici, à toutes les largeurs, pour une raison tenue par
 * le produit : chaque ligne porte un montant, une occupation et parfois un
 * statut de règlement, et un tableau de quatre colonnes à 360 px redevient
 * illisible, qui est l'écran de référence (MVP-UI-001). La grille passe à deux
 * colonnes au-delà, ce qui raccourcit la liste sans la transformer.
 *
 * **L'ordre est celui des références de logement, et il n'est pas décoratif** :
 * c'est l'ordre dans lequel le reste de la division entière est distribué, une
 * unité par logement (DEC-029). Un gestionnaire lit donc « A01 à A04 paient un
 * franc de plus », ce qui s'explique à un locataire. L'appelant transmet les
 * parts dans cet ordre, le moteur les ayant déjà triées.
 *
 * **Un logement VACANT est annoncé comme tel.** Sa part existe, elle reste à la
 * charge du bailleur, et personne ne la doit (BR-052). Ne pas le dire ferait
 * chercher un locataire absent.
 */
export type DistributionShare = {
  apartmentId: string;
  /** Référence affichée du logement, par exemple A01. */
  number: string;
  amountDue: number;
  /** Un bail actif rend-il une personne redevable de cette part ? */
  occupied: boolean;
  tenantName: string | null;
  /** Statut de règlement, pour une charge déjà publiée. Absent sur un aperçu. */
  status?: 'UPCOMING' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  /** Solde restant, quand il diffère de la part due. */
  balance?: number;
};

export type ChargeDistributionProps = {
  summary: AllocationSummary;
  currency: string;
  shares: DistributionShare[];
};

export function ChargeDistribution({ summary, currency, shares }: ChargeDistributionProps) {
  return (
    <div className="flex flex-col gap-4">
      {/*
        Les trois nombres que MVP-BACKLOG-053 demande d'afficher avant
        publication : le total, le nombre de logements, la part de chacun. Le
        quatrième, l'écart d'arrondi, n'est annoncé que s'il existe.
      */}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-0.5">
          <Overline as="dt">Total réparti</Overline>
          <dd>
            <Amount amount={summary.totalAmount} currency={currency} />
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <Overline as="dt">Logements</Overline>
          <dd data-numeric className="text-base text-ink">
            {summary.unitCount}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <Overline as="dt">Part de chacun</Overline>
          <dd>
            <Amount amount={summary.baseShare} currency={currency} />
          </dd>
        </div>
      </dl>

      {summary.adjustedUnitCount > 0 ? (
        <p className="text-xs text-muted">
          Le montant ne se divise pas exactement :{' '}
          {summary.adjustedUnitCount === 1
            ? '1 logement paie une unité de plus'
            : `${summary.adjustedUnitCount} logements paient une unité de plus`}
          , les premiers dans l&apos;ordre des références. La somme des parts reste égale au total.
        </p>
      ) : null}

      <ul className="grid gap-2 sm:grid-cols-2">
        {shares.map((share) => (
          <li
            key={share.apartmentId}
            className="flex items-start justify-between gap-3 rounded-md border border-line px-3 py-2"
          >
            <div className="flex min-w-0 flex-col">
              <span data-numeric className="text-base font-medium text-ink">
                {share.number}
              </span>
              <span className="break-words text-xs text-muted">
                {share.occupied ? (share.tenantName ?? 'Locataire') : 'Logement vacant'}
              </span>
              {share.balance !== undefined && share.balance !== share.amountDue ? (
                <span className="text-xs text-muted">
                  reste {formatMoney(share.balance, currency)}
                </span>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              <Amount amount={share.amountDue} currency={currency} />
              {share.status ? <ReceivableStatusBadge status={share.status} /> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
