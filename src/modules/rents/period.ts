/**
 * Calendrier des échéances de loyer (DEC-053, BR-034 à BR-036).
 *
 * Fichier À PART et entièrement PUR : ni base, ni HTTP, ni React, ni horloge
 * implicite. C'est ici que vivent les trois règles que les documents ne
 * tranchaient pas, et elles se vérifient donc par des tests sans monter de
 * serveur, sur des dates choisies plutôt que sur celle du jour.
 *
 * **Les trois règles, tranchées par le fondateur le 08/10/2026 (DEC-053).**
 *
 * 1. **Horizon : la période EN COURS seulement.** Le job ne remonte jamais dans
 *    le temps. Au premier lancement sur un bail actif depuis deux ans, il crée
 *    une échéance, pas vingt-quatre : les loyers déjà encaissés hors de
 *    l'application n'ont pas à réapparaître en impayés. Réclamer une période
 *    passée reste possible, mais c'est une décision humaine, prise période par
 *    période par la génération manuelle.
 * 2. **Aucun prorata.** Le montant attendu est le loyer du contrat, en entier,
 *    y compris pour le premier et le dernier mois. BR-036 dit que le montant est
 *    « déterminé selon le contrat », et le contrat ne porte qu'un montant : un
 *    montant réduit n'aurait aucune colonne pour se justifier. Un mois partiel
 *    se règle par un paiement partiel, que le produit sait déjà représenter.
 * 3. **Mois courts : la date d'échéance est rabattue sur le dernier jour du
 *    mois.** Un loyer dû le 31 est dû le 28 février, le 29 en année bissextile,
 *    le 30 en avril. « Dû le 31 » se lit comme « dû en fin de mois », et
 *    l'échéance reste ainsi DANS la période qu'elle couvre : la reporter au 1er
 *    mars donnerait un « Loyer février 2026 » dû en mars.
 *
 * Toutes les dates sont des chaînes `YYYY-MM-DD`, jamais des objets `Date`.
 * L'ordre lexical de ce format est l'ordre chronologique, donc les comparaisons
 * s'écrivent directement, et aucun décalage de fuseau ne peut déplacer la
 * frontière d'un jour. C'est la même raison qui fait que le bail stocke des
 * dates civiles.
 */

/** Une date civile `YYYY-MM-DD`, décomposée. */
type CivilDate = { year: number; month: number; day: number };

const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Décompose une date civile, ou échoue.
 *
 * L'échec est une erreur de programmation et non une entrée utilisateur : les
 * dates arrivent ici depuis des colonnes `date` et depuis des schémas Zod qui
 * les ont déjà validées. Une date mal formée signifie qu'un appelant a sauté
 * l'une des deux barrières.
 */
function parseCivilDate(value: string): CivilDate {
  const match = CIVIL_DATE.exec(value);

  if (!match) throw new TypeError(`Date civile attendue au format YYYY-MM-DD, reçu « ${value} ».`);

  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function formatCivilDate({ year, month, day }: CivilDate): string {
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Nombre de jours d'un mois, année bissextile comprise.
 *
 * Le jour 0 du mois SUIVANT est le dernier jour du mois demandé : la
 * bibliothèque standard porte déjà la règle bissextile, y compris l'exception
 * séculaire, qu'il serait absurde de réécrire. `Date.UTC` compte les mois à
 * partir de zéro, donc `month` tel quel désigne bien le mois suivant.
 */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Premier jour du mois d'une date civile : la période qui la contient. */
export function periodOf(civilDate: string): string {
  const { year, month } = parseCivilDate(civilDate);

  return formatCivilDate({ year, month, day: 1 });
}

/** Dernier jour de la période, utile pour savoir si un bail la recouvre. */
export function periodEndOf(periodStart: string): string {
  const { year, month } = parseCivilDate(periodStart);

  return formatCivilDate({ year, month, day: daysInMonth(year, month) });
}

/**
 * Période suivante. Sert aux tests et à un éventuel rattrapage manuel en série.
 */
export function nextPeriod(periodStart: string): string {
  const { year, month } = parseCivilDate(periodStart);

  return month === 12
    ? formatCivilDate({ year: year + 1, month: 1, day: 1 })
    : formatCivilDate({ year, month: month + 1, day: 1 });
}

/**
 * Date d'échéance d'une période, pour un jour du mois convenu au contrat
 * (règle 3 de DEC-053).
 *
 * Le jour est rabattu, jamais reporté : `min(due_day, dernier jour du mois)`.
 * Le bail autorise `due_day` jusqu'à 31 précisément parce qu'il enregistre ce
 * que les parties ont convenu sans inventer de règle de report, et le report est
 * décidé ICI, à la génération. C'est ce que dit le commentaire de
 * `LEASE_DUE_DAY_MAX`.
 */
export function dueDateFor(periodStart: string, dueDay: number): string {
  const { year, month } = parseCivilDate(periodStart);

  return formatCivilDate({ year, month, day: Math.min(dueDay, daysInMonth(year, month)) });
}

/**
 * Le bail recouvre-t-il cette période ?
 *
 * Règle de RECOUVREMENT, et non d'appartenance du premier jour : un bail qui
 * commence le 20 octobre doit une échéance d'octobre, et c'est la conséquence
 * directe de l'absence de prorata (règle 2). Sans cela, ses onze premiers jours
 * ne seraient facturés nulle part, et le premier loyer tomberait en novembre.
 *
 * La symétrie vaut pour la fin : un bail qui se termine le 10 octobre doit
 * l'échéance d'octobre en entier. C'est un cas de bord étroit, puisqu'un bail
 * clôturé n'est plus actif et ne sera donc plus pris par la génération : il ne
 * se produit que si la génération a eu lieu AVANT la clôture, ce qui est le cas
 * normal, l'échéance naissant en début de mois.
 */
export function leaseCoversPeriod(
  lease: { startDate: string; endDate: string | null },
  periodStart: string,
): boolean {
  if (lease.startDate > periodEndOf(periodStart)) return false;

  return lease.endDate === null || lease.endDate >= periodStart;
}

/**
 * L'échéance est-elle en retard, à la date donnée ?
 *
 * Le retard est une comparaison de dates civiles, pas un calcul de durée : une
 * échéance due le 5 est en retard le 6, quelle que soit l'heure. C'est le job
 * `markOverdueReceivables` qui écrit le statut, jamais la lecture (BR-037).
 */
export function isPastDue(dueDate: string, today: string): boolean {
  return dueDate < today;
}
