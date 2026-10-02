import { and, eq } from 'drizzle-orm';

import { SEED_IDS } from '../../src/db/seed';
import { hashPassword } from '../../src/lib/auth/session';
import { loadAccessContext } from '../../src/lib/authorization/access-context';
import type { ManagerServiceOptions } from '../../src/modules/managers/service';
import { createTestAuth } from './auth';
import type { TestDatabase } from './database';

/**
 * Aides communes aux tests du Lot 6.
 *
 * Elles construisent des situations précises, une personne révoquée, un immeuble
 * archivé, une invitation périmée, que le seed ne contient pas. Elles écrivent
 * directement en base : un test d'invitation ne doit pas dépendre du cas d'usage
 * qui crée l'état dont il part.
 */

/** Instant fixe : l'expiration se teste sans attendre sept jours. */
export const NOW = new Date('2026-10-02T09:00:00.000Z');

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Réglages d'un appel : instant, durée et adresse du site, sans lire l'environnement. */
export const OPTIONS: ManagerServiceOptions = {
  now: NOW,
  ttlDays: 7,
  appUrl: 'https://immo.test',
};

export const at = (offsetMs: number): Date => new Date(NOW.getTime() + offsetMs);

/** Un nouveau numéro à chaque appel, pour que les tests d'un même fichier ne se heurtent pas. */
let phoneCounter = 0;

export function freshPhone(): string {
  phoneCounter += 1;

  return `+2246210${String(phoneCounter).padStart(5, '0')}`;
}

export type Harness = Pick<TestDatabase, 'db' | 'schema'>;

/** Crée un immeuble de l'organisation A, ou de celle indiquée. */
export async function addProperty(
  harness: Harness,
  name: string,
  options: { organizationId?: string; archived?: boolean } = {},
): Promise<string> {
  const [row] = await harness.db
    .insert(harness.schema.properties)
    .values({
      organizationId: options.organizationId ?? SEED_IDS.organizationA,
      name,
      archivedAt: options.archived ? NOW : null,
    })
    .returning({ id: harness.schema.properties.id });

  if (!row) throw new Error("L'immeuble de test n'a pas été créé.");

  return row.id;
}

/** Crée un utilisateur de test, avec son statut. */
export async function addUser(
  harness: Harness,
  values: {
    fullName?: string;
    phone?: string;
    email?: string | null;
    status?: 'PENDING_ACTIVATION' | 'ACTIVE' | 'SUSPENDED';
    archived?: boolean;
  } = {},
): Promise<{ id: string; phone: string }> {
  const phone = values.phone ?? freshPhone();

  const [row] = await harness.db
    .insert(harness.schema.users)
    .values({
      fullName: values.fullName ?? 'Personne de test',
      phone,
      email: values.email ?? null,
      status: values.status ?? 'ACTIVE',
      archivedAt: values.archived ? NOW : null,
    })
    .returning({ id: harness.schema.users.id });

  if (!row) throw new Error("L'utilisateur de test n'a pas été créé.");

  return { id: row.id, phone };
}

/** Donne à un utilisateur un rôle dans une organisation, avec un statut. */
export async function addAccess(
  harness: Harness,
  values: {
    userId: string;
    role: 'OWNER' | 'MANAGER' | 'TENANT';
    organizationId?: string;
    status?: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  },
): Promise<string> {
  const status = values.status ?? 'ACTIVE';

  const [row] = await harness.db
    .insert(harness.schema.userAccess)
    .values({
      userId: values.userId,
      organizationId: values.organizationId ?? SEED_IDS.organizationA,
      role: values.role,
      status,
      revokedAt: status === 'REVOKED' ? NOW : null,
    })
    .returning({ id: harness.schema.userAccess.id });

  if (!row) throw new Error("L'accès de test n'a pas été créé.");

  return row.id;
}

/** Attribue un immeuble à un accès, éventuellement déjà révoqué. */
export async function addScope(
  harness: Harness,
  accessId: string,
  propertyId: string,
  options: { revoked?: boolean } = {},
): Promise<string> {
  const [row] = await harness.db
    .insert(harness.schema.managerPropertyAccess)
    .values({
      userAccessId: accessId,
      propertyId,
      revokedAt: options.revoked ? NOW : null,
    })
    .returning({ id: harness.schema.managerPropertyAccess.id });

  if (!row) throw new Error('Le périmètre de test n’a pas été créé.');

  return row.id;
}

/** Contexte d'accès d'un utilisateur, tel que le service d'autorisation le relit. */
export const contextOf = (harness: Harness, userId: string) =>
  loadAccessContext(harness.db, userId);

/** Hacheur de mot de passe branché sur une vraie instance d'authentification de test. */
export function passwordHasher(harness: Harness): (password: string) => Promise<string> {
  const auth = createTestAuth(harness.db);

  return (password) => hashPassword(auth, password);
}

/** Ligne d'invitation, relue en base. */
export async function readInvitation(harness: Harness, invitationId: string) {
  const [row] = await harness.db
    .select()
    .from(harness.schema.invitations)
    .where(eq(harness.schema.invitations.id, invitationId));

  if (!row) throw new Error(`Invitation ${invitationId} introuvable.`);

  return row;
}

/** Accès de gestionnaire d'une personne dans une organisation, relu en base. */
export async function readManagerAccess(
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
        eq(harness.schema.userAccess.role, 'MANAGER'),
      ),
    );

  return row;
}

/** Immeubles ACTUELLEMENT accessibles à un accès, triés pour une comparaison stable. */
export async function activeScopeOf(harness: Harness, accessId: string): Promise<string[]> {
  const rows = await harness.db
    .select({
      propertyId: harness.schema.managerPropertyAccess.propertyId,
      revokedAt: harness.schema.managerPropertyAccess.revokedAt,
    })
    .from(harness.schema.managerPropertyAccess)
    .where(eq(harness.schema.managerPropertyAccess.userAccessId, accessId));

  return rows
    .filter((row) => row.revokedAt === null)
    .map((row) => row.propertyId)
    .sort();
}
