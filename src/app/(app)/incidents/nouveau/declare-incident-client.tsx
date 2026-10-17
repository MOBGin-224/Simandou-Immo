'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { buttonClasses, Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input, Textarea } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/ui/cn';
import {
  createIncidentRequest,
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_PRIORITY_LABELS,
  type IncidentCategory,
  type IncidentPriority,
} from '@/modules/incidents/client';

export type ApartmentChoice = { id: string; label: string };

export type DeclareIncidentClientProps = {
  /** Logement imposé (TENANT), ou `null` quand un select est proposé. */
  fixedApartment: { id: string; label: string } | null;
  /** Logements du périmètre (MANAGER, OWNER). Vide si `fixedApartment` est fourni. */
  apartments: ApartmentChoice[];
};

type DeclaredIncidentSuccess = {
  id: string;
  title: string;
};

const CATEGORY_OPTIONS: IncidentCategory[] = [
  'PLUMBING',
  'ELECTRICITY',
  'AIR_CONDITIONING',
  'LOCKS_AND_KEYS',
  'OTHER',
];

const PRIORITY_OPTIONS: IncidentPriority[] = ['LOW', 'NORMAL', 'URGENT'];

export default function DeclareIncidentClient({
  fixedApartment,
  apartments,
}: DeclareIncidentClientProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<IncidentCategory>('OTHER');
  const [priority, setPriority] = useState<IncidentPriority>('NORMAL');
  const [apartmentId, setApartmentId] = useState(fixedApartment?.id ?? apartments[0]?.id ?? '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | null>(null);
  const [declaredIncident, setDeclaredIncident] = useState<DeclaredIncidentSuccess | null>(null);

  const selectClasses =
    'min-h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink focus:border-action focus:outline-none';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setFieldErrors(null);

    if (!apartmentId) {
      setErrorMessage('Aucun logement disponible pour cette déclaration.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await createIncidentRequest({
        title,
        description,
        priority,
        category,
        apartmentId,
      });

      const body = await response.json();

      if (!response.ok) {
        if (body?.error?.details?.fieldErrors) {
          setFieldErrors(body.error.details.fieldErrors);
        }
        setErrorMessage(
          body?.error?.message ??
            'Impossible de déclarer cet incident. Veuillez vérifier votre saisie.',
        );
      } else {
        setDeclaredIncident({ id: body.data.incident.id, title: body.data.incident.title });
      }
    } catch {
      setErrorMessage('Une erreur réseau est survenue. Veuillez vérifier votre connexion.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (declaredIncident) {
    return (
      <div className="flex max-w-xl flex-col gap-6">
        <PageHeader
          title="Incident déclaré"
          description="Votre déclaration a été transmise à votre gestionnaire ou propriétaire."
        />

        <Card className="flex flex-col gap-4 border-success/30 p-5">
          <p className="text-sm text-ink">
            « {declaredIncident.title} » a bien été enregistré. Vous pouvez suivre son avancement
            depuis la liste des incidents.
          </p>

          {/*
           * TODO(Lot 13, écran suivant) : rediriger vers /incidents/[id] une
           * fois la fiche de détail créée. En attendant, la liste est la
           * seule destination disponible.
           */}
          <Link
            href="/incidents"
            className={cn(buttonClasses('primary', 'lg', true), 'min-h-14 font-semibold')}
          >
            Retour aux incidents
          </Link>
        </Card>
      </div>
    );
  }

  const noApartmentAvailable = !fixedApartment && apartments.length === 0;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}

      {fixedApartment ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Votre logement</span>
          <p className="min-h-11 rounded-md border border-line bg-surface-subtle px-3 py-2.5 text-base text-ink">
            {fixedApartment.label}
          </p>
        </div>
      ) : (
        <Field
          id="apartmentId"
          label="Logement concerné"
          required
          errors={fieldErrors?.apartmentId}
          hint="Le logement dans lequel le problème se trouve."
        >
          {({ id, 'aria-describedby': describedBy, 'aria-invalid': isInvalid }) => (
            <select
              id={id}
              aria-describedby={describedBy}
              aria-invalid={isInvalid}
              required
              disabled={noApartmentAvailable}
              value={apartmentId}
              onChange={(event) => setApartmentId(event.target.value)}
              className={selectClasses}
            >
              {apartments.map((apartment) => (
                <option key={apartment.id} value={apartment.id}>
                  {apartment.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}

      <Field
        id="title"
        label="Titre"
        required
        errors={fieldErrors?.title}
        hint="Un résumé court du problème, par exemple « Fuite sous l'évier »."
      >
        {(attrs) => (
          <Input
            {...attrs}
            type="text"
            required
            minLength={3}
            maxLength={200}
            disabled={noApartmentAvailable}
            placeholder="Ex : Fuite sous l'évier"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        )}
      </Field>

      <Field
        id="description"
        label="Description"
        required
        errors={fieldErrors?.description}
        hint="Décrivez le problème le plus précisément possible."
      >
        {(attrs) => (
          <Textarea
            {...attrs}
            required
            maxLength={5000}
            rows={5}
            disabled={noApartmentAvailable}
            placeholder="Décrivez ce qui se passe, depuis quand, et ce que vous avez déjà essayé."
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        )}
      </Field>

      <Field
        id="category"
        label="Catégorie"
        required
        errors={fieldErrors?.category}
        hint="Choisissez la catégorie la plus proche du problème."
      >
        {({ id, 'aria-describedby': describedBy, 'aria-invalid': isInvalid }) => (
          <select
            id={id}
            aria-describedby={describedBy}
            aria-invalid={isInvalid}
            required
            disabled={noApartmentAvailable}
            value={category}
            onChange={(event) => setCategory(event.target.value as IncidentCategory)}
            className={selectClasses}
          >
            {CATEGORY_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {INCIDENT_CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field
        id="priority"
        label="Priorité"
        required
        errors={fieldErrors?.priority}
        hint="Urgente seulement si le logement devient difficile à occuper."
      >
        {({ id, 'aria-describedby': describedBy, 'aria-invalid': isInvalid }) => (
          <select
            id={id}
            aria-describedby={describedBy}
            aria-invalid={isInvalid}
            required
            disabled={noApartmentAvailable}
            value={priority}
            onChange={(event) => setPriority(event.target.value as IncidentPriority)}
            className={selectClasses}
          >
            {PRIORITY_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {INCIDENT_PRIORITY_LABELS[value]}
              </option>
            ))}
          </select>
        )}
      </Field>

      {/* Bouton de déclaration mobile first (56px min) */}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        disabled={isSubmitting || noApartmentAvailable}
        aria-busy={isSubmitting}
        className="min-h-14 text-base font-semibold"
      >
        {isSubmitting ? 'Déclaration en cours...' : "Déclarer l'incident"}
      </Button>
    </form>
  );
}
