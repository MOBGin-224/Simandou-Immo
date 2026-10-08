import { cn } from '@/lib/ui/cn';
import { formatMoney } from '@/lib/ui/format';

/**
 * Montant affiché (charte chapitres 04 et 05).
 *
 * La charte répartit les deux familles sur un critère précis, et pas sur la
 * nature financière de la donnée :
 *
 * ```text
 * Manrope   identite, titres, GRANDS NOMBRES
 * Inter     corps, formulaires, boutons, tableaux, DONNEES
 * ```
 *
 * Un montant n'a donc pas une seule forme. Le chiffre clé d'un tableau de bord
 * est un grand nombre, donc Manrope ; un loyer dans une colonne est une donnée,
 * donc Inter. C'est ce que `scale` choisit, et c'est la seule décision que
 * l'appelant ait à prendre.
 *
 * **Chiffres tabulaires dans tous les cas.** `data-numeric` les active, via la
 * règle de base : dans une colonne de loyers, des chiffres de largeurs
 * différentes désalignent les unités et rendent deux montants incomparables d'un
 * coup d'oeil, ce qui est exactement ce qu'on demande à cet écran.
 *
 * Le formatage reste dans `formatMoney` : les deux espaces insécables, celle des
 * milliers et celle qui précède la devise, y sont déjà figées par un test.
 */
export type AmountScale = 'data' | 'key' | 'hero';

const SCALES: Record<AmountScale, string> = {
  /** Dans une liste, une colonne, une ligne de détail. */
  data: 'font-sans text-base',
  /** Le montant que l'écran met en avant, sur une fiche ou une carte. */
  key: 'font-display text-h4 font-semibold',
  /** Le chiffre clé d'un tableau de bord, lisible d'un coup d'oeil. */
  hero: 'font-display text-h2 font-bold',
};

export type AmountProps = {
  /** Entier dans la plus petite unité de la devise (DEC-014). */
  amount: number;
  currency: string;
  scale?: AmountScale;
  className?: string;
};

export function Amount({ amount, currency, scale = 'data', className }: AmountProps) {
  return (
    <span data-numeric className={cn(SCALES[scale], 'text-ink', className)}>
      {formatMoney(amount, currency)}
    </span>
  );
}
