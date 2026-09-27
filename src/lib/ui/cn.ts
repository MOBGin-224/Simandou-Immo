/**
 * Concatène des classes, en ignorant celles qui sont absentes.
 *
 * Volontairement minuscule, et sans `clsx` ni `tailwind-merge` : les classes de
 * ce projet sont écrites ici, jamais reçues de l'extérieur, donc il n'y a aucun
 * conflit à résoudre. Ajouter deux dépendances pour cela serait un coût sans
 * contrepartie (ENG-006).
 */
export type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter((value): value is string => Boolean(value)).join(' ');
}
