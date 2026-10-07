import { redirect } from 'next/navigation';

import { requireAccessContextOrSignIn } from '@/lib/auth/guard';
import { homeForRoles } from '@/lib/ui/home';

/**
 * Racine du produit, ORIENTÉE SELON LE RÔLE (DEC-046).
 *
 * Il n'existe pas encore de tableau de bord : il arrive au lot Dashboards. La
 * racine conduit donc chacun là où son travail commence.
 *
 * Elle ne peut plus rediriger vers `/immeubles` sans regarder qui arrive : depuis
 * le Lot 7, un locataire peut se connecter, et il n'atteint aucun immeuble
 * (ADR-007). L'y envoyer lui montrerait un refus juste après sa connexion.
 *
 * Le contexte d'accès est chargé ici, ce qui renvoie vers la connexion si aucune
 * session n'est ouverte : la racine d'un visiteur anonyme conduit donc à
 * l'écran de connexion, comme avant.
 */
export default async function HomePage() {
  const context = await requireAccessContextOrSignIn();

  redirect(homeForRoles(context.memberships.map((membership) => membership.role)));
}
