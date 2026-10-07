import { eq } from 'drizzle-orm';

import { SEED_IDS } from '../../src/db/seed';
import type { LeaseServiceOptions } from '../../src/modules/leases/service';
import { acceptTenantInvitation, inviteTenant } from '../../src/modules/tenants/service';
import { NOW, OPTIONS as TENANT_OPTIONS, type Harness } from './tenants';

/**
 * Aides propres aux tests du Lot 8.
 *
 * Elles s'appuient sur celles des Lots 6 et 7 : les trois lots partagent
 * `users`, `user_access` et les logements, donc refabriquer ces situations ferait
 * seulement diverger deux façons de construire la même chose.
 *
 * Ce qui s'ajoute ici est le LOCATAIRE PRÊT À RECEVOIR UN BAIL, qui demande de
 * dérouler l'invitation puis son acceptation, et la relecture d'un bail en base.
 */

export {
  DAY_MS,
  NOW,
  addAccess,
  addApartment,
  addProperty,
  addScope,
  addSession,
  addUser,
  at,
  contextOf,
  countSessions,
  freshPhone,
  passwordHasher,
  readTenantAccess,
  type Harness,
} from './tenants';

/** Réglages d'un appel : instant fixe, pour éprouver une clôture sans dépendre de l'horloge. */
export const OPTIONS: LeaseServiceOptions = { now: NOW };

/** Date civile de l'instant de référence des tests, et décalages en jours. */
export const TODAY = NOW.toISOString().slice(0, 10);

export function dayOffset(days: number): string {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Crée un locataire ACTIF sur un logement et renvoie son accès.
 *
 * Passe par l'invitation et son acceptation, c'est-à-dire par le vrai chemin :
 * un accès locataire fabriqué à la main ne prouverait pas que le bail s'appuie
 * sur ce que le Lot 7 produit réellement.
 */
export async function addTenant(
  harness: Harness,
  values: {
    apartmentId: string;
    name?: string;
    phone: string;
    ownerContext: Parameters<typeof inviteTenant>[1];
    hashPassword: (password: string) => Promise<string>;
  },
): Promise<{ accessId: string; userId: string; phone: string }> {
  const issued = await inviteTenant(
    harness.db,
    values.ownerContext,
    {
      apartmentId: values.apartmentId,
      name: values.name ?? 'Locataire de test',
      phone: values.phone,
      email: '',
    },
    TENANT_OPTIONS,
  );

  const accepted = await acceptTenantInvitation(
    harness.db,
    { hashPassword: values.hashPassword },
    { token: issued.token, password: 'mot-de-passe-solide' },
    TENANT_OPTIONS,
  );

  return { accessId: accepted.accessId, userId: accepted.userId, phone: values.phone };
}

/** Ligne de bail, relue en base. */
export async function readLease(harness: Harness, leaseId: string) {
  const [row] = await harness.db
    .select()
    .from(harness.schema.leases)
    .where(eq(harness.schema.leases.id, leaseId));

  if (!row) throw new Error(`Bail ${leaseId} introuvable.`);

  return row;
}

/** Baux d'un logement, du plus récent au plus ancien, relus en base. */
export async function leasesOfApartment(harness: Harness, apartmentId: string) {
  return harness.db
    .select()
    .from(harness.schema.leases)
    .where(eq(harness.schema.leases.apartmentId, apartmentId));
}

/** Organisation A du seed, celle de la plupart des situations de test. */
export const ORGANIZATION = SEED_IDS.organizationA;
