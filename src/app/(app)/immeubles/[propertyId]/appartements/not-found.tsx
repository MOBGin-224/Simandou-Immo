import Link from 'next/link';

import { buttonClasses } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * Appartement introuvable.
 *
 * Placé sur le segment des appartements afin que la page « introuvable » parle
 * du logement et non de l'immeuble. Vu à l'écran au Lot 5 : un identifiant
 * d'appartement rattaché au mauvais immeuble affichait « Immeuble introuvable »,
 * alors que l'immeuble, lui, existait bel et bien.
 *
 * Le message ne distingue pas « inexistant » de « hors de votre périmètre » : la
 * distinction confirmerait l'existence de données d'une autre organisation
 * (ADR-007).
 *
 * Le retour mène à la liste des immeubles et non à celle des appartements :
 * l'immeuble de l'URL peut être précisément ce qui est hors de portée, et y
 * renvoyer conduirait à un second refus.
 */
export default function ApartmentNotFound() {
  return (
    <EmptyState
      title="Appartement introuvable"
      description="Cet appartement n'existe pas, ou il ne fait pas partie de cet immeuble."
      action={
        <Link href="/immeubles" className={buttonClasses('primary', 'md')}>
          Revenir aux immeubles
        </Link>
      }
    />
  );
}
