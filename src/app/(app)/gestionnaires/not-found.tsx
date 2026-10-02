import Link from 'next/link';

import { buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * Gestionnaire ou invitation introuvable.
 *
 * Le message ne distingue pas « inexistant » de « hors de votre organisation » :
 * la distinction confirmerait l'existence de données d'une autre organisation
 * (ADR-007). Il est aussi celui que reçoit un gestionnaire ou un locataire qui
 * atteint l'écran par son adresse : la gestion des gestionnaires est réservée au
 * propriétaire, et pour tout autre elle n'existe pas (DEC-025).
 */
export default function ManagersNotFound() {
  return (
    <EmptyState
      title="Page introuvable"
      description="Ce gestionnaire ou cette invitation n'existe pas, ou ne fait pas partie de votre organisation."
      action={
        <Link href="/immeubles" className={buttonClasses('primary', 'md')}>
          Revenir aux immeubles
        </Link>
      }
    />
  );
}
