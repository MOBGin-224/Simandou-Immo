'use client';

import { Button } from '@/components/ui/button';
import { Overline } from '@/components/ui/overline';

/**
 * Liste d'immeubles à cocher : le périmètre d'un gestionnaire (DEC-042).
 *
 * Partagée par l'invitation et par la modification du périmètre, qui posent la même
 * question : quels immeubles confier ?
 *
 * Le périmètre est une liste EXPLICITE. « Tout sélectionner » coche tous les
 * immeubles qui existent MAINTENANT ; ceux créés plus tard ne s'ajoutent jamais
 * d'eux-mêmes, et le texte d'aide le dit en toutes lettres.
 *
 * Les cases sont natives : la liste fonctionne sans JavaScript. Seule l'action
 * « Tout sélectionner » en dépend, comme une amélioration.
 */
export type ChecklistProperty = {
  id: string;
  name: string;
  location: string | null;
  /** Un immeuble archivé n'apparaît que s'il est déjà dans le périmètre. */
  archived?: boolean;
};

export type ChecklistGroup = {
  organization: { id: string; name: string };
  properties: ChecklistProperty[];
};

export type PropertyChecklistProps = {
  groups: ChecklistGroup[];
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  errors?: string[];
};

export function PropertyChecklist({ groups, selected, onChange, errors }: PropertyChecklistProps) {
  const allIds = groups.flatMap((group) => group.properties.map((property) => property.id));
  const everythingSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggle(id: string) {
    const next = new Set(selected);

    if (next.has(id)) next.delete(id);
    else next.add(id);

    onChange(next);
  }

  return (
    <fieldset
      className="flex flex-col gap-3"
      aria-describedby={errors ? 'propertyIds-error' : 'propertyIds-hint'}
    >
      <legend className="text-sm font-medium text-ink">
        Immeubles confiés
        <span className="text-danger" aria-hidden="true">
          {' *'}
        </span>
      </legend>

      <p id="propertyIds-hint" className="text-xs text-muted">
        La personne ne verra que les immeubles cochés. Un immeuble créé plus tard ne lui sera jamais
        ajouté automatiquement.
      </p>

      {errors ? (
        <p id="propertyIds-error" className="text-sm text-danger">
          {errors.join(' ')}
        </p>
      ) : null}

      {allIds.length > 1 ? (
        <Button
          type="button"
          variant="tertiary"
          // Le remplissage du bouton (16 px) décalerait son texte par rapport au reste
          // du formulaire : on le compense, la cible tactile restant entière.
          className="-ml-4 self-start"
          onClick={() => onChange(everythingSelected ? new Set() : new Set(allIds))}
        >
          {everythingSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
        </Button>
      ) : null}

      {groups.map((group) => (
        <div key={group.organization.id} className="flex flex-col gap-2">
          {groups.length > 1 ? <Overline as="p">{group.organization.name}</Overline> : null}

          <ul className="flex flex-col gap-2">
            {group.properties.map((property) => (
              <li key={property.id}>
                {/*
                  Le libellé entier est la cible tactile : toucher le nom d'un immeuble
                  coche sa case. Les cases natives font 20 pixels, trop peu pour un
                  doigt, d'où une ligne de 48 pixels de haut.
                */}
                <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 has-[:checked]:border-action">
                  <input
                    type="checkbox"
                    name="propertyIds"
                    value={property.id}
                    checked={selected.has(property.id)}
                    onChange={() => toggle(property.id)}
                    className="size-5 shrink-0 accent-action"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-ink">
                      {property.name}
                      {property.archived ? ' (archivé)' : ''}
                    </span>
                    {property.location ? (
                      <span className="text-xs text-muted">{property.location}</span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </fieldset>
  );
}
