import type { ReactNode } from 'react';

import { cn } from '@/lib/ui/cn';

/**
 * Bandeau d'alerte (Component Specification section 67).
 *
 * Sert au retour d'une opération refusée, en haut du formulaire concerné.
 *
 * `role="alert"` pour une erreur, afin qu'un lecteur d'écran l'annonce sans
 * attendre que l'utilisateur atteigne le bandeau ; `role="status"` sinon, qui
 * n'interrompt pas la lecture en cours.
 */
export type AlertTone = 'danger' | 'warning' | 'info' | 'success';

/*
 * Fonds EXPLICITES de la charte, et non calculés par opacité : c'est sur ces
 * fonds précis qu'elle a mesuré les contrastes, 4,8:1 pour le succès et l'alerte,
 * 5,7:1 pour le danger, 5,1:1 pour l'information.
 */
const TONES: Record<AlertTone, string> = {
  danger: 'border-danger/30 bg-danger-surface text-danger',
  warning: 'border-warning/30 bg-warning-surface text-warning',
  info: 'border-info/30 bg-info-surface text-info',
  success: 'border-success/30 bg-success-surface text-success',
};

export type AlertProps = {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  className?: string;
};

export function Alert({ tone = 'danger', title, children, className }: AlertProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('rounded-md border px-4 py-3 text-sm', TONES[tone], className)}
    >
      {title ? <p className="font-medium">{title}</p> : null}
      {children ? <div className={cn(title && 'mt-1')}>{children}</div> : null}
    </div>
  );
}
