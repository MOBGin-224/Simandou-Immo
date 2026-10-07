import { and, eq } from 'drizzle-orm';

import { SEED_IDS } from '../../src/db/seed';
import type { TenantServiceOptions } from '../../src/modules/tenants/service';
import { NOW, type Harness } from './managers';

/**
 * Aides propres aux tests du Lot 7.
 *
 * Elles s'appuient sur celles du Lot 6, qui construisent déjà des utilisateurs,
 * des accès, des immeubles et des contextes : les deux lots partagent `users`,
 * `user_access` et `invitations`, donc dupliquer ces aides ferait seulement
 * diverger deux façons de fabriquer la même situation.
 *
 * Ce qui s'ajoute ici est ce que le locataire apporte : le LOGEMENT, qui porte
 * son contexte locatif (DEC-046), et la lecture de son accès.
 */

export {
  DAY_MS,
  NOW,
  addAccess,
  addProperty,
  addScope,
  addSession,
  addUser,
  at,
  contextOf,
  countSessions,
  failingInTransaction,
  freshPhone,
  passwordHasher,
  readInvitation,
  type Harness,
} from './managers';

/** Réglages d'un appel : instant, durée et adresse du site, sans lire l'environnement. */
export const OPTIONS: TenantServiceOptions = {
  now: NOW,
  ttlDays: 7,
  appUrl: 'https://immo.test',
};

/** Crée un logement dans un immeuble, éventuellement archivé ou déjà occupé. */
export async function addApartment(
  harness: Harness,
  propertyId: string,
  number: string,
  options: {
    organizationId?: string;
    archived?: boolean;
    status?: 'VACANT' | 'OCCUPIED' | 'MAINTENANCE';
  } = {},
): Promise<string> {
  const [row] = await harness.db
    .insert(harness.schema.apartments)
    .values({
      organizationId: options.organizationId ?? SEED_IDS.organizationA,
      propertyId,
      number,
      status: options.status ?? 'VACANT',
      archivedAt: options.archived ? NOW : null,
    })
    .returning({ id: harness.schema.apartments.id });

  if (!row) throw new Error("Le logement de test n'a pas été créé.");

  return row.id;
}

/** Accès locataire d'une personne dans une organisation, relu en base. */
export async function readTenantAccess(
  harness: Harness,
  userId: string,
  organizationId: string = SEED_IDS.organizationA,
) {
  const [row] = await harness.db
    .select()
    .from(harness.schema.userAccess)
    .where(
      and(
        eq(harness.schema.userAccess.userId, userId),
        eq(harness.schema.userAccess.organizationId, organizationId),
        eq(harness.schema.userAccess.role, 'TENANT'),
      ),
    );

  return row;
}

/** Lignes de périmètre d'immeubles d'un accès : un locataire ne doit en avoir AUCUNE. */
export async function scopeRowCount(harness: Harness, accessId: string): Promise<number> {
  const rows = await harness.db
    .select({ id: harness.schema.managerPropertyAccess.id })
    .from(harness.schema.managerPropertyAccess)
    .where(eq(harness.schema.managerPropertyAccess.userAccessId, accessId));

  return rows.length;
}

/** Nom actuel d'une personne, relu en base : c'est `users.full_name` qui porte le nom. */
export async function readFullName(harness: Harness, userId: string): Promise<string | undefined> {
  const [row] = await harness.db
    .select({ fullName: harness.schema.users.fullName })
    .from(harness.schema.users)
    .where(eq(harness.schema.users.id, userId));

  return row?.fullName;
}
