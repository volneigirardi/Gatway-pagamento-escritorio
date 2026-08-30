import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConfigService } from "@nestjs/config";
import type { AuthenticatedUser } from "@saas/auth";
import { FileMigrationProvider, Migrator } from "kysely/migration";
import { sql } from "kysely";
import {
  bootstrapDatabaseRoles,
  closeKysely,
  createKysely,
  databaseRoleNames,
  grantRuntimePrivileges,
  withTenantTransaction,
} from "@saas/database";
import { AdminDatabaseService } from "../src/common/database.module.js";
import { TenantDatabaseManager } from "../src/common/tenant-database.manager.js";
import type { TenantDatabase } from "../src/common/tenant-database.js";
import { TenantAuthorizationService } from "../src/modules/auth/tenant-authorization.service.js";
import { TenantPortalService } from "../src/modules/tenant-portal/tenant-portal.service.js";
import { setup, teardown } from "./setup-integration.js";

const runtimePassword = "runtime-tenant-auth-test-password-at-least-32-chars";
const migratorPassword = "migrator-tenant-auth-test-password-at-least-32-chars";
const provisionerPassword =
  "provisioner-tenant-auth-test-password-at-least-32-chars";
const tenantId = "20000000-0000-4000-8000-000000000001";
const otherTenantId = "20000000-0000-4000-8000-000000000002";
const identityId = "30000000-0000-4000-8000-000000000001";
const tenantDatabaseName = "tenant_20000000000040008000000000000001";

function connectionFor(
  connectionString: string,
  username: string,
  password: string,
  databaseName?: string,
): string {
  const url = new URL(connectionString);
  url.username = username;
  url.password = password;
  if (databaseName) url.pathname = `/${databaseName}`;
  return url.toString();
}

describe("tenant authorization resolver", () => {
  let manager: TenantDatabaseManager;
  let adminDatabase: AdminDatabaseService;
  let service: TenantAuthorizationService;
  let portal: TenantPortalService;

  beforeAll(async () => {
    await setup();
    const adminUrl = process.env.DATABASE_URL!;
    await bootstrapDatabaseRoles({
      adminConnectionString: adminUrl,
      runtimePassword,
      migratorPassword,
      provisionerPassword,
    });
    const admin = createKysely<unknown>({ connectionString: adminUrl });
    const adminMigrator = new Migrator({
      db: admin,
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
    const adminMigrated = await adminMigrator.migrateToLatest();
    if (adminMigrated.error) {
      throw new Error("Admin migrations failed", {
        cause: adminMigrated.error,
      });
    }
    await sql`
      INSERT INTO tenants (
        id, name, slug, database_name, database_host, status, provisioning_status,
        legal_name, trade_name, tax_id, contact_email, activated_at
      ) VALUES (
        ${tenantId}, 'Tenant Test', 'tenant-test', ${tenantDatabaseName},
        'localhost', 'active', 'completed', 'Tenant Test Ltda', 'Tenant Test',
        '12345678000195', 'finance@tenant.test', now()
      )
    `.execute(admin);
    await grantRuntimePrivileges(admin);
    await sql.raw(`CREATE DATABASE ${tenantDatabaseName}`).execute(admin);
    await closeKysely(admin);

    const tenantAdmin = createKysely<unknown>({
      connectionString: connectionFor(
        adminUrl,
        "test",
        "test",
        tenantDatabaseName,
      ),
    });
    await sql
      .raw(
        `REVOKE CREATE ON SCHEMA public FROM PUBLIC; GRANT CONNECT ON DATABASE ${tenantDatabaseName} TO blupo_app, blupo_migrator; GRANT USAGE ON SCHEMA public TO blupo_app, blupo_migrator; GRANT CREATE ON SCHEMA public TO blupo_migrator`,
      )
      .execute(tenantAdmin);
    await closeKysely(tenantAdmin);

    const migratorDatabase = createKysely<unknown>({
      connectionString: connectionFor(
        adminUrl,
        databaseRoleNames.migrator,
        migratorPassword,
        tenantDatabaseName,
      ),
    });
    const migrator = new Migrator({
      db: migratorDatabase,
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
    const migrated = await migrator.migrateToLatest();
    if (migrated.error) {
      throw new Error("Tenant migrations failed", { cause: migrated.error });
    }
    await grantRuntimePrivileges(migratorDatabase);
    await closeKysely(migratorDatabase);

    const runtimeUrl = connectionFor(
      adminUrl,
      databaseRoleNames.runtime,
      runtimePassword,
    );
    const tenantRuntime = createKysely<TenantDatabase>({
      connectionString: connectionFor(
        adminUrl,
        databaseRoleNames.runtime,
        runtimePassword,
        tenantDatabaseName,
      ),
    });
    await withTenantTransaction(
      tenantRuntime,
      tenantId,
      async (transaction) => {
        const user = await transaction
          .insertInto("users")
          .values({
            tenant_id: tenantId,
            identity_id: identityId,
            email: "admin@tenant.test",
            normalized_email: "admin@tenant.test",
            display_name: "Tenant Admin",
          })
          .returning("id")
          .executeTakeFirstOrThrow();
        const role = await transaction
          .insertInto("roles")
          .values({
            tenant_id: tenantId,
            name: "Super Administrator",
            slug: "tenant_super_admin",
            reserved: true,
          })
          .returning("id")
          .executeTakeFirstOrThrow();
        const permission = await transaction
          .insertInto("permissions")
          .values({ tenant_id: tenantId, key: "company:update" })
          .returning("id")
          .executeTakeFirstOrThrow();
        await transaction
          .insertInto("user_roles")
          .values({ tenant_id: tenantId, user_id: user.id, role_id: role.id })
          .execute();
        await transaction
          .insertInto("role_permissions")
          .values({
            tenant_id: tenantId,
            role_id: role.id,
            permission_id: permission.id,
          })
          .execute();
        await transaction
          .insertInto("company_settings")
          .values({
            tenant_id: tenantId,
            legal_name: "Tenant Test Ltda",
            trade_name: "Tenant Test",
            tax_id: "12345678000195",
            contact_email: "finance@tenant.test",
          })
          .execute();
      },
    );
    await closeKysely(tenantRuntime);

    const config = new ConfigService({
      DATABASE_URL: runtimeUrl,
      DATABASE_POOL_MIN: 0,
      DATABASE_POOL_MAX: 2,
      DATABASE_TIMEOUT: 30_000,
      TENANT_POOL_CACHE_MAX: 2,
      TENANT_DATABASE_POOL_MAX: 1,
    });
    manager = new TenantDatabaseManager(config);
    adminDatabase = new AdminDatabaseService(config);
    service = new TenantAuthorizationService(manager);
    portal = new TenantPortalService(adminDatabase, manager);
  });

  afterAll(async () => {
    await manager.onApplicationShutdown();
    await adminDatabase.onApplicationShutdown();
    await teardown();
  });

  it("loads the signed tenant context and denies a different tenant", async () => {
    await expect(
      service.load({ tenantId, databaseName: tenantDatabaseName, identityId }),
    ).resolves.toEqual({
      roles: ["tenant_super_admin"],
      permissions: ["company:update"],
    });

    await expect(
      service.load({
        tenantId: otherTenantId,
        databaseName: tenantDatabaseName,
        identityId,
      }),
    ).rejects.toThrow("Tenant account has no active role");
  });

  it("reads and updates only the signed tenant company settings", async () => {
    const user: AuthenticatedUser = {
      realm: "tenant",
      userId: identityId,
      tenantId,
      roles: ["tenant_super_admin"],
      permissions: ["company:read", "company:update", "subscription:read"],
      tokenId: "30000000-0000-4000-8000-000000000099",
    };
    await expect(portal.overview(user)).resolves.toMatchObject({
      settings: { legalName: "Tenant Test Ltda", tradeName: "Tenant Test" },
      activeUsers: 1,
      currentUser: { displayName: "Tenant Admin" },
      subscription: null,
    });
    const update = {
      legalName: "Tenant Test Atualizada Ltda",
      tradeName: "Tenant Atualizada",
      contactEmail: "contato@tenant.test",
      timezone: "America/Sao_Paulo",
      locale: "pt-BR",
    };
    const updates = await Promise.all([
      portal.updateSettings(user, update),
      portal.updateSettings(user, update),
    ]);
    expect(updates).toEqual([
      expect.objectContaining({
        legalName: "Tenant Test Atualizada Ltda",
        tradeName: "Tenant Atualizada",
        contactEmail: "contato@tenant.test",
      }),
      expect.objectContaining({
        legalName: "Tenant Test Atualizada Ltda",
        tradeName: "Tenant Atualizada",
        contactEmail: "contato@tenant.test",
      }),
    ]);

    const tenantDatabase = await manager.get(tenantDatabaseName);
    const mutationEvidence = await withTenantTransaction(
      tenantDatabase,
      tenantId,
      async (transaction) => {
        const [audit, outbox] = await Promise.all([
          transaction
            .selectFrom("audit_logs")
            .select(({ fn }) => fn.countAll<string>().as("total"))
            .where("tenant_id", "=", tenantId)
            .where("action", "=", "company.settings.updated")
            .executeTakeFirstOrThrow(),
          transaction
            .selectFrom("outbox")
            .select(({ fn }) => fn.countAll<string>().as("total"))
            .where("tenant_id", "=", tenantId)
            .where("type", "=", "company.settings.updated")
            .executeTakeFirstOrThrow(),
        ]);
        return { audit: Number(audit.total), outbox: Number(outbox.total) };
      },
    );
    expect(mutationEvidence).toEqual({ audit: 1, outbox: 1 });

    await expect(
      portal.settings({ ...user, tenantId: otherTenantId }),
    ).rejects.toThrow("Tenant is unavailable");
  });
});
