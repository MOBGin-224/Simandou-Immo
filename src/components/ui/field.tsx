import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

import { cn } from '@/lib/ui/cn';

/**
 * Champ de formulaire (Component Specification section 10, MVP-UI-019).
 *
 * Le libellé, l'aide et l'erreur sont assemblés ici, et non laissés à chaque
 * écran, pour une raison précise : le lien entre un message d'erreur et son champ
 * doit être porté par `aria-describedby` et `aria-invalid`, sinon un lecteur
 * d'écran annonce « champ invalide » sans dire pourquoi. Écrit une fois, ce lien
 * ne peut plus être oublié.
 *
 * L'erreur est aussi TEXTUELLE et pas seulement rouge : la couleur ne doit jamais
 * être le seul porteur d'une information (DEC-012, Accessibility).
 */
export type FieldProps = {
  id: string;
  label: string;
  /** Messages de validation renvoyés par le serveur pour ce champ. */
  errors?: string[];
  hint?: string;
  required?: boolean;
  children: (attributes: {
    id: string;
    'aria-describedby': string | undefined;
    'aria-invalid': boolean | undefined;
  }) => ReactNode;
};

export function Field({ id, label, errors, hint, required, children }: FieldProps) {
  const hasError = Boolean(errors && errors.length > 0);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = hasError ? `${id}-error` : undefined;

  // L'erreur est annoncée AVANT l'aide, comme elle est affichée avant elle :
  // entendre deux lignes d'explication avant de savoir ce qui ne va pas fait
  // perdre le message à qui navigue à l'oreille.
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required ? (
          <span className="text-danger" aria-hidden="true">
            {' *'}
          </span>
        ) : (
          // L'espace fait partie du TEXTE et non de la marge : le nom accessible
          // du champ concatène le contenu, et une marge CSS n'y produit aucune
          // séparation. Sans elle, le champ s'annonce « Quartier(facultatif) ».
          <span className="text-xs font-normal text-muted">{' (facultatif)'}</span>
        )}
      </label>

      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': hasError ? true : undefined,
      })}

      {/*
        L'erreur est placée juste sous le champ, avant l'aide : c'est ce que
        l'utilisateur doit lire en premier après un refus, et l'intercaler après
        deux lignes d'aide l'éloigne du champ fautif.
      */}
      {hasError ? (
        <p id={errorId} className="text-sm text-danger">
          {errors?.join(' ')}
        </p>
      ) : null}

      {hint ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const CONTROL =
  'w-full rounded-md border bg-surface px-3 text-base text-ink placeholder:text-muted ' +
  'focus:border-action focus:outline-none aria-[invalid=true]:border-danger';

/** Saisie sur une ligne. `min-h-11` garantit la cible tactile de 44 px. */
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, 'min-h-11 border-line', className)} {...props} />;
}

/** Saisie multiligne, pour une description ou une adresse complète. */
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL, 'min-h-24 border-line py-2', className)} {...props} />;
}
