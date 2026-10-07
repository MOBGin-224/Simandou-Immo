import { z } from 'zod';

import type { Lease } from '@/db/schema';
import {
  ResourceOutOfScopeError,
  readablePropertyScopes,
  requirePermission,
  type AccessContext,
  type Permission,
} from '@/lib/authorization';
import { resolveTenantPerson } from '@/modules/tenants';

import type { LeaseStatus } from './constants';
import {
  compareLeaseItems,
  type LeasableApartment,
  type LeaseApartmentRef,
  type LeaseListItem,
  type LeaseTenantRef,
  type LeaseView,
} from './domain';
import {
  LeaseConflictError,
  LeaseStateError,
  LeaseTerminationDateError,
  LeaseValidationError,
} from './errors';
import {
  ACTIVE_PER_APARTMENT_CONSTRAINT,
  ACTIVE_PER_TENANT_CONSTRAINT,
  findActiveLeaseForApartment,
  findActiveLeaseForTenant,
  countOccupiedByProperty,
  findApartmentById,
  findApartmentsByIds,
  findLeaseById,
  findOccupiedApartmentIds,
  findOccupiedApartmentIdsInProperty,
  findOrganizationName,
  findPeopleByIds,
  findPersonById,
  insertLease,
  isPersonKnownToOrganization,
  isUniqueViolation,
  listApartmentsWithoutActiveLease,
  listLeaseRows,
  listLeasesForTenant,
  terminateLeaseRow,
  updateLeaseRow,
  type ApartmentRow,
  type LeasesDatabase,
} from './repository';
import {
  createLeaseSchema,
  listLeasesQuerySchema,
  terminateLeaseSchema,
  updateLeaseSchema,
} from './schemas';

/**
 * Cas d'usage du module Contrats (MVP-BACKLOG-032 à 035, API section 17).
 *
 * Chaque fonction suit l'ordre imposé par API-001, sans exception :
 *
 * ```text
 * Authentification  déjà faite, le contexte d'accès la présuppose
 * ↓
 * Validation        schéma Zod, ici et non chez l'appelant
 * ↓
 * Périmètre         logement, immeuble et permission, par le point de décision unique
 * ↓
 * Règle métier      un seul bail actif par logement, un seul par personne
 * ↓
 * Persistance       la contrainte de base arbitre les courses
 * ```
 *
 * **Ce qu'est un bail.** La relation locative qui rattache une personne à un
 * logement (BR-020). C'est elle, et non l'invitation, qui porte désormais le
 * logement d'un locataire : au Lot 7 l'invitation le portait faute de bail.
 *
 * **Deux règles d'unicité, et deux seulement.** Un logement n'a qu'un bail actif
 * (BR-028), et une personne n'a qu'une relation locative active par organisation
 * (DEC-049, appliquée ICI et non au niveau de l'invitation, comme la décision le
 * demande). Les deux sont portées par un index d'unicité partiel : un
 * pré-contrôle par lecture laisserait passer deux créations simultanées.
 *
 * **Un bail naît ACTIF.** `DRAFT` et `CANCELLED` restent dans l'énumération pour
 * un lot futur : aucun document ne leur donne de comportement, et les routes
 * documentées sont la création, la consultation, la modification et la clôture.
 *
 * Aucune fonction ne reçoit ni `Request`, ni `FormData`, ni composant : ce module
 * est testable contre une vraie base sans monter de serveur.
 */

/**
 * Réglages d'un appel, tous facultatifs.
 *
 * Existent pour la TESTABILITÉ : fixer l'instant courant permet d'éprouver une
 * clôture sans dépendre de l'horloge de la machine.
 */
export type LeaseServiceOptions = {
  now?: Date;
};

function nowOf(options: LeaseServiceOptions): Date {
  return options.now ?? new Date();
}

function parseOrThrow<Schema extends z.ZodType>(schema: Schema, input: unknown): z.output<Schema> {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new LeaseValidationError(
      z.flattenError(result.error).fieldErrors as Record<string, string[]>,
    );
  }

  return result.data;
}

/** Date civile `YYYY-MM-DD` d'un instant, en temps universel. */
function civilDateOf(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

function apartmentRefOf(row: ApartmentRow): LeaseApartmentRef {
  return {
    id: row.id,
    number: row.number,
    propertyId: row.propertyId,
    propertyName: row.propertyName,
    archived: row.archivedAt !== null,
  };
}

// --- Vues ---------------------------------------------------------------------------

type ViewParts = {
  apartment: LeaseApartmentRef;
  tenant: LeaseTenantRef;
  organizationName: string;
};

function toView(lease: Lease, parts: ViewParts): LeaseView {
  return {
    id: lease.id,
    organizationId: lease.organizationId,
    organizationName: parts.organizationName,
    apartment: parts.apartment,
    tenant: parts.tenant,
    status: lease.status,
    startDate: lease.startDate,
    endDate: lease.endDate,
    rent: { amount: lease.rentAmount, currency: lease.currency },
    dueDay: lease.dueDay,
    deposit: { amount: lease.depositAmount, currency: lease.currency },
    terminationReason: lease.terminationReason,
    createdAt: lease.createdAt.toISOString(),
    updatedAt: lease.updatedAt.toISOString(),
    terminatedAt: lease.terminatedAt?.toISOString() ?? null,
  };
}

/**
 * Construit les vues de plusieurs baux en TROIS lectures, quel que soit leur
 * nombre : les logements, les personnes, les organisations.
 *
 * Une lecture par bail aurait suffi à l'écrire, et aurait fait une requête par
 * ligne affichée.
 */
async function toViews(db: LeasesDatabase, rows: readonly Lease[]): Promise<LeaseView[]> {
  if (rows.length === 0) return [];

  const organizationIds = [...new Set(rows.map((row) => row.organizationId))];

  const apartments = new Map(
    (await findApartmentsByIds(db, [...new Set(rows.map((row) => row.apartmentId))])).map((row) => [
      row.id,
      apartmentRefOf(row),
    ]),
  );

  const people = new Map(
    (
      await findPeopleByIds(db, [...new Set(rows.map((row) => row.tenantUserId))], organizationIds)
    ).map((row) => [row.userId, row]),
  );

  const names = new Map<string, string>();

  for (const organizationId of organizationIds) {
    names.set(organizationId, (await findOrganizationName(db, organizationId)) ?? '');
  }

  return rows.flatMap((row) => {
    const apartment = apartments.get(row.apartmentId);
    const person = people.get(row.tenantUserId);

    // Les clés étrangères sont en `restrict` : un bail sans logement ni personne
    // est impossible. On n'invente pas de ligne vide pour autant.
    if (!apartment || !person) return [];

    return [
      toView(row, {
        apartment,
        tenant: {
          userId: person.userId,
          accessId: person.accessId,
          fullName: person.fullName,
          phone: person.phone,
          email: person.email,
        },
        organizationName: names.get(row.organizationId) ?? '',
      }),
    ];
  });
}

/** Vue d'un bail unique. Lève `ResourceOutOfScopeError` si ses dépendances ont disparu. */
async function toSingleView(db: LeasesDatabase, lease: Lease): Promise<LeaseView> {
  const [view] = await toViews(db, [lease]);

  if (!view) throw new ResourceOutOfScopeError();

  return view;
}

// --- Création -----------------------------------------------------------------------

/**
 * Logement sur lequel l'appelant peut agir, ou refus indiscernable d'une absence.
 *
 * Un logement inexistant, d'une autre organisation ou hors du périmètre reçoivent
 * le MÊME refus (ADR-008). Un logement archivé, ou dont l'immeuble est archivé,
 * est refusé par une erreur de validation sur le champ : celui-là, l'appelant le
 * voit bien dans ses écrans, et lui dire « introuvable » serait trompeur.
 */
async function loadLeasableApartment(
  db: LeasesDatabase,
  context: AccessContext,
  apartmentId: string,
  permission: Extract<Permission, 'lease.create' | 'lease.update'>,
): Promise<ApartmentRow> {
  const apartment = await findApartmentById(db, apartmentId);

  if (!apartment) throw new ResourceOutOfScopeError();

  requirePermission(context, permission, {
    organizationId: apartment.organizationId,
    propertyId: apartment.propertyId,
  });

  if (apartment.archivedAt !== null || apartment.propertyArchivedAt !== null) {
    throw new LeaseValidationError({
      apartmentId: ['Ce logement est archivé : il ne peut plus recevoir de bail.'],
    });
  }

  return apartment;
}

/**
 * Identité du locataire du bail à créer : désignée, ou décrite puis créée.
 *
 * Les deux chemins ne se valent PAS du point de vue de l'isolation, et c'est tout
 * l'objet de cette fonction :
 *
 *   - DÉSIGNER un `users.id` exige que l'organisation connaisse déjà la personne.
 *     `users` est une table globale : sans ce contrôle, un bailleur attribuerait
 *     un logement à la locataire d'un autre bailleur et lirait en retour son nom
 *     et son téléphone. Personne inexistante, archivée ou inconnue de
 *     l'organisation reçoivent donc le MÊME refus (ADR-008, DEC-051 point 8) ;
 *   - DÉCRIRE une personne la crée, ou réutilise le compte du numéro s'il existe
 *     (DEC-041). Aucune trace n'est exigée, et il n'en faut pas : c'est ce geste
 *     qui établit la première.
 */
async function resolveTenant(
  tx: LeasesDatabase,
  organizationId: string,
  data: { tenantId?: string; tenant?: { name: string; phone: string; email: string | null } },
): Promise<string> {
  if (data.tenant !== undefined) {
    return (await resolveTenantPerson(tx, data.tenant)).id;
  }

  const person = await findPersonById(tx, data.tenantId ?? '');

  if (!person || person.archivedAt !== null) throw new ResourceOutOfScopeError();

  if (!(await isPersonKnownToOrganization(tx, organizationId, person.userId))) {
    throw new ResourceOutOfScopeError();
  }

  return person.userId;
}

/**
 * Crée un bail (MVP-BACKLOG-032, parcours 11).
 *
 * L'organisation et l'immeuble sont RECOPIÉS depuis le logement, jamais reçus de
 * l'appelant : c'est ce qui garantit qu'ils restent cohérents avec lui, et la
 * dénormalisation n'a de valeur que si elle ne peut pas mentir (ADR-007).
 *
 * **Deux façons de désigner le locataire.**
 *
 * `tenantId` désigne une personne que l'organisation CONNAÎT DÉJÀ, sans pour
 * autant avoir d'accès au produit (DEC-051). Une personne d'un autre bailleur
 * reçoit le même refus qu'un identifiant inconnu : son existence ne doit pas se
 * déduire d'un message, et surtout, un bail ne doit pas servir à lire le nom et
 * le téléphone d'une personne qu'on ne connaît pas (ADR-008).
 *
 * `tenant` DÉCRIT une personne, par son nom et son numéro, et la crée si elle est
 * inconnue : c'est le geste explicite que DEC-051 point 8 réserve, et c'est ce qui
 * permet de loger quelqu'un qui n'utilisera jamais l'application. La règle
 * d'identité est celle de l'invitation, `resolveTenantPerson` étant partagée : un
 * numéro déjà connu réutilise son compte au lieu d'en créer un second (DEC-041).
 *
 * Tout se passe alors dans une TRANSACTION : une personne créée sans le bail qui
 * la justifie ne doit jamais subsister.
 *
 * **Un locataire dont l'accès est révoqué peut recevoir un bail.** Les deux
 * concepts sont distincts (DEC-047) : révoquer l'accès au produit ne termine
 * aucun bail, et symétriquement, ne pas avoir d'accès n'empêche pas d'occuper un
 * logement. C'est la même frontière, vue de l'autre côté.
 */
export async function createLease(
  db: LeasesDatabase,
  context: AccessContext,
  input: unknown,
  // La création ne dépend d'aucun instant fourni : les horodatages viennent des
  // défauts de la colonne. Le paramètre existe pour que toutes les fonctions du
  // module aient la même signature, et il est volontairement ignoré.
  _options: LeaseServiceOptions = {},
): Promise<LeaseView> {
  const data = parseOrThrow(createLeaseSchema, input);
  const apartment = await loadLeasableApartment(db, context, data.apartmentId, 'lease.create');

  if (data.endDate !== null && data.endDate < data.startDate) {
    throw new LeaseValidationError({
      endDate: ['La date de fin ne peut pas précéder la date de début.'],
    });
  }

  // Le logement d'abord : le refuser ne dépend d'aucune personne, et le vérifier
  // avant évite de créer une personne pour un bail qui ne naîtra pas.
  if (await findActiveLeaseForApartment(db, apartment.id)) {
    throw new LeaseConflictError('apartment-occupied');
  }

  try {
    const created = await db.transaction(async (tx) => {
      const tenantUserId = await resolveTenant(tx, apartment.organizationId, data);

      /*
       * Pré-contrôle de la simultanéité, DANS la transaction : il donne un message
       * qui ORIENTE, là où la contrainte de base ne dirait que « violation
       * d'unicité ». L'index partiel reste l'arbitre, plus bas, en cas de course.
       */
      if (await findActiveLeaseForTenant(tx, apartment.organizationId, tenantUserId)) {
        throw new LeaseConflictError('tenant-engaged');
      }

      return insertLease(tx, {
        organizationId: apartment.organizationId,
        propertyId: apartment.propertyId,
        apartmentId: apartment.id,
        tenantUserId,
        startDate: data.startDate,
        endDate: data.endDate,
        rentAmount: data.rentAmount,
        currency: data.currency,
        dueDay: data.dueDay,
        depositAmount: data.depositAmount,
      });
    });

    return toSingleView(db, created);
  } catch (error) {
    // Deux créations simultanées passent chacune les pré-contrôles : l'index
    // d'unicité partiel arbitre, et la perdante reçoit le même refus que si elle
    // était arrivée après.
    if (isUniqueViolation(error, ACTIVE_PER_APARTMENT_CONSTRAINT)) {
      throw new LeaseConflictError('apartment-occupied');
    }

    if (isUniqueViolation(error, ACTIVE_PER_TENANT_CONSTRAINT)) {
      throw new LeaseConflictError('tenant-engaged');
    }

    throw error;
  }
}

// --- Lecture ------------------------------------------------------------------------

/**
 * Bail accessible à l'appelant, ou refus indiscernable d'une absence.
 *
 * La ressource soumise à la décision porte DEUX rattachements, et il faut les
 * deux (ADR-007) :
 *
 *   `propertyId`    l'immeuble du logement, que le bail porte en propre. Sans
 *                   lui, un gestionnaire n'atteint rien, ce qui est correct :
 *                   son autorité est bornée à un périmètre d'immeubles.
 *   `ownerUserId`   le locataire lui-même. C'est ce qui lui permet de consulter
 *                   SON contrat, et seulement le sien (BR-021).
 */
async function loadReadableLease(
  db: LeasesDatabase,
  context: AccessContext,
  leaseId: string,
  permission: Extract<Permission, 'lease.read' | 'lease.update' | 'lease.terminate'>,
): Promise<Lease> {
  // Un identifiant qui n'est pas un UUID ne peut désigner aucun bail. Sans ce
  // contrôle PostgreSQL refuserait la conversion et produirait une erreur
  // interne, là où la réponse correcte est « inexistant ».
  if (!z.uuid().safeParse(leaseId).success) throw new ResourceOutOfScopeError();

  const lease = await findLeaseById(db, leaseId);

  if (!lease) throw new ResourceOutOfScopeError();

  requirePermission(context, permission, {
    organizationId: lease.organizationId,
    propertyId: lease.propertyId,
    ownerUserId: lease.tenantUserId,
  });

  return lease;
}

/** Consulte un bail (API section 17). */
export async function getLease(
  db: LeasesDatabase,
  context: AccessContext,
  leaseId: string,
): Promise<LeaseView> {
  const lease = await loadReadableLease(db, context, leaseId, 'lease.read');

  return toSingleView(db, lease);
}

export type LeaseCollection = {
  leases: LeaseListItem[];
  meta: { total: number; page: number; pageSize: number };
};

/**
 * Liste les baux lisibles (MVP-BACKLOG-035).
 *
 * Le périmètre est traduit en conditions SQL par le dépôt : aucun bail d'une
 * autre organisation, ni d'un immeuble hors périmètre, ne quitte le serveur
 * (API section 67).
 *
 * Un appelant sans aucun périmètre lisible obtient « inexistant ». C'est le cas
 * d'un locataire : il consulte SON contrat par son espace, pas par cette liste,
 * parce que son rattachement est lui-même et non un immeuble (BR-021).
 */
export async function listLeases(
  db: LeasesDatabase,
  context: AccessContext,
  input: unknown = {},
  // La liste ne dépend d'aucun instant : le paramètre existe pour que toutes les
  // fonctions du module aient la même signature, et il est volontairement ignoré.
  _options: LeaseServiceOptions = {},
): Promise<LeaseCollection> {
  const query = parseOrThrow(listLeasesQuerySchema, input);
  const scopes = readablePropertyScopes(context, 'lease.read');

  if (scopes.length === 0) throw new ResourceOutOfScopeError();

  /*
   * Le filtre par locataire est donné en `users.id`, l'identité métier de la
   * personne (DEC-051) : c'est exactement ce que `leases.tenant_user_id`
   * référence, donc aucune traduction n'est nécessaire. Avant DEC-051 il fallait
   * passer d'un identifiant d'accès à une personne, et un locataire sans accès
   * n'aurait pas été filtrable du tout.
   *
   * Une personne inconnue ne donne aucune ligne, et ne se distingue pas d'une
   * personne sans bail (ADR-008).
   */
  const tenantUserId = query.tenantId ?? null;

  const rows = await listLeaseRows(db, scopes, {
    propertyId: query.propertyId ?? null,
    apartmentId: query.apartmentId ?? null,
    tenantUserId,
    status: query.status,
  });

  const views = (await toViews(db, rows)).map(
    ({ createdAt: _createdAt, updatedAt: _updatedAt, organizationName: _name, ...item }) => item,
  );

  const sorted = views.sort(compareLeaseItems);
  const start = (query.page - 1) * query.pageSize;

  return {
    leases: sorted.slice(start, start + query.pageSize),
    meta: { total: sorted.length, page: query.page, pageSize: query.pageSize },
  };
}

/**
 * Baux de la personne connectée, du plus récent au plus ancien (BR-021).
 *
 * Son espace locataire montre SON contrat. Le premier élément est le bail en
 * cours s'il en a un, l'ordre plaçant l'actif avant l'historique.
 */
export async function listMyLeases(
  db: LeasesDatabase,
  context: AccessContext,
): Promise<LeaseListItem[]> {
  const rows = await listLeasesForTenant(db, context.userId);
  const views = (await toViews(db, rows)).map(
    ({ createdAt: _createdAt, updatedAt: _updatedAt, organizationName: _name, ...item }) => item,
  );

  return views.sort(compareLeaseItems);
}

/**
 * Logements qu'un bail peut encore prendre, pour le formulaire de création.
 *
 * Seuls ceux SANS bail actif : proposer un logement déjà loué ferait remplir un
 * formulaire que BR-028 rejetterait à la fin.
 */
export async function listLeasableApartments(
  db: LeasesDatabase,
  context: AccessContext,
): Promise<LeasableApartment[]> {
  const scopes = readablePropertyScopes(context, 'lease.create');

  if (scopes.length === 0) return [];

  return (await listApartmentsWithoutActiveLease(db, scopes)).map((row) => ({
    ...apartmentRefOf(row),
    referenceRent:
      row.referenceRentAmount !== null && row.referenceCurrency !== null
        ? { amount: row.referenceRentAmount, currency: row.referenceCurrency }
        : null,
  }));
}

// --- Modification et clôture --------------------------------------------------------

/** Pourquoi une écriture conditionnelle n'a touché aucune ligne : l'état RÉEL, relu. */
async function stateErrorOf(
  db: LeasesDatabase,
  action: 'update' | 'terminate',
  leaseId: string,
): Promise<Error> {
  const current = await findLeaseById(db, leaseId);

  return current ? new LeaseStateError(action, current.status) : new ResourceOutOfScopeError();
}

/**
 * Modifie un bail (API section 17, BR-032).
 *
 * Ni le logement ni le locataire : ils définissent la relation, et en changer un
 * ferait un autre bail. Pour déplacer un locataire, on clôture et on recrée, ce
 * qui conserve l'historique du logement (BR-027).
 *
 * **Ce que BR-032 demandera au Lot 9.** Un changement de loyer ne doit pas
 * modifier les échéances déjà passées. Aucune échéance n'existe au Lot 8 : la
 * règle n'a donc rien à protéger ici, et c'est la génération des échéances qui
 * devra lire le loyer en vigueur pour la période qu'elle produit. Le dire
 * maintenant évite qu'on croie la règle déjà appliquée.
 *
 * Un bail clôturé ne se modifie plus : son contenu décrit ce qui a eu lieu.
 */
export async function updateLease(
  db: LeasesDatabase,
  context: AccessContext,
  leaseId: string,
  input: unknown,
  options: LeaseServiceOptions = {},
): Promise<LeaseView> {
  const data = parseOrThrow(updateLeaseSchema, input);
  const lease = await loadReadableLease(db, context, leaseId, 'lease.update');

  const startDate = data.startDate ?? lease.startDate;
  const endDate = data.endDate === undefined ? lease.endDate : data.endDate;

  if (endDate !== null && endDate < startDate) {
    throw new LeaseValidationError({
      endDate: ['La date de fin ne peut pas précéder la date de début.'],
    });
  }

  const updated = await updateLeaseRow(db, lease.id, data, nowOf(options));

  if (!updated) throw await stateErrorOf(db, 'update', lease.id);

  return toSingleView(db, updated);
}

/**
 * Clôture un bail (API section 17, MVP-BACKLOG-033).
 *
 * La date de clôture devient la date de FIN du bail : c'est elle qui empêchera la
 * génération d'échéances au-delà, au Lot 9. Elle ne peut pas précéder le début,
 * ce que la base refuse aussi de son côté.
 *
 * **La clôture libère le logement** : l'index d'unicité ne retient que les baux
 * actifs, donc un nouveau bail peut être créé aussitôt (BR-027). Et elle libère
 * la personne au sens de DEC-049 : elle peut reprendre un autre logement du même
 * bailleur.
 *
 * **Elle ne touche PAS l'accès au produit.** Un locataire qui a quitté son
 * logement garde son compte et son espace tant que personne ne révoque son accès
 * (DEC-047). Les deux opérations sont distinctes, dans les deux sens.
 *
 * L'historique est conservé : rien n'est supprimé, le bail reste consultable, et
 * c'est de lui que se reconstruit l'historique locatif d'un logement.
 */
export async function terminateLease(
  db: LeasesDatabase,
  context: AccessContext,
  leaseId: string,
  input: unknown,
  options: LeaseServiceOptions = {},
): Promise<LeaseView> {
  const data = parseOrThrow(terminateLeaseSchema, input);
  const lease = await loadReadableLease(db, context, leaseId, 'lease.terminate');

  if (data.terminationDate < lease.startDate) {
    throw new LeaseTerminationDateError(lease.startDate);
  }

  const terminated = await terminateLeaseRow(db, lease.id, {
    endDate: data.terminationDate,
    reason: data.reason,
    now: nowOf(options),
  });

  if (!terminated) throw await stateErrorOf(db, 'terminate', lease.id);

  return toSingleView(db, terminated);
}

// --- Ce que les autres modules demandent au bail ------------------------------------

/**
 * Statut d'occupation DÉRIVÉ d'un logement (DEC-050).
 *
 * Les modules Appartements et Immeubles ne lisent plus une saisie : un logement
 * avec un bail en cours est occupé, sans bail en cours il est vacant. La
 * maintenance n'entre pas dans ce calcul, n'étant pas une occupation : elle reste
 * une saisie, portée à part par `apartments.under_maintenance`, et affichée en
 * plus de l'occupation et non à sa place.
 *
 * Aucune permission n'est vérifiée ici : l'appelant a déjà établi qu'il pouvait
 * lire CE logement, et c'est cette lecture qui le lui dit occupé ou non.
 */
export async function isApartmentOccupied(
  db: LeasesDatabase,
  apartmentId: string,
): Promise<boolean> {
  return (await findActiveLeaseForApartment(db, apartmentId)) !== undefined;
}

/**
 * Parmi les logements indiqués, ceux qui portent un bail en cours.
 *
 * La version en lot de la fonction ci-dessus : afficher une page de vingt
 * logements ferait autrement vingt requêtes.
 */
export async function occupiedApartmentIds(
  db: LeasesDatabase,
  apartmentIds: readonly string[],
): Promise<Set<string>> {
  return new Set(await findOccupiedApartmentIds(db, apartmentIds));
}

/**
 * Logements occupés d'un immeuble, pour FILTRER une liste en SQL.
 *
 * Distincte de la précédente parce qu'un filtre doit s'appliquer avant la
 * pagination : filtrer après donnerait des pages incomplètes et un total faux.
 */
export async function occupiedApartmentIdsInProperty(
  db: LeasesDatabase,
  propertyId: string,
): Promise<string[]> {
  return findOccupiedApartmentIdsInProperty(db, propertyId);
}

/** Nombre de logements occupés par immeuble, pour les compteurs du parc. */
export async function occupiedCountByProperty(
  db: LeasesDatabase,
  propertyIds: readonly string[],
): Promise<Map<string, number>> {
  return countOccupiedByProperty(db, propertyIds);
}

/**
 * Logement qu'une personne occupe dans une organisation, d'après son bail actif.
 *
 * C'est ce que le module Locataires doit appeler à la place de « le logement de
 * la dernière invitation acceptée » : au Lot 7, l'invitation portait le logement
 * faute de bail (DEC-046), et c'est le bail qui le porte désormais.
 */
export async function findOccupiedApartment(
  db: LeasesDatabase,
  organizationId: string,
  tenantUserId: string,
): Promise<LeaseApartmentRef | null> {
  const lease = await findActiveLeaseForTenant(db, organizationId, tenantUserId);

  if (!lease) return null;

  const apartment = await findApartmentById(db, lease.apartmentId);

  return apartment ? apartmentRefOf(apartment) : null;
}

/** Statut d'un bail, tel que les autres modules le lisent sans importer le domaine. */
export type { LeaseStatus };

/** Date du jour en date civile, pour préremplir un formulaire de clôture. */
export function today(options: LeaseServiceOptions = {}): string {
  return civilDateOf(nowOf(options));
}
