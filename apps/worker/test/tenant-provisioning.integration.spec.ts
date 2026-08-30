import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NestFactory } from "@nestjs/core";
import type { INestApplicationContext } from "@nestjs/common";
import { FileMigrationProvider, Migrator } from "kysely/migration";
import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from "testcontainers";
import {
  bootstrapDatabaseRoles,
  closeKysely,
  createKysely,
  databaseRoleNames,
  grantRuntimePrivileges,
  withTenantTransaction,
} from "@saas/database";
import type {
  WorkerAdminDatabase,
  WorkerTenantDatabase,
} from "../src/database.js";

const runtimePassword = "runtime-worker-test-password-at-least-32-characters";
const migratorPassword = "migrator-worker-test-password-at-least-32-characters";
const provisionerPassword =
  "provisioner-worker-test-password-at-least-32-characters";
const tenantId = "20000000-0000-4000-8000-000000000001";
const identityId = "30000000-0000-4000-8000-000000000001";

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

function databaseUrl(connectionString: string, databaseName: string): string {
  const url = new URL(connectionString);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

async function waitForTenantStatus(
  database: ReturnType<typeof createKysely<WorkerAdminDatabase>>,
  status: "pending_admin" | "active",
): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const tenant = await database
      .selectFrom("tenants")
      .select(["status"])
      .where("id", "=", tenantId)
      .executeTakeFirst();
    if (tenant?.status === status) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const tenant = await database
    .selectFrom("tenants")
    .select(["status", "provisioning_status", "last_error_code"])
    .where("id", "=", tenantId)
    .executeTakeFirst();
  const attempt = await database
    .selectFrom("tenant_provisioning_attempts")
    .select(["status", "attempt", "error_code", "error_detail"])
    .where("tenant_id", "=", tenantId)
    .orderBy("created_at", "desc")
    .executeTakeFirst();
  throw new Error(
    `Tenant did not reach ${status}: ${JSON.stringify({ tenant, attempt })}`,
  );
}

describe("tenant provisioning worker", () => {
  let postgres: StartedTestContainer;
  let redis: StartedTestContainer;
  let app: INestApplicationContext;
  let adminDatabase: ReturnType<typeof createKysely<WorkerAdminDatabase>>;
  let runtimeUrl: string;

  beforeAll(async () => {
    postgres = await new GenericContainer("postgres:18.4")
      .withEnvironment({
        POSTGRES_USER: "postgres",
        POSTGRES_PASSWORD: "postgres-test-password",
        POSTGRES_DB: "saas_admin",
      })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forListeningPorts())
      .start();
    redis = await new GenericContainer("redis:7.4-alpine")
      .withExposedPorts(6379)
      .withWaitStrategy(Wait.forListeningPorts())
      .start();

    const adminUrl = `postgres://postgres:postgres-test-password@${postgres.getHost()}:${String(postgres.getMappedPort(5432))}/saas_admin`;
    await bootstrapDatabaseRoles({
      adminConnectionString: adminUrl,
      runtimePassword,
      migratorPassword,
      provisionerPassword,
    });
    const migrationUrl = connectionFor(
      adminUrl,
      databaseRoleNames.migrator,
      migratorPassword,
    );
    const migrationDatabase = createKysely<WorkerAdminDatabase>({
      connectionString: migrationUrl,
    });
    const migrator = new Migrator({
      db: migrationDatabase,
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
    const migrated = await migrator.migrateToLatest();
    if (migrated.error) {
      throw new Error("Admin migrations failed", { cause: migrated.error });
    }
    await grantRuntimePrivileges(migrationDatabase);
    await closeKysely(migrationDatabase);

    runtimeUrl = connectionFor(
      adminUrl,
      databaseRoleNames.runtime,
      runtimePassword,
    );
    const provisionerUrl = connectionFor(
      adminUrl,
      databaseRoleNames.provisioner,
      provisionerPassword,
    );
    adminDatabase = createKysely<WorkerAdminDatabase>({
      connectionString: runtimeUrl,
    });

    await adminDatabase.transaction().execute(async (transaction) => {
      await transaction
        .insertInto("plans")
        .values({
          id: "12000000-0000-4000-8000-000000000001",
          name: "Professional",
          slug: "professional",
          status: "active",
          trial_days: 14,
        })
        .execute();
      await transaction
        .insertInto("plan_prices")
        .values({
          id: "13000000-0000-4000-8000-000000000001",
          plan_id: "12000000-0000-4000-8000-000000000001",
          currency: "BRL",
          billing_interval: "monthly",
          amount_cents: "19900",
        })
        .execute();
      await transaction
        .insertInto("tenants")
        .values({
          id: tenantId,
          name: "Tenant A",
          slug: "tenant-a",
          legal_name: "Tenant A Ltda",
          trade_name: "Tenant A",
          tax_id: "12345678000195",
          contact_email: "admin@tenant-a.test",
          database_name: null,
          database_host: null,
          status: "provisioning",
          plan: "professional",
          plan_id: "12000000-0000-4000-8000-000000000001",
          provisioning_status: "queued",
          created_by_identity_id: null,
        })
        .execute();
      await transaction
        .insertInto("subscriptions")
        .values({
          tenant_id: tenantId,
          plan_id: "12000000-0000-4000-8000-000000000001",
          plan_price_id: "13000000-0000-4000-8000-000000000001",
          status: "pending",
          currency: "BRL",
          billing_interval: "monthly",
          amount_cents: "19900",
          current_period_start: new Date(),
          current_period_end: new Date(Date.now() + 30 * 86_400_000),
          trial_ends_at: new Date(Date.now() + 14 * 86_400_000),
        })
        .execute();
      await transaction
        .insertInto("platform_outbox")
        .values({
          aggregate_type: "Tenant",
          aggregate_id: tenantId,
          event_type: "tenant.provisioning.requested",
          payload: { tenantId },
        })
        .execute();
    });

    process.env["NODE_ENV"] = "test";
    process.env["LOG_LEVEL"] = "error";
    process.env["DATABASE_URL"] = runtimeUrl;
    process.env["MIGRATION_DATABASE_URL"] = migrationUrl;
    process.env["TENANT_PROVISIONER_DATABASE_URL"] = provisionerUrl;
    process.env["REDIS_URL"] =
      `redis://${redis.getHost()}:${String(redis.getMappedPort(6379))}`;
    process.env["WORKER_CONCURRENCY"] = "1";
    process.env["OTEL_ENABLED"] = "false";

    const { WorkerModule } = await import("../src/worker.module.js");
    app = await NestFactory.createApplicationContext(WorkerModule, {
      logger: false,
    });
  });

  afterAll(async () => {
    await app.close();
    await closeKysely(adminDatabase);
    await Promise.all([postgres.stop(), redis.stop()]);
  });

  it("provisions a tenant database and activates its initial administrator", async () => {
    await waitForTenantStatus(adminDatabase, "pending_admin");
    const tenant = await adminDatabase
      .selectFrom("tenants")
      .select(["database_name", "provisioning_status"])
      .where("id", "=", tenantId)
      .executeTakeFirstOrThrow();
    expect(tenant.provisioning_status).toBe("completed");
    expect(tenant.database_name).toBe(
      "tenant_20000000000040008000000000000001",
    );

    await adminDatabase.transaction().execute(async (transaction) => {
      await transaction
        .insertInto("identities")
        .values({
          id: identityId,
          email: "admin@tenant-a.test",
          display_name: "Tenant Administrator",
          normalized_email: "admin@tenant-a.test",
          password_hash: "$argon2id$test",
          realm: "tenant",
          tenant_id: tenantId,
          status: "pending",
        })
        .execute();
      await transaction
        .insertInto("platform_outbox")
        .values({
          aggregate_type: "Tenant",
          aggregate_id: tenantId,
          event_type: "tenant.admin.provisioning.requested",
          payload: { tenantId, identityId },
        })
        .execute();
    });

    await waitForTenantStatus(adminDatabase, "active");
    const tenantDatabaseName = tenant.database_name;
    if (!tenantDatabaseName) throw new Error("Tenant database name is missing");
    const tenantDatabase = createKysely<WorkerTenantDatabase>({
      connectionString: databaseUrl(runtimeUrl, tenantDatabaseName),
    });
    try {
      await withTenantTransaction(
        tenantDatabase,
        tenantId,
        async (transaction) => {
          const user = await transaction
            .selectFrom("users")
            .select(["identity_id", "display_name"])
            .where("identity_id", "=", identityId)
            .executeTakeFirstOrThrow();
          const permissions = await transaction
            .selectFrom("role_permissions")
            .innerJoin("permissions", (join) =>
              join
                .onRef("permissions.id", "=", "role_permissions.permission_id")
                .onRef(
                  "permissions.tenant_id",
                  "=",
                  "role_permissions.tenant_id",
                ),
            )
            .select("permissions.key")
            .execute();
          expect(user.display_name).toBe("Tenant Administrator");
          expect(user.identity_id).toBe(identityId);
          expect(permissions.map((permission) => permission.key)).toContain(
            "company:update",
          );
        },
      );
    } finally {
      await closeKysely(tenantDatabase);
    }

    const subscription = await adminDatabase
      .selectFrom("subscriptions")
      .select("status")
      .where("tenant_id", "=", tenantId)
      .executeTakeFirstOrThrow();
    expect(subscription.status).toBe("trialing");
  });
});
