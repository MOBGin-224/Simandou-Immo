'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { createInterventionRequest } from '@/modules/interventions/client';

export type PropertyChoice = { id: string; name: string };
export type ApartmentChoice = { id: string; number: string; propertyId: string };
export type IncidentChoice = { id: string; title: string; propertyId: string; apartmentId: string };
export type ResponsibleChoice = { userId: string; fullName: string };

export type CreateInterventionClientProps = {
  /** Immeubles du périmètre (MANAGER, OWNER). Non vide : la page le garantit. */
  properties: PropertyChoice[];
  /** Logements actifs du périmètre, toutes les lignes de tous les immeubles. */
  apartments: ApartmentChoice[];
  /** Incidents OPEN ou IN_PROGRESS du périmètre, les 50 plus récents. */
  incidents: IncidentChoice[];
  /** « Moi-même » toujours en tête, puis les gestionnaires actifs visibles. */
  responsibles: ResponsibleChoice[];
};

const selectClasses =
  'min-h-11 w-full rounded-md border border-line bg-surface px-3 text-base text-ink focus:border-action focus:outline-none';

export default function CreateInterventionClient({
  properties,
  apartments,
  incidents,
  responsibles,
}: CreateInterventionClientProps) {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? '');
  const [apartmentId, setApartmentId] = useState('');
  const [incidentId, setIncidentId] = useState('');
  const [providerName, setProviderName] = useState('');
  const [providerPhone, setProviderPhone] = useState('');
  const [plannedFor, setPlannedFor] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [assignedToUserId, setAssignedToUserId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | null>(null);

  const apartmentsOfProperty = useMemo(
    () => apartments.filter((apartment) => apartment.propertyId === propertyId),
    [apartments, propertyId],
  );

  /**
   * Incidents du même immeuble (DEC-060, 3.4 : un incident lié doit désigner
   * le même immeuble que l'intervention). Sans immeuble choisi, tout le
   * périmètre reste proposé.
   */
  const incidentsForSelection = useMemo(
    () =>
      propertyId ? incidents.filter((incident) => incident.propertyId === propertyId) : incidents,
    [incidents, propertyId],
  );

  function handlePropertyChange(nextPropertyId: string) {
    setPropertyId(nextPropertyId);
    setApartmentId('');

    const stillValid = incidents.some(
      (incident) => incident.id === incidentId && incident.propertyId === nextPropertyId,
    );
    if (!stillValid) setIncidentId('');
  }

  /** Un incident lié impose son logement (DEC-060, 3.4) : le select se cale sur lui. */
  function handleIncidentChange(nextIncidentId: string) {
    setIncidentId(nextIncidentId);

    const incident = incidents.find((row) => row.id === nextIncidentId);
    if (incident) setApartmentId(incident.apartmentId);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setFieldErrors(null);

    if (!propertyId) {
      setErrorMessage('Aucun immeuble disponible pour cette intervention.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await createInterventionRequest({
        title,
        description,
        propertyId,
        apartmentId: apartmentId || null,
        incidentId: incidentId || null,
        providerName: providerName.trim() || null,
        providerPhone: providerPhone.trim() || null,
        plannedFor: plannedFor || null,
        estimatedCost: estimatedCost === '' ? null : parseInt(estimatedCost, 10),
        assignedToUserId: assignedToUserId || null,
      });

      const body = await response.json();

      if (!response.ok) {
        if (body?.error?.details?.fieldErrors) {
          setFieldErrors(body.error.details.fieldErrors);
        }
        setErrorMessage(
          body?.error?.message ??
            'Impossible de créer cette intervention. Veuillez vérifier votre saisie.',
        );
        setIsSubmitting(false);
      } else {
        router.push(`/interventions/${encodeURIComponent(body.data.id)}`);
      }
    } catch {
      setErrorMessage('Une erreur réseau est survenue. Veuillez vérifier votre connexion.');
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}

      <Field
        id="title"
        label="Titre"
        required
        errors={fieldErrors?.title}
        hint="Un résumé court de l'intervention, par exemple « Remplacement du chauffe-eau »."
      >
        {(attrs) => (
          <Input
            {...attrs}
            type="text"
            required
            minLength={3}
            maxLength={200}
            placeholder="Ex : Remplacement du chauffe-eau"
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
        hint="Décrivez l'intervention prévue."
      >
        {(attrs) => (
          <Textarea
            {...attrs}
            required
            maxLength={5000}
            rows={5}
            placeholder="Décrivez ce qui doit être fait."
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        )}
      </Field>

      <Field
        id="propertyId"
        label="Immeuble"
        required
        errors={fieldErrors?.propertyId}
        hint="L'immeuble concerné par l'intervention."
      >
        {({ id, 'aria-describedby': describedBy, 'aria-invalid': isInvalid }) => (
          <select
            id={id}
            aria-describedby={describedBy}
            aria-invalid={isInvalid}
            required
            value={propertyId}
            onChange={(event) => handlePropertyChange(event.target.value)}
            className={selectClasses}
          >
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field
        id="apartmentId"
        label="Appartement"
        errors={fieldErrors?.apartmentId}
        hint="Laissez « Parties communes » si l'intervention ne vise pas un logement précis."
      >
        {({ id, 'aria-describedby': describedBy, 'aria-invalid': isInvalid }) => (
          <select
            id={id}
            aria-describedby={describedBy}
            aria-invalid={isInvalid}
            disabled={!propertyId}
            value={apartmentId}
            onChange={(event) => setApartmentId(event.target.value)}
            className={selectClasses}
          >
            <option value="">Parties communes</option>
            {apartmentsOfProperty.map((apartment) => (
              <option key={apartment.id} value={apartment.id}>
                {apartment.number}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field
        id="incidentId"
        label="Incident lié"
        errors={fieldErrors?.incidentId}
        hint="Si cette intervention répond à un incident déjà déclaré."
      >
        {({ id, 'aria-describedby': describedBy, 'aria-invalid': isInvalid }) => (
          <select
            id={id}
            aria-describedby={describedBy}
            aria-invalid={isInvalid}
            value={incidentId}
            onChange={(event) => handleIncidentChange(event.target.value)}
            className={selectClasses}
          >
            <option value="">Aucun</option>
            {incidentsForSelection.map((incident) => (
              <option key={incident.id} value={incident.id}>
                {incident.title}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field
        id="providerName"
        label="Prestataire"
        errors={fieldErrors?.providerName}
        hint="Le nom de la personne ou de l'entreprise qui exécute l'intervention."
      >
        {(attrs) => (
          <Input
            {...attrs}
            type="text"
            maxLength={200}
            placeholder="Ex : Plomberie Conakry"
            value={providerName}
            onChange={(event) => setProviderName(event.target.value)}
          />
        )}
      </Field>

      <Field
        id="providerPhone"
        label="Téléphone du prestataire"
        errors={fieldErrors?.providerPhone}
      >
        {(attrs) => (
          <Input
            {...attrs}
            type="tel"
            maxLength={30}
            placeholder="Ex : +224620000000"
            value={providerPhone}
            onChange={(event) => setProviderPhone(event.target.value)}
          />
        )}
      </Field>

      <Field id="plannedFor" label="Date prévue" errors={fieldErrors?.plannedFor}>
        {(attrs) => (
          <Input
            {...attrs}
            type="date"
            value={plannedFor}
            onChange={(event) => setPlannedFor(event.target.value)}
          />
        )}
      </Field>

      <Field
        id="estimatedCost"
        label="Coût estimé"
        errors={fieldErrors?.estimatedCost}
        hint="Montant en Francs Guinéens (GNF)."
      >
        {(attrs) => (
          <Input
            {...attrs}
            type="number"
            min="0"
            step="1"
            placeholder="Ex : 150000"
            value={estimatedCost}
            onChange={(event) => setEstimatedCost(event.target.value)}
          />
        )}
      </Field>

      <Field
        id="assignedToUserId"
        label="Responsable interne"
        errors={fieldErrors?.assignedToUserId}
        hint="La personne de votre organisation qui suit cette intervention."
      >
        {({ id, 'aria-describedby': describedBy, 'aria-invalid': isInvalid }) => (
          <select
            id={id}
            aria-describedby={describedBy}
            aria-invalid={isInvalid}
            value={assignedToUserId}
            onChange={(event) => setAssignedToUserId(event.target.value)}
            className={selectClasses}
          >
            <option value="">Aucun</option>
            {responsibles.map((responsible) => (
              <option key={responsible.userId} value={responsible.userId}>
                {responsible.fullName}
              </option>
            ))}
          </select>
        )}
      </Field>

      {/* Bouton de création mobile first (56px min) */}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="min-h-14 text-base font-semibold"
      >
        {isSubmitting ? 'Création en cours...' : "Créer l'intervention"}
      </Button>
    </form>
  );
}
