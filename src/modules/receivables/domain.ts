import {
  OPEN_RECEIVABLE_STATUSES,
  type ReceivableDisplayStatus,
  type ReceivableKind,
  type ReceivableStatus,
} from './constants';

/**
 * Domaine commun aux deux créances (DEC-005, DEC-015, BR-037 à BR-039).
 *
 * Entièrement PUR : ni base, ni HTTP, ni React. Ce fichier porte les trois
 * règles que le loyer et la charge appliquent à l'identique, et rien d'autre :
 * ce qu'est une créance ouverte, comment « À venir » se dérive, et dans quel
 * ordre les créances d'une personne se lisent.
 */

/**
 * Réglages d'un appel, tous facultatifs.
 *
 * Existent pour la TESTABILITÉ : tout ce qui touche aux créances est une affaire
 * de dates. Fixer l'instant courant permet d'éprouver un retard, un mois court
 * ou une année bissextile sans attendre le jour dit.
 */
export type ClockOptions = {
  now?: Date;
};

/**
 * Date civile `YYYY-MM-DD` du jour, en temps universel.
 *
 * La Guinée est à GMT+0 et n'observe pas d'heure d'été (MVP-ENG-012) : le temps
 * universel EST l'heure locale du produit, et aucune conversion de fuseau n'a
 * donc à intervenir entre l'instant et la date civile.
 *
 * Une seule définition pour les deux créances : deux lectures séparées de la
 * date du jour se contrediraient au passage de minuit, et c'est cette date qui
 * décide de « À venir » comme du retard.
 */
export function today(options: ClockOptions = {}): string {
  return (options.now ?? new Date()).toISOString().slice(0, 10);
}

/** Une créance est OUVERTE tant qu'elle peut encore être payée (BR-039). */
export function isOpen(status: ReceivableStatus): boolean {
  return (OPEN_RECEIVABLE_STATUSES as readonly ReceivableStatus[]).includes(status);
}

/**
 * Statut d'affichage d'une créance (BR-037).
 *
 * UNE seule règle, et c'est tout ce que la dérivation fait : une créance
 * `UNPAID` dont la date d'échéance est postérieure à aujourd'hui s'affiche « À
 * venir ». Tous les autres statuts s'affichent tels quels.
 *
 * `PARTIALLY_PAID` n'est volontairement PAS dérivé en « À venir », même avant
 * l'échéance : de l'argent a déjà été versé, donc l'annoncer comme à venir
 * effacerait un paiement reçu. La règle du document ne vise que `UNPAID`.
 *
 * La comparaison est faite sur des chaînes `YYYY-MM-DD`, dont l'ordre lexical
 * est l'ordre chronologique : aucun objet `Date` n'est construit, donc aucun
 * décalage de fuseau ne peut déplacer la frontière d'un jour.
 */
export function displayStatusOf(
  receivable: { status: ReceivableStatus; dueDate: string },
  today: string,
): ReceivableDisplayStatus {
  if (receivable.status === 'UNPAID' && receivable.dueDate > today) return 'UPCOMING';

  return receivable.status;
}

/**
 * Une créance dans le total dû d'un locataire (API section 18).
 *
 * La forme est celle que la section 18 documente, au mot. `kind` distingue le
 * loyer de la charge : la route agrège les DEUX types (DEC-005), et le
 * locataire voit un montant global tout en gardant le détail de ses
 * composantes (BR-055, BR-056).
 *
 * `label` est un libellé DÉJÀ composé, « Loyer septembre 2026 » ou « Eau
 * septembre 2026 ». C'est l'exception assumée à la règle qui laisse le
 * formatage au frontend : ce champ est destiné à être repris tel quel dans une
 * quittance comme dans un rappel, où il doit être identique à celui de l'écran.
 */
export type OutstandingReceivable = {
  kind: ReceivableKind;
  id: string;
  label: string;
  periodStart: string;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  balance: number;
  status: ReceivableStatus;
};

/**
 * Total dû d'un locataire, calculé CÔTÉ SERVEUR (API section 18, BR-039).
 *
 * La section le dit explicitement : « le frontend ne le recompose jamais ». Un
 * total recomposé par l'écran se mettrait à diverger dès qu'une créance est
 * paginée, filtrée ou masquée, et c'est le montant qu'une personne lit avant de
 * payer.
 */
export type OutstandingSummary = {
  currency: string;
  totalOutstanding: number;
  receivables: OutstandingReceivable[];
};

/**
 * Ordre d'allocation déterministe de DEC-022, appliqué à la lecture.
 *
 * ```text
 * 1. date d'échéance croissante
 * 2. à date égale : loyer avant charge
 * 3. à date et type égaux : création croissante
 * ```
 *
 * C'est l'ordre dans lequel un paiement global soldera les créances au Lot 11,
 * et c'est donc l'ordre dans lequel elles doivent être MONTRÉES : afficher une
 * liste qui ne correspond pas à l'ordre d'imputation ferait croire au locataire
 * que son versement a réglé autre chose que ce qu'il a réglé.
 *
 * La date de création n'est pas dans la vue transmise, mais elle décide ici : le
 * troisième critère n'existe que pour rendre l'ordre total, deux créances de même
 * date et de même type étant indiscernables pour le lecteur.
 */
export function compareOutstanding(
  a: { dueDate: string; kind: ReceivableKind; createdAt: string },
  b: { dueDate: string; kind: ReceivableKind; createdAt: string },
): number {
  // Dates civiles en `YYYY-MM-DD` : l'ordre lexical est l'ordre chronologique.
  if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);

  if (a.kind !== b.kind) return a.kind === 'RENT' ? -1 : 1;

  return a.createdAt.localeCompare(b.createdAt);
}
