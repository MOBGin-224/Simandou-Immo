import Link from 'next/link';

import { Card, linkOverlayClasses } from '@/components/ui/card';
import { PropertyStatusBadge } from '@/components/ui/badge';
import { pluralize } from '@/lib/ui/format';
import type { PropertyView } from '@/modules/properties';

/**
 * Carte d'immeuble (Component Specification section 23).
 *
 * Contenu imposé : nom, localisation, logements, occupation, alertes. L'indicateur
 * financier attendra le lot Loyers : il n'existe aucun montant à ce lot, et un
 * emplacement vide vaut mieux qu'un zéro qui serait lu comme une information.
 *
 * Le lien porte le NOM, et sa zone tactile est étendue à toute la carte par
 * `linkOverlayClasses` : un `<div>` cliquable ne serait ni atteignable au
 * clavier, ni ouvrable dans un nouvel onglet, alors que la taille du titre ne
 * suffit pas au doigt. Corrigé en même temps que la carte d'appartement, qui
 * portait le même défaut, afin que deux listes soeurs ne se comportent pas
 * différemment.
 */
export function PropertyCard({ property }: { property: PropertyView }) {
  const { occupancy } = property;

  return (
    <Card as="li" interactive className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-brand">
          <Link href={`/immeubles/${property.id}`} className={linkOverlayClasses}>
            {property.name}
          </Link>
        </h2>
        {property.archived ? <PropertyStatusBadge archived /> : null}
      </div>

      <p className="text-sm text-muted">{property.location ?? 'Localisation non renseignée'}</p>

      <p className="text-sm text-ink">
        {occupancy.apartmentCount === 0 ? (
          'Aucun logement enregistré'
        ) : (
          <>
            {pluralize(occupancy.apartmentCount, 'logement')}
            {/*
              « dont » se rattache au TOTAL, et c'est essentiel : les travaux
              chevauchent l'occupation (DEC-050). Écrit à la suite des occupés, le
              chiffre se lirait comme une troisième catégorie, et « 8 occupés,
              24 vacants, 2 en travaux » annoncerait 34 logements sur 32.
            */}
            {occupancy.maintenanceCount > 0 ? (
              <span className="text-muted">{`, dont ${occupancy.maintenanceCount} en travaux`}</span>
            ) : null}
            <span className="text-muted">
              {' · '}
              {occupancy.occupiedCount} occupé{occupancy.occupiedCount > 1 ? 's' : ''}
            </span>
          </>
        )}
      </p>
    </Card>
  );
}
