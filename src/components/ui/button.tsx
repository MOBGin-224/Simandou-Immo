import type { ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/ui/cn';

/**
 * Bouton (Component Specification section 8, MVP-UI-018).
 *
 * Cinq variantes, comme la spécification les nomme. La cible tactile fait au
 * moins 44 px de haut (Design System 2.4) : ce n'est pas un choix esthétique mais
 * la condition pour qu'un bouton soit utilisable au pouce sur un téléphone.
 *
 * `buttonClasses` est exporté afin qu'un lien de navigation puisse avoir
 * l'apparence d'un bouton sans cesser d'être un lien. Un `<a>` déguisé en
 * `<button>` casse l'ouverture dans un nouvel onglet et la navigation clavier :
 * l'élément suit la SÉMANTIQUE, l'apparence suit l'intention visuelle.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'link';
export type ButtonSize = 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-action text-white hover:bg-action-soft active:bg-brand',
  secondary: 'border border-line bg-surface text-ink hover:bg-canvas active:bg-line',
  tertiary: 'text-action hover:bg-canvas active:bg-line',
  destructive: 'bg-danger text-white hover:bg-danger/90 active:bg-danger',
  link: 'text-action underline underline-offset-4 hover:text-brand',
};

const SIZES: Record<ButtonSize, string> = {
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
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
