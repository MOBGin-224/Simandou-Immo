import Link from 'next/link';

import { buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * Immeuble introuvable.
 *
 * Le message ne distingue pas « inexistant » de « hors de votre périmètre » : la
 * distinction confirmerait l'existence de données d'une autre organisation
 * (ADR-007). C'est aussi la formulation la moins déroutante pour un gestionnaire
 * dont le périmètre a changé.
 */
export default function PropertyNotFound() {
  return (
    <EmptyState
      title="Immeuble introuvable"
      description="Cet immeuble n'existe pas, ou il ne fait pas partie de votre périmètre."
      action={
        <Link href="/immeubles" className={buttonClasses('primary', 'md')}>
          Revenir aux immeubles
        </Link>
      }
    />
  );
}
