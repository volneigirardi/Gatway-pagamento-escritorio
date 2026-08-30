import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FileMigrationProvider, Migrator } from "kysely/migration";
import { sql, type Kysely } from "kysely";
import { closeKysely, createKysely, type Database } from "@saas/database";
import { KyselyOutboxPublisher, type OutboxDatabase } from "@saas/outbox";
import { setup, teardown } from "./setup-integration.js";

interface MigrationTestDatabase extends Database {
  outbox: Database["outbox"];
}

describe("tenant migrations", () => {
  let db: Kysely<MigrationTestDatabase>;
  let migrator: Migrator;

  beforeAll(async () => {
    await setup();
    db = createKysely<MigrationTestDatabase>({
      connectionString: process.env.DATABASE_URL!,
    });
    migrator = new Migrator({
      db,
      provider: new FileMigrationProvider({
        fs,
        path,
        migrationFolder: path.resolve(
          import.meta.dirname,
          "../../../database/migrations/tenant",
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

  it("runs zero-to-latest, down, and up with an aligned outbox schema", async () => {
    const firstUp = await migrator.migrateToLatest();
    expect(firstUp.error).toBeUndefined();
    expect(firstUp.results?.at(-1)?.migrationName).toBe(
      "007_create_tenant_authorization",
    );

    const columnsAfterUp = await sql<{
      column_name: string;
      column_default: string | null;
    }>`
      SELECT column_name, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'outbox'
        AND column_name IN ('type', 'event_type', 'event_version')
      ORDER BY column_name
    `.execute(db);
    expect(columnsAfterUp.rows.map((row) => row.column_name)).toEqual([
      "event_version",
      "type",
    ]);
    expect(columnsAfterUp.rows[0]?.column_default).toContain("v1");

    const publisher = new KyselyOutboxPublisher();
    await publisher.publish(db as unknown as Kysely<OutboxDatabase>, {
      tenantId: "11111111-1111-4111-8111-111111111111",
      aggregateType: "Tenant",
      aggregateId: "aaaaaaaa-1111-4111-8111-111111111111",
      type: "tenant.created",
      payload: { name: "Tenant A" },
      metadata: {},
    });
    const event = await db
      .selectFrom("outbox")
      .select(["type", "event_version"])
      .executeTakeFirstOrThrow();
    expect(event).toEqual({ type: "tenant.created", event_version: "v1" });

    const forcedRls = await sql<{ count: number }>`
      SELECT count(*)::int AS count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN (
          'users', 'roles', 'permissions', 'user_roles',
          'role_permissions', 'company_settings'
        )
        AND c.relrowsecurity
        AND c.relforcerowsecurity
    `.execute(db);
    expect(forcedRls.rows[0]?.count).toBe(6);

    await sql`
      INSERT INTO users (
        id, tenant_id, identity_id, email, normalized_email, display_name
      ) VALUES
        (
          '70000000-0000-4000-8000-000000000001',
          '11111111-1111-4111-8111-111111111111',
          '71000000-0000-4000-8000-000000000001',
          'admin-a@example.com',
          'admin-a@example.com',
          'Admin A'
        );
      INSERT INTO roles (id, tenant_id, name, slug)
      VALUES (
        '72000000-0000-4000-8000-000000000001',
        '22222222-2222-4222-8222-222222222222',
        'Tenant B Admin',
        'tenant_b_admin'
      )
    `.execute(db);

    await expect(
      sql`
        INSERT INTO user_roles (tenant_id, user_id, role_id)
        VALUES (
          '11111111-1111-4111-8111-111111111111',
          '70000000-0000-4000-8000-000000000001',
          '72000000-0000-4000-8000-000000000001'
        )
      `.execute(db),
    ).rejects.toThrow();

    const authorizationDown = await migrator.migrateDown();
    expect(authorizationDown.error).toBeUndefined();
    expect(authorizationDown.results?.[0]?.migrationName).toBe(
      "007_create_tenant_authorization",
    );

    const outboxDown = await migrator.migrateDown();
    expect(outboxDown.error).toBeUndefined();
    expect(outboxDown.results?.[0]?.migrationName).toBe(
      "006_align_outbox_schema",
    );

    const columnsAfterDown = await sql<{ column_name: string }>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'outbox'
        AND column_name IN ('type', 'event_type')
    `.execute(db);
    expect(columnsAfterDown.rows).toEqual([{ column_name: "event_type" }]);

    const secondUp = await migrator.migrateToLatest();
    expect(secondUp.error).toBeUndefined();
    expect(secondUp.results?.map((result) => result.migrationName)).toEqual([
      "006_align_outbox_schema",
      "007_create_tenant_authorization",
    ]);
  });
});
