/**
 * Erreurs métier du module Charges (MVP-ENG-029).
 *
 * Mêmes absences volontaires qu'ailleurs : aucune erreur « charge inexistante »,
 * car un identifiant inconnu et un identifiant hors périmètre doivent rester
 * indiscernables (ADR-007, ADR-008). Ils lèvent `ResourceOutOfScopeError`, qui
 * appartient au service d'autorisation. Aucune erreur de permission non plus.
 *
 * Et une PRÉSENCE propre à ce lot, à l'inverse des loyers : le conflit. La
 * génération des loyers est idempotente par construction, donc rejouer un appel
 * n'y est pas un échec. La publication d'une charge, elle, n'est PAS rejouable :
 * BR-052 l'exige, et l'API section 29 demande un `CONFLICT` explicite, « y
 * compris en cas de double-clic ou de requête concurrente ». Une seconde
 * publication silencieuse laisserait croire qu'elle a produit quelque chose.
 */

/** Détail de validation, par champ, tel qu'un formulaire peut l'afficher. */
export type FieldErrors = Record<string, string[]>;

/**
 * Entrée refusée par le schéma de validation, ou par une règle qui vise un champ.
 *
 * Portée par le cas d'usage et non par l'appelant : la validation appliquée dans
 * chaque route finirait par être oubliée dans l'une d'elles.
 */
export class ChargeValidationError extends Error {
  constructor(readonly fieldErrors: FieldErrors) {
    super('Les données fournies sont invalides.');
    this.name = 'ChargeValidationError';
  }
}

/**
 * Raison pour laquelle l'état de la charge empêche l'opération demandée.
 *
 * Énumérée plutôt que libre : c'est l'écran qui choisit quoi dire, et un message
 * composé au point de levée finirait par être affiché à l'envers du contexte.
 */
export type ChargeStateReason = 'already-published' | 'already-cancelled' | 'property-archived';

const STATE_MESSAGES: Record<ChargeStateReason, string> = {
  'already-published':
    'Cette charge est déjà publiée : ses créances existent et ne peuvent pas être recréées.',
  'already-cancelled': 'Cette charge est annulée.',
  'property-archived': 'Cet immeuble est archivé : il ne supporte plus de charge nouvelle.',
};

/**
 * Opération refusée par l'ÉTAT de la charge (BR-052, BR-054).
 *
 * Traduite en 409 : la requête est bien formée, c'est la situation de la
 * ressource qui l'empêche. C'est le même choix que pour un bail déjà clôturé ou
 * un appartement déjà archivé.
 *
 * `already-published` est le cas qui compte : la section 29 impose ce refus pour
 * une seconde publication, et la contrainte `UNIQUE (charge_id, apartment_id)`
 * le garantit même si deux requêtes se croisent.
 */
export class ChargeStateError extends Error {
  constructor(readonly reason: ChargeStateReason) {
    super(STATE_MESSAGES[reason]);
    this.name = 'ChargeStateError';
  }
}

/**
 * Publication refusée faute de logement entre qui répartir.
 *
 * Un immeuble sans aucun logement actif n'a personne à qui refacturer : publier
 * créerait zéro créance et laisserait une charge « publiée » qui ne doit rien,
 * ce qui contredirait l'invariant de BR-051, la somme des parts devant valoir le
 * total.
 *
 * Le refus est explicite et porte le chemin de correction : ajouter un logement,
 * ou annuler la charge. Il est distinct d'un conflit d'état parce que ce n'est
 * pas la charge qui est en cause, c'est l'immeuble.
 */
export class ChargeNoUnitError extends Error {
  constructor(readonly propertyName: string) {
    super(
      `L'immeuble ${propertyName} n'a aucun logement actif : il n'y a personne entre qui répartir cette charge.`,
    );
    this.name = 'ChargeNoUnitError';
  }
}
