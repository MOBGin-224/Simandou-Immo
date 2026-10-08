import type { ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/ui/cn';

/**
 * Bouton (charte chapitre 06, Component Specification section 8, MVP-UI-018).
 *
 * **Une seule action principale par écran.** Le texte décrit l'action, verbe
 * d'abord : jamais « OK » ni « Valider » sans contexte.
 *
 * La cible tactile fait au moins 44 px de haut. Ce n'est pas un choix esthétique
 * mais la condition pour qu'un bouton soit utilisable au pouce sur un téléphone,
 * et la charte en fait une règle d'accessibilité.
 *
 * **Pourquoi le primaire n'est pas en Digital Teal.** La charte mesure le blanc
 * sur teal `#138A8A` à 4,2:1, et le dit explicitement réservé aux GRANDS
 * libellés. Un libellé de bouton n'en est pas un, au sens WCAG : il faudrait
 * 24 px, ou 19 px en gras. Le fond est donc le Teal profond `#0F7373`, que la
 * charte fournit pour cet usage précis, et qui porte le blanc à 5,6:1. La
 * couleur de marque reste celle de l'interaction ; seule sa valeur change pour
 * rester lisible.
 *
 * `buttonClasses` est exporté afin qu'un lien de navigation puisse avoir
 * l'apparence d'un bouton sans cesser d'être un lien. Un `<a>` déguisé en
 * `<button>` casse l'ouverture dans un nouvel onglet et la navigation clavier :
 * l'élément suit la SÉMANTIQUE, l'apparence suit l'intention visuelle.
 */
export type ButtonVariant =
  'primary' | 'secondary' | 'accent' | 'tertiary' | 'destructive' | 'link';

/** Les trois tailles de la charte : Large 52, Standard 44, Compact 36. */
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium ' +
  'transition-colors duration-fast ease-standard ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

const VARIANTS: Record<ButtonVariant, string> = {
  /*
   * Le survol ASSOMBRIT vers le navy. Il ne passe pas au teal secondaire
   * `#2B9A8F`, que la charte réserve aux états et aux visualisations exigeant
   * deux teals : s'en servir ici détournerait une couleur réservée, et
   * éclaircirait le bouton là où un survol doit l'affirmer.
   */
  primary: 'bg-action-strong text-white hover:bg-brand active:bg-brand',
  secondary: 'border border-line bg-surface text-ink hover:bg-canvas active:bg-surface-subtle',
  /**
   * Action de marque dans un contexte interactif, « Inviter » par exemple.
   * Le Structural Blue porte le blanc à 5,7:1 ; le Bright Blue ne le porterait
   * qu'à 3,3:1, donc jamais sous un libellé de cette taille.
   */
  accent: 'bg-accent-deep text-white hover:bg-brand active:bg-brand',
  tertiary: 'text-action-strong hover:bg-canvas active:bg-surface-subtle',
  destructive: 'bg-danger text-white hover:bg-danger/90 active:bg-danger',
  link: 'text-action-strong underline underline-offset-4 hover:text-brand',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-sm',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-13 px-5 text-base',
};

export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  fullWidth = false,
): string {
  return cn(
    BASE,
    VARIANTS[variant],
    variant === 'link' ? 'min-h-11 px-0' : SIZES[size],
    fullWidth && 'w-full',
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonClasses(variant, size, fullWidth), className)}
      {...props}
    />
  );
}
