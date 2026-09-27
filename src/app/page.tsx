import { redirect } from 'next/navigation';

/**
 * Racine du produit.
 *
 * Il n'existe pas encore de tableau de bord : il arrive au lot Dashboards. La
 * racine conduit donc aux immeubles, qui sont le centre du système (Information
 * Architecture 2.1), et l'enveloppe authentifiée renverra vers la connexion si
 * aucune session n'est ouverte.
 */
export default function HomePage() {
  redirect('/immeubles');
}
