import Link from 'next/link';

import { buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * Locataire ou invitation introuvable.
 *
 * Le message ne distingue pas « inexistant » de « hors de votre périmètre » : la
 * distinction confirmerait l'existence de données d'une autre organisation, ou
 * d'un immeuble que l'on ne gère pas (ADR-007). C'est aussi la page que reçoit un
 * locataire qui atteindrait l'écran par son adresse (DEC-047).
 */
export default function TenantsNotFound() {
  return (
    <EmptyState
      title="Page introuvable"
      description="Ce locataire ou cette invitation n'existe pas, ou ne fait pas partie de votre périmètre."
      action={
        <Link href="/locataires" className={buttonClasses('primary', 'md')}>
          Revenir aux locataires
        </Link>
      }
    />
  );
}
