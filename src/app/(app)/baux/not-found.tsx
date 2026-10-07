import Link from 'next/link';

import { buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * Bail introuvable.
 *
 * Le message ne distingue pas « inexistant » de « hors de votre périmètre » : la
 * distinction confirmerait l'existence de données d'une autre organisation, ou
 * d'un immeuble que l'on ne gère pas (ADR-007).
 */
export default function LeasesNotFound() {
  return (
    <EmptyState
      title="Page introuvable"
      description="Ce bail n'existe pas, ou ne fait pas partie de votre périmètre."
      action={
        <Link href="/baux" className={buttonClasses('primary', 'md')}>
          Revenir aux baux
        </Link>
      }
    />
  );
}
