import Link from 'next/link';

import { buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * Charge introuvable.
 *
 * Le message ne distingue pas « inexistante » de « hors de votre périmètre » : la
 * distinction confirmerait l'existence d'une charge d'une autre organisation, ou
 * d'un immeuble que l'on ne gère pas (ADR-007).
 *
 * Cette page sert aussi au LOCATAIRE qui ouvrirait `/charges` : la liste ne
 * s'adresse qu'à qui gère des immeubles, une charge appartenant à l'immeuble et
 * non à une personne. Sa part à lui est dans son espace, d'où un retour proposé
 * vers l'accueil et non vers la liste, qui lui répondrait la même chose.
 *
 * Elle sert enfin aux écrans de publication et d'annulation d'une charge qui
 * n'est plus dans l'état attendu : une charge déjà publiée n'a plus de
 * publication à confirmer.
 */
export default function ChargesNotFound() {
  return (
    <EmptyState
      title="Page introuvable"
      description="Cette charge n'existe pas, ne fait pas partie de votre périmètre, ou n'attend plus cette opération."
      action={
        <Link href="/" className={buttonClasses('primary', 'md')}>
          Revenir à l&apos;accueil
        </Link>
      }
    />
  );
}
