import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql, type Kysely } from "kysely";
import {
  bootstrapDatabaseRoles,
  closeKysely,
  createKysely,
  databaseRoleNames,
  grantRuntimePrivileges,
  withTenantTransaction,
} from "@saas/database";
import { setup, teardown } from "./setup-integration.js";

interface TenantNotesDatabase {
  tenant_notes: {
    id: string;
    tenant_id: string;
    content: string;
  };
}

const runtimePassword = "runtime-test-password-at-least-32-characters";
const migratorPassword = "migrator-test-password-at-least-32-characters";
const provisionerPassword = "provisioner-test-password-at-least-32-characters";
const tenantA = "11111111-1111-4111-8111-111111111111";
const tenantB = "22222222-2222-4222-8222-222222222222";

function connectionFor(
  connectionString: string,
  username: string,
  password: string,
): string {
  const url = new URL(connectionString);
  url.username = username;
  url.password = password;
  return url.toString();
}

describe("PostgreSQL runtime role and RLS", () => {
  let adminDb: Kysely<TenantNotesDatabase>;
  let migratorDb: Kysely<TenantNotesDatabase>;
  let runtimeDb: Kysely<TenantNotesDatabase>;

  beforeAll(async () => {
    await setup();
    const adminConnectionString = process.env.DATABASE_URL!;

    await bootstrapDatabaseRoles({
      adminConnectionString,
      runtimePassword,
      migratorPassword,
      provisionerPassword,
    });

    adminDb = createKysely<TenantNotesDatabase>({
      connectionString: adminConnectionString,
    });
    migratorDb = createKysely<TenantNotesDatabase>({
      connectionString: connectionFor(
        adminConnectionString,
        databaseRoleNames.migrator,
        migratorPassword,
      ),
    });
    runtimeDb = createKysely<TenantNotesDatabase>({
      connectionString: connectionFor(
        adminConnectionString,
        databaseRoleNames.runtime,
        runtimePassword,
      ),
    });

    await migratorDb.schema
      .createTable("tenant_notes")
      .addColumn("id", "uuid", (column) => column.primaryKey())
      .addColumn("tenant_id", "uuid", (column) => column.notNull())
      .addColumn("content", "text", (column) => column.notNull())
      .execute();
    await sql`ALTER TABLE tenant_notes ENABLE ROW LEVEL SECURITY`.execute(
      migratorDb,
    );
    await sql`ALTER TABLE tenant_notes FORCE ROW LEVEL SECURITY`.execute(
      migratorDb,
    );
    await sql`
      CREATE POLICY tenant_notes_isolation ON tenant_notes
      USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid)
    `.execute(migratorDb);
    await grantRuntimePrivileges(migratorDb);

    await adminDb
      .insertInto("tenant_notes")
      .values([
        {
          id: "aaaaaaaa-1111-4111-8111-111111111111",
          tenant_id: tenantA,
          content: "Tenant A",
        },
        {
          id: "bbbbbbbb-2222-4222-8222-222222222222",
          tenant_id: tenantB,
          content: "Tenant B",
        },
      ])
      .execute();
  });

  afterAll(async () => {
    if (runtimeDb) await closeKysely(runtimeDb);
    if (migratorDb) await closeKysely(migratorDb);
    if (adminDb) await closeKysely(adminDb);
    await teardown();
  });

  it("uses a non-owner role that cannot bypass RLS", async () => {
    const role = await sql<{
      rolsuper: boolean;
      rolbypassrls: boolean;
      rolcreatedb: boolean;
    }>`
      SELECT rolsuper, rolbypassrls, rolcreatedb
      FROM pg_roles
      WHERE rolname = ${databaseRoleNames.runtime}
    `.execute(adminDb);
    const owner = await sql<{ tableowner: string }>`
      SELECT tableowner
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename = 'tenant_notes'
    `.execute(adminDb);

    expect(role.rows[0]).toEqual({
      rolsuper: false,
      rolbypassrls: false,
      rolcreatedb: false,
    });
    expect(owner.rows[0]?.tableowner).toBe(databaseRoleNames.migrator);
  });

  it("denies cross-tenant reads and mutations with the runtime role", async () => {
    await withTenantTransaction(runtimeDb, tenantA, async (transaction) => {
      const visible = await transaction
        .selectFrom("tenant_notes")
        .selectAll()
        .execute();
      expect(visible).toHaveLength(1);
      expect(visible[0]?.tenant_id).toBe(tenantA);

      const updated = await transaction
        .updateTable("tenant_notes")
        .set({ content: "compromised" })
        .where("tenant_id", "=", tenantB)
        .executeTakeFirst();
      expect(Number(updated.numUpdatedRows)).toBe(0);

      const deleted = await transaction
        .deleteFrom("tenant_notes")
        .where("tenant_id", "=", tenantB)
        .executeTakeFirst();
      expect(Number(deleted.numDeletedRows)).toBe(0);

      await expect(
        transaction
          .insertInto("tenant_notes")
          .values({
            id: "cccccccc-3333-4333-8333-333333333333",
            tenant_id: tenantB,
            content: "blocked",
          })
          .execute(),
      ).rejects.toThrow();
    });
  });
});
