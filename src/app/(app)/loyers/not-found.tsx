import Link from 'next/link';

import { buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * Loyer introuvable.
 *
 * Le message ne distingue pas « inexistant » de « hors de votre périmètre » : la
 * distinction confirmerait l'existence d'une créance d'une autre organisation,
 * ou d'un immeuble que l'on ne gère pas (ADR-007).
 *
 * Cette page sert aussi au LOCATAIRE qui ouvrirait `/loyers` : la liste ne
 * s'adresse qu'à qui gère des immeubles, son rattachement étant lui-même
 * (BR-021). D'où un retour proposé vers l'accueil et non vers la liste, qui lui
 * répondrait la même chose.
 */
export default function RentsNotFound() {
  return (
    <EmptyState
      title="Page introuvable"
      description="Ce loyer n'existe pas, ou ne fait pas partie de votre périmètre."
      action={
        <Link href="/" className={buttonClasses('primary', 'md')}>
          Revenir à l&apos;accueil
        </Link>
      }
    />
  );
}
