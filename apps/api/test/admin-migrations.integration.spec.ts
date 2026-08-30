import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FileMigrationProvider, Migrator } from "kysely/migration";
import { sql, type Kysely } from "kysely";
import {
  bootstrapDatabaseRoles,
  closeKysely,
  createKysely,
  databaseRoleNames,
  grantRuntimePrivileges,
} from "@saas/database";
import { setup, teardown } from "./setup-integration.js";

const runtimePassword = "runtime-admin-migration-test-password-32-chars";
const migratorPassword = "migrator-admin-migration-test-password-32-chars";
const provisionerPassword =
  "provisioner-admin-migration-test-password-32-chars";

function migratorConnection(connectionString: string): string {
  const url = new URL(connectionString);
  url.username = databaseRoleNames.migrator;
  url.password = migratorPassword;
  return url.toString();
}

describe("admin catalog migrations", () => {
  let db: Kysely<unknown>;
  let migrator: Migrator;

  beforeAll(async () => {
    await setup();
    const adminConnectionString = process.env.DATABASE_URL!;
    await bootstrapDatabaseRoles({
      adminConnectionString,
      runtimePassword,
      migratorPassword,
      provisionerPassword,
    });
    db = createKysely<unknown>({
      connectionString: migratorConnection(adminConnectionString),
    });
    migrator = new Migrator({
      db,
      provider: new FileMigrationProvider({
        fs,
        path,
        migrationFolder: path.resolve(
          import.meta.dirname,
          "../../../database/migrations/admin",
        ),
        import: async (filePath): Promise<unknown> =>
          (await import(pathToFileURL(filePath).href)) as unknown,
      }),
    });
  });

  afterAll(async () => {
    if (db) await closeKysely(db);
    await teardown();
  });

  it("runs zero-to-latest, enforces constraints, rolls down, and reapplies", async () => {
    const firstUp = await migrator.migrateToLatest();
    expect(firstUp.error).toBeUndefined();
    expect(firstUp.results?.at(-1)?.migrationName).toBe(
      "008_add_reporting_indexes",
    );
    await grantRuntimePrivileges(db);
    const runtimePrivileges = await sql<{ allowed: boolean }>`
      SELECT has_table_privilege('blupo_app', 'public.plans', 'SELECT') AS allowed
    `.execute(db);
    expect(runtimePrivileges.rows[0]?.allowed).toBe(true);
    const auditPrivileges = await sql<{
      canInsert: boolean;
      canUpdate: boolean;
      canDelete: boolean;
    }>`
      SELECT
        has_table_privilege('blupo_app', 'public.platform_audit_logs', 'INSERT') AS "canInsert",
        has_table_privilege('blupo_app', 'public.platform_audit_logs', 'UPDATE') AS "canUpdate",
        has_table_privilege('blupo_app', 'public.platform_audit_logs', 'DELETE') AS "canDelete"
    `.execute(db);
    expect(auditPrivileges.rows[0]).toEqual({
      canInsert: true,
      canUpdate: false,
      canDelete: false,
    });

    await sql`
      INSERT INTO plans (id, name, slug, status)
      VALUES ('10000000-0000-4000-8000-000000000001', 'Professional', 'professional', 'active');

      INSERT INTO plan_prices (
        id, plan_id, currency, billing_interval, amount_cents, effective_from
      ) VALUES (
        '10000000-0000-4000-8000-000000000002',
        '10000000-0000-4000-8000-000000000001',
        'BRL',
        'monthly',
        19900,
        now()
      );

      INSERT INTO tenants (
        id, name, slug, database_name, database_host, status, plan, plan_id,
        provisioning_status
      ) VALUES (
        '20000000-0000-4000-8000-000000000001',
        'Tenant A',
        'tenant-a',
        'tenant_20000000000040008000000000000001',
        'postgres',
        'active',
        'professional',
        '10000000-0000-4000-8000-000000000001',
        'completed'
      );

      INSERT INTO identities (
        id, email, normalized_email, password_hash, realm, status,
        must_change_password, mfa_required
      ) VALUES (
        '30000000-0000-4000-8000-000000000001',
        'owner@blupo.com.br',
        'owner@blupo.com.br',
        '$argon2id$test',
        'platform',
        'active',
        false,
        true
      );

      INSERT INTO platform_roles (id, name, slug, reserved)
      VALUES (
        '31000000-0000-4000-8000-000000000001',
        'Platform Owner',
        'platform_owner',
        true
      );

      INSERT INTO platform_permissions (id, key, description)
      VALUES (
        '32000000-0000-4000-8000-000000000001',
        'platform:dashboard:read',
        'Read the platform dashboard'
      );

      INSERT INTO platform_identity_roles (identity_id, role_id)
      VALUES (
        '30000000-0000-4000-8000-000000000001',
        '31000000-0000-4000-8000-000000000001'
      );

      INSERT INTO platform_role_permissions (role_id, permission_id)
      VALUES (
        '31000000-0000-4000-8000-000000000001',
        '32000000-0000-4000-8000-000000000001'
      );

      INSERT INTO subscriptions (
        id, tenant_id, plan_id, plan_price_id, status, currency,
        billing_interval, amount_cents, current_period_start,
        current_period_end
      ) VALUES (
        '40000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000002',
        'active',
        'BRL',
        'monthly',
        19900,
        now(),
        now() + interval '1 month'
      );

      INSERT INTO invoices (
        id, tenant_id, subscription_id, number, status, currency,
        subtotal_cents, discount_cents, tax_cents, total_cents, due_date
      ) VALUES (
        '50000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        '40000000-0000-4000-8000-000000000001',
        'INV-000001',
        'open',
        'BRL',
        19900,
        0,
        0,
        19900,
        current_date + 7
      );

      INSERT INTO invoice_items (
        id, invoice_id, description, quantity, unit_amount_cents, total_cents
      ) VALUES (
        '50000000-0000-4000-8000-000000000002',
        '50000000-0000-4000-8000-000000000001',
        'Professional monthly plan',
        1,
        19900,
        19900
      );

      INSERT INTO payments (
        id, tenant_id, invoice_id, method, status, currency, amount_cents,
        provider, external_reference, paid_at
      ) VALUES (
        '60000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000001',
        '50000000-0000-4000-8000-000000000001',
        'manual',
        'paid',
        'BRL',
        19900,
        'bank_transfer',
        'TXN-000001',
        now()
      )
    `.execute(db);

    await sql`
      INSERT INTO tenants (
        id, name, slug, database_name, database_host, status, plan, plan_id,
        provisioning_status
      ) VALUES (
        '20000000-0000-4000-8000-000000000002',
        'Tenant B',
        'tenant-b',
        'tenant_20000000000040008000000000000002',
        'postgres',
        'active',
        'professional',
        '10000000-0000-4000-8000-000000000001',
        'completed'
      );

      INSERT INTO subscriptions (
        id, tenant_id, plan_id, plan_price_id, status, currency,
        billing_interval, amount_cents, current_period_start,
        current_period_end
      ) VALUES (
        '40000000-0000-4000-8000-000000000002',
        '20000000-0000-4000-8000-000000000002',
        '10000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000002',
        'active',
        'BRL',
        'monthly',
        19900,
        now(),
        now() + interval '1 month'
      );

      INSERT INTO invoices (
        id, tenant_id, subscription_id, number, status, currency,
        subtotal_cents, discount_cents, tax_cents, total_cents, due_date
      ) VALUES (
        '50000000-0000-4000-8000-000000000002',
        '20000000-0000-4000-8000-000000000002',
        '40000000-0000-4000-8000-000000000002',
        'INV-000002',
        'open',
        'BRL',
        19900,
        0,
        0,
        19900,
        current_date + 7
      );

      INSERT INTO payments (
        id, tenant_id, invoice_id, method, status, currency, amount_cents,
        provider, external_reference, paid_at
      ) VALUES (
        '60000000-0000-4000-8000-000000000002',
        '20000000-0000-4000-8000-000000000002',
        '50000000-0000-4000-8000-000000000002',
        'manual',
        'paid',
        'BRL',
        19900,
        'bank_transfer',
        'TXN-000001',
        now()
      )
    `.execute(db);

    await expect(
      sql`
        INSERT INTO payments (
          id, tenant_id, invoice_id, method, status, currency, amount_cents,
          provider, external_reference, paid_at
        ) VALUES (
          '60000000-0000-4000-8000-000000000003',
          '20000000-0000-4000-8000-000000000001',
          '50000000-0000-4000-8000-000000000001',
          'manual',
          'paid',
          'BRL',
          19900,
          'bank_transfer',
          'TXN-000001',
          now()
        )
      `.execute(db),
    ).rejects.toThrow(/uq_payments_tenant_provider_reference/iu);

    await expect(
      sql`
        INSERT INTO identities (
          email, normalized_email, password_hash, realm, status
        ) VALUES (
          'duplicate@blupo.com.br',
          'owner@blupo.com.br',
          '$argon2id$test',
          'platform',
          'active'
        )
      `.execute(db),
    ).rejects.toThrow();

    await expect(
      sql`
        INSERT INTO invoices (
          tenant_id, subscription_id, number, status, currency,
          subtotal_cents, discount_cents, tax_cents, total_cents, due_date
        ) VALUES (
          '20000000-0000-4000-8000-000000000001',
          '40000000-0000-4000-8000-000000000001',
          'INV-INVALID',
          'open',
          'BRL',
          1000,
          0,
          0,
          999,
          current_date
        )
      `.execute(db),
    ).rejects.toThrow();

    const downNames: string[] = [];
    for (let index = 0; index < 8; index += 1) {
      const down = await migrator.migrateDown();
      expect(down.error).toBeUndefined();
      const name = down.results?.[0]?.migrationName;
      if (name) downNames.push(name);
    }
    expect(downNames).toEqual([
      "008_add_reporting_indexes",
      "007_create_platform_authorization",
      "006_create_billing_records",
      "005_expand_tenants_and_subscriptions",
      "004_create_plans",
      "003_create_platform_infrastructure",
      "002_create_identities",
      "001_create_tenants",
    ]);

    const tenantTable = await sql<{ table_name: string | null }>`
      SELECT to_regclass('public.tenants')::text AS table_name
    `.execute(db);
    expect(tenantTable.rows[0]?.table_name).toBeNull();

    const secondUp = await migrator.migrateToLatest();
    expect(secondUp.error).toBeUndefined();
    expect(secondUp.results).toHaveLength(8);
  });

  it("blocks migration 005 rollback while a tenant is still provisioning", async () => {
    const tenantId = "20000000-0000-4000-8000-000000000099";
    await sql`
      INSERT INTO tenants (
        id, name, slug, status, plan, provisioning_status,
        database_name, database_host
      ) VALUES (
        ${tenantId}, 'Provisioning Tenant', 'provisioning-tenant',
        'provisioning', 'professional', 'running', NULL, NULL
      )
    `.execute(db);

    for (let index = 0; index < 3; index += 1) {
      const down = await migrator.migrateDown();
      expect(down.error).toBeUndefined();
    }
    const blocked = await migrator.migrateDown();
    expect(blocked.error).toBeInstanceOf(Error);
    expect(String(blocked.error)).toContain(
      "provisioning-state tenants are active",
    );

    await db.deleteFrom("tenants").where("id", "=", tenantId).execute();
    const restored = await migrator.migrateToLatest();
    expect(restored.error).toBeUndefined();
    expect(restored.results).toHaveLength(3);
  });
});
