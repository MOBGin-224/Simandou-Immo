import { and, eq } from 'drizzle-orm';

import type { RentServiceOptions } from '../../src/modules/rents/service';
import { createLease } from '../../src/modules/leases/service';
import { NOW, OPTIONS as LEASE_OPTIONS, TODAY, addTenant, type Harness } from './leases';

/**
 * Aides propres aux tests du Lot 9.
 *
 * Elles s'appuient sur celles du Lot 8, et pour une raison de fond : une échéance
 * de loyer NAÎT d'un bail actif (BR-034). Fabriquer des échéances à la main
 * prouverait seulement que l'insertion fonctionne, pas que la génération lit les
 * bons contrats. Tous les tests partent donc d'un vrai bail, créé par le vrai
 * cas d'usage.
 *
 * Ce qui s'ajoute ici est le BAIL PRÊT À ÊTRE FACTURÉ, et la relecture des
 * échéances en base.
 */

export {
  DAY_MS,
  NOW,
  ORGANIZATION,
  TODAY,
  addAccess,
  addApartment,
  addProperty,
  addScope,
  addTenant,
  addUser,
  at,
  contextOf,
  dayOffset,
  freshPhone,
  passwordHasher,
  type Harness,
} from './leases';

/**
 * Réglages d'un appel : instant fixe.
 *
 * Indispensable dans ce lot plus qu'ailleurs : la période en cours, le retard et
 * « À venir » dépendent tous de la date du jour. Sans instant fixe, la moitié des
 * assertions changeraient de verdict selon le mois où les tests tournent.
 */
export const OPTIONS: RentServiceOptions = { now: NOW };

/** Période en cours à l'instant de référence des tests : octobre 2026. */
export const PERIOD = `${TODAY.slice(0, 7)}-01`;

/** Loyer de référence des situations de test, en francs guinéens (DEC-014). */
export const RENT_AMOUNT = 2_500_000;

/**
 * Crée un bail ACTIF prêt à être facturé, avec son logement et sa locataire.
 *
 * Passe par `createLease`, c'est-à-dire par le vrai chemin : un bail inséré à la
 * main ne prouverait pas que la génération lit ce que le Lot 8 produit
 * réellement.
 */
export async function addBillableLease(
  harness: Harness,
  values: {
    apartmentId: string;
    tenantApartmentId: string;
    ownerContext: Parameters<typeof createLease>[1];
    hashPassword: (password: string) => Promise<string>;
    phone: string;
    startDate?: string;
    endDate?: string | null;
    dueDay?: number;
    rentAmount?: number;
  },
): Promise<{ leaseId: string; tenantUserId: string; apartmentId: string }> {
  const tenant = await addTenant(harness, {
    apartmentId: values.tenantApartmentId,
    phone: values.phone,
    ownerContext: values.ownerContext,
    hashPassword: values.hashPassword,
  });

  const lease = await createLease(
    harness.db,
    values.ownerContext,
    {
      apartmentId: values.apartmentId,
      tenantId: tenant.userId,
      startDate: values.startDate ?? TODAY,
      endDate: values.endDate ?? '',
      rentAmount: values.rentAmount ?? RENT_AMOUNT,
      currency: 'GNF',
      dueDay: values.dueDay ?? 5,
    },
    LEASE_OPTIONS,
  );

  return { leaseId: lease.id, tenantUserId: tenant.userId, apartmentId: values.apartmentId };
}

/** Échéances d'un bail, relues en base, de la plus ancienne à la plus récente. */
export async function installmentsOfLease(harness: Harness, leaseId: string) {
  return harness.db
    .select()
    .from(harness.schema.rentInstallments)
    .where(eq(harness.schema.rentInstallments.leaseId, leaseId))
    .orderBy(harness.schema.rentInstallments.periodStart);
}

/** Échéance d'un bail pour une période, ou `undefined`. */
export async function installmentOf(harness: Harness, leaseId: string, period: string) {
  const [row] = await harness.db
    .select()
    .from(harness.schema.rentInstallments)
    .where(
      and(
        eq(harness.schema.rentInstallments.leaseId, leaseId),
        eq(harness.schema.rentInstallments.periodStart, period),
      ),
    );

  return row;
}

/**
 * Force l'état financier d'une échéance, sans passer par un paiement.
 *
 * Les paiements n'existent qu'au Lot 11, et les tests de ce lot doivent pourtant
 * éprouver `PARTIALLY_PAID` et `PAID` : la liste les affiche, le total dû les
 * écarte, et le job de retard ne doit jamais toucher une créance soldée.
 * L'écriture est donc directe ET cohérente avec les contraintes de la base, qui
 * refuse un solde qui ne serait pas la différence des deux montants.
 */
export async function setPaid(
  harness: Harness,
  installmentId: string,
  amountPaid: number,
  status: 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED',
) {
  const [row] = await harness.db
    .select()
    .from(harness.schema.rentInstallments)
    .where(eq(harness.schema.rentInstallments.id, installmentId));

  if (!row) throw new Error(`Échéance ${installmentId} introuvable.`);

  await harness.db
    .update(harness.schema.rentInstallments)
    .set({ amountPaid, balance: row.amountDue - amountPaid, status })
    .where(eq(harness.schema.rentInstallments.id, installmentId));
}
