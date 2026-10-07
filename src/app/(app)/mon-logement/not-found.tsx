import Link from 'next/link';

import { buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * Espace locataire inexistant pour cet utilisateur.
 *
 * Un propriétaire ou un gestionnaire n'a pas d'espace locataire : ce n'est pas une
 * erreur, c'est une page qui ne lui est pas destinée. Le bouton le ramène là où il
 * travaille.
 */
export default function MyApartmentNotFound() {
  return (
    <EmptyState
      title="Pas d'espace locataire"
      description="Cette page est réservée aux locataires. Si vous gérez des immeubles, c'est de ce côté que se trouve votre travail."
      action={
        <Link href="/immeubles" className={buttonClasses('primary', 'md')}>
          Aller aux immeubles
        </Link>
      }
    />
  );
}
