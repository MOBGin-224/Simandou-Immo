import { sql, type ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import * as schemaTypes from './schema';
import {
  apartments,
  managerPropertyAccess,
  organizations,
  properties,
  userAccess,
  users,
} from './schema';

/**
 * Données de départ du développement (MVP-BACKLOG-006).
 *
 * Deux exigences gouvernent ce fichier.
 *
 * 1. La SECONDE ORGANISATION est obligatoire. Sans elle, les tests d'isolation
 *    multi-tenant sont impossibles à écrire : on ne peut pas vérifier qu'une
 *    organisation ne voit pas les données d'une autre s'il n'en existe qu'une.
 *
 * 2. Le seed est IDEMPOTENT. Les identifiants sont fixes plutôt que générés, ce
 *    qui permet de le rejouer sans dupliquer, et aux tests de désigner une
 *    donnée précise sans la chercher.
 *
 * Un gestionnaire avec périmètre est inclus, alors que MVP-BACKLOG-006 ne le
 * demande pas explicitement : `manager_property_access` est une table de ce lot,
 * et le Database Schema §62 exige des gestionnaires dans le seed. La laisser
 * vide rendrait le lot incohérent avec lui-même.
 */

// Identifiants fixes. Le préfixe distingue l'organisation d'un coup d'oeil.
export const SEED_IDS = {
  organizationA: '0a000000-0000-4000-8000-000000000001',
  ownerA: '0a000000-0000-4000-8000-000000000010',
  managerA: '0a000000-0000-4000-8000-000000000011',
  propertyA: '0a000000-0000-4000-8000-000000000020',
  apartmentA01: '0a000000-0000-4000-8000-000000000031',
  apartmentA02: '0a000000-0000-4000-8000-000000000032',
  apartmentA03: '0a000000-0000-4000-8000-000000000033',
  accessOwnerA: '0a000000-0000-4000-8000-000000000040',
  accessManagerA: '0a000000-0000-4000-8000-000000000041',
  scopeManagerA: '0a000000-0000-4000-8000-000000000050',

  organizationB: '0b000000-0000-4000-8000-000000000001',
  ownerB: '0b000000-0000-4000-8000-000000000010',
  propertyB: '0b000000-0000-4000-8000-000000000020',
  accessOwnerB: '0b000000-0000-4000-8000-000000000040',
} as const;

/** Montants en plus petite unité de la devise, GNF sans sous-unité (DEC-014). */
const GNF = 'GNF';

/**
 * Cible du seed, indépendante du pilote.
 *
 * Le code applicatif se connecte via postgres.js, les tests via PGlite. Les deux
 * dérivent de `PgDatabase` : typer la cible ainsi permet de semer la même
 * fonction dans les deux contextes, donc de tester le seed réellement utilisé
 * plutôt qu'une copie.
 */
export type SeedTarget = PgDatabase<
  PgQueryResultHKT,
  typeof schemaTypes,
  ExtractTablesWithRelations<typeof schemaTypes>
>;

export async function seed(db: SeedTarget) {
  await db.transaction(async (tx) => {
    // --- Organisations -------------------------------------------------------
    await tx
      .insert(organizations)
      .values([
        { id: SEED_IDS.organizationA, name: 'Patrimoine Camayenne', type: 'COMPANY' },
        { id: SEED_IDS.organizationB, name: 'Résidences Dixinn', type: 'INDIVIDUAL' },
      ])
      .onConflictDoNothing();

    // --- Utilisateurs --------------------------------------------------------
    await tx
      .insert(users)
      .values([
        {
          id: SEED_IDS.ownerA,
          fullName: 'Aïssatou Barry',
          phone: '+224620000001',
          status: 'ACTIVE',
        },
        {
          id: SEED_IDS.managerA,
          fullName: 'Mamadou Diallo',
          phone: '+224620000002',
          status: 'ACTIVE',
        },
        {
          id: SEED_IDS.ownerB,
          fullName: 'Fatoumata Camara',
          phone: '+224620000003',
          status: 'ACTIVE',
        },
      ])
      .onConflictDoNothing();

    // --- Accès ---------------------------------------------------------------
    await tx
      .insert(userAccess)
      .values([
        {
          id: SEED_IDS.accessOwnerA,
          userId: SEED_IDS.ownerA,
          organizationId: SEED_IDS.organizationA,
          role: 'OWNER',
        },
        {
          id: SEED_IDS.accessManagerA,
          userId: SEED_IDS.managerA,
          organizationId: SEED_IDS.organizationA,
          role: 'MANAGER',
        },
        {
          id: SEED_IDS.accessOwnerB,
          userId: SEED_IDS.ownerB,
          organizationId: SEED_IDS.organizationB,
          role: 'OWNER',
        },
      ])
      .onConflictDoNothing();

    // --- Immeubles -----------------------------------------------------------
    await tx
      .insert(properties)
      .values([
        {
          id: SEED_IDS.propertyA,
          organizationId: SEED_IDS.organizationA,
          name: 'Immeuble Camayenne',
          address: 'Corniche Nord',
          city: 'Conakry',
          district: 'Camayenne',
        },
        {
          id: SEED_IDS.propertyB,
          organizationId: SEED_IDS.organizationB,
          name: 'Immeuble Dixinn',
          address: 'Route du Niger',
          city: 'Conakry',
          district: 'Dixinn',
        },
      ])
      .onConflictDoNothing();

    // --- Périmètre du gestionnaire -------------------------------------------
    // Le gestionnaire de l'organisation A ne couvre que l'immeuble A. C'est ce
    // qui rendra testable le refus d'accès hors périmètre (ADR-007).
    await tx
      .insert(managerPropertyAccess)
      .values([
        {
          id: SEED_IDS.scopeManagerA,
          userAccessId: SEED_IDS.accessManagerA,
          propertyId: SEED_IDS.propertyA,
        },
      ])
      .onConflictDoNothing();

    // --- Appartements --------------------------------------------------------
    await tx
      .insert(apartments)
      .values([
        /*
         * Aucun `status` : la colonne est gelee depuis DEC-050, et l'occupation
         * se deduit des baux. A03 porte des travaux declares, qui sont la seule
         * saisie restante, et qui n'empechent pas le logement d'etre loue.
         */
        {
          id: SEED_IDS.apartmentA01,
          organizationId: SEED_IDS.organizationA,
          propertyId: SEED_IDS.propertyA,
          number: 'A01',
          floor: 0,
          type: 'T3',
          area: '78.50',
          referenceRentAmount: 2500000,
          currency: GNF,
        },
        {
          id: SEED_IDS.apartmentA02,
          organizationId: SEED_IDS.organizationA,
          propertyId: SEED_IDS.propertyA,
          number: 'A02',
          floor: 1,
          type: 'T3',
          area: '78.50',
          referenceRentAmount: 2500000,
          currency: GNF,
        },
        {
          id: SEED_IDS.apartmentA03,
          organizationId: SEED_IDS.organizationA,
          propertyId: SEED_IDS.propertyA,
          number: 'A03',
          floor: 2,
          type: 'T4',
          area: '95.00',
          underMaintenance: true,
          referenceRentAmount: 3200000,
          currency: GNF,
        },
      ])
      .onConflictDoNothing();
  });
}

/**
 * Compte les lignes présentes, afin que le script rende compte de ce qu'il a
 * réellement produit plutôt que d'annoncer un succès non vérifié.
 */
export async function countSeeded(db: SeedTarget) {
  return db.execute(sql`
    select
      (select count(*) from organizations)           as organizations,
      (select count(*) from users)                   as users,
      (select count(*) from user_access)             as user_access,
      (select count(*) from properties)              as properties,
      (select count(*) from manager_property_access) as manager_scope,
      (select count(*) from apartments)              as apartments
  `);
}
