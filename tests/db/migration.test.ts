import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import journal from '../../src/db/migrations/meta/_journal.json';
import { createTestDatabase, type TestDatabase } from '../helpers/database';

/**
 * MVP-BACKLOG-007 : la migration initiale doit s'appliquer sur une base vierge.
 *
 * Ces tests ne simulent rien. PGlite est un vrai PostgreSQL, la migration
 * appliquée est celle de `src/db/migrations`, et les contraintes vérifiées sont
 * celles que la production appliquera.
 */
describe('Migration initiale', () => {
  let harness: TestDatabase;

  beforeAll(async () => {
    harness = await createTestDatabase();
  }, 60_000);

  afterAll(async () => {
    await harness?.close();
  });

  it("s'applique sur une base vierge", async () => {
    const rows = await harness.db.execute<{ table_name: string }>(sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      order by table_name
    `);

    const tables = rows.rows.map((row) => row.table_name);

    expect(tables).toEqual(
      expect.arrayContaining([
        'apartments',
        'invitation_properties',
        'invitations',
        'leases',
        'manager_property_access',
        'organizations',
        'properties',
        'user_access',
        'users',
      ]),
    );
  });

  it('ne crée aucune table hors périmètre du Lot 1', async () => {
    const rows = await harness.db.execute<{ table_name: string }>(sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
    `);

    const tables = rows.rows.map((row) => row.table_name);

    // Tables explicitement écartées du MVP, à ne jamais voir apparaître.
    expect(tables).not.toContain('roles'); // le rôle est un enum (DEC-021)
    expect(tables).not.toContain('permissions'); // DEC-025
    expect(tables).not.toContain('access_permissions'); // DEC-025
  });

  it('crée les 19 énumérations du MVP', async () => {
    const rows = await harness.db.execute<{ typname: string }>(sql`
      select t.typname
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
      where t.typtype = 'e' and n.nspname = 'public'
      order by t.typname
    `);

    const enums = rows.rows.map((row) => row.typname);

    expect(enums).toEqual([
      'access_level',
      'allocation_method',
      'apartment_status',
      'charge_status',
      'expense_status',
      'incident_priority',
      'incident_status',
      'intervention_status',
      'invitation_status',
      'lease_status',
      'notification_channel',
      'notification_status',
      'organization_type',
      'payment_method',
      'payment_status',
      'receivable_status',
      'role',
      'user_access_status',
      'user_status',
    ]);
  });

  it("n'expose ni rent_status ni property_status", async () => {
    // Deux noms que la documentation a explicitement bannis : les créances de
    // loyer utilisent receivable_status, et l'archivage d'un immeuble est porté
    // par archived_at (DEC-020).
    const rows = await harness.db.execute<{ typname: string }>(sql`
      select typname from pg_type where typname in ('rent_status', 'property_status')
    `);

    expect(rows.rows).toHaveLength(0);
  });

  it("ne contient aucune valeur d'énumération ARCHIVED", async () => {
    // L'archivage est un horodatage, jamais un statut (DEC-020).
    const rows = await harness.db.execute<{ enumlabel: string }>(sql`
      select enumlabel from pg_enum where enumlabel = 'ARCHIVED'
    `);

    expect(rows.rows).toHaveLength(0);
  });

  it('crée les valeurs attendues du cycle de créance partagé', async () => {
    // Un seul cycle pour les créances de loyer ET de charge (DEC-005, DEC-015).
    const rows = await harness.db.execute<{ enumlabel: string }>(sql`
      select e.enumlabel
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'receivable_status'
      order by e.enumsortorder
    `);

    expect(rows.rows.map((row) => row.enumlabel)).toEqual([
      'UNPAID',
      'PARTIALLY_PAID',
      'PAID',
      'OVERDUE',
      'CANCELLED',
    ]);
  });

  it('applique chaque migration une seule fois', async () => {
    // La table de suivi doit contenir exactement une ligne par migration du
    // journal. Figer le nombre à la main rendrait ce test faux au lot suivant,
    // alors que ce qu'il vérifie est l'absence de double application.
    const rows = await harness.db.execute<{ count: string }>(sql`
      select count(*)::text as count from drizzle.__drizzle_migrations
    `);

    expect(Number(rows.rows[0]?.count)).toBe(journal.entries.length);
  });
});
