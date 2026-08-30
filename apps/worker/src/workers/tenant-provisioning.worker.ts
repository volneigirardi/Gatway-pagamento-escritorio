import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { spawn } from "node:child_process";
import path from "node:path";
import { Worker, type Job } from "bullmq";
import pg from "pg";
import { sql } from "kysely";
import {
  closeKysely,
  createKysely,
  withTenantTransaction,
} from "@saas/database";
import { createLogger, type Logger } from "@saas/observability";
import type { WorkerTenantDatabase } from "../database.js";
import { WorkerInfrastructure } from "../infrastructure.js";
import type { TenantProvisioningJob } from "./platform-outbox.relay.js";

const tenantPermissions = [
  "company:read",
  "company:update",
  "users:read",
  "users:write",
  "roles:read",
  "roles:write",
  "security:read",
  "security:write",
  "subscription:read",
];

function databaseUrl(connectionString: string, databaseName: string): string {
  const url = new URL(connectionString);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function databaseNameFor(tenantId: string): string {
  const compact = tenantId.replaceAll("-", "").toLowerCase();
  if (!/^[a-f0-9]{32}$/u.test(compact)) throw new Error("Invalid tenant ID");
  return `tenant_${compact}`;
}

function errorCode(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[A-Z0-9_]{2,40}$/u.test(error.code)
  ) {
    return error.code;
  }
  return error instanceof Error ? error.name : "UnknownError";
}

function migrationScriptPath(): string {
  return path.resolve(
    import.meta.dirname,
    "../../../../database/scripts/run-migrations.ts",
  );
}

@Injectable()
export class TenantProvisioningWorker implements OnApplicationShutdown {
  private readonly logger: Logger;
  private readonly worker: Worker<TenantProvisioningJob>;
  private readonly migrationDatabaseUrl: string;
  private readonly provisionerDatabaseUrl: string;
  private readonly runtimeDatabaseUrl: string;

  constructor(
    config: ConfigService,
    private readonly infrastructure: WorkerInfrastructure,
  ) {
    this.logger = createLogger(config.get<string>("LOG_LEVEL") ?? "info").child(
      {
        worker: "tenant-provisioning",
      },
    );
    this.migrationDatabaseUrl = config.getOrThrow<string>(
      "MIGRATION_DATABASE_URL",
    );
    this.provisionerDatabaseUrl = config.getOrThrow<string>(
      "TENANT_PROVISIONER_DATABASE_URL",
    );
    this.runtimeDatabaseUrl = config.getOrThrow<string>("DATABASE_URL");
    this.worker = new Worker<TenantProvisioningJob>(
      "tenant-provisioning",
      async (job) => this.process(job),
      {
        connection: infrastructure.queueConnection,
        concurrency: config.getOrThrow<number>(
          "TENANT_PROVISIONING_CONCURRENCY",
        ),
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 500 },
      },
    );
    this.worker.on("failed", (job, error) => {
      this.logger.error(
        {
          jobId: job?.id,
          tenantId: job?.data.tenantId,
          errorType: errorCode(error),
        },
        "Tenant provisioning job failed",
      );
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker.close();
  }

  private async process(job: Job<TenantProvisioningJob>): Promise<void> {
    const lockClient = new pg.Client({
      connectionString: this.provisionerDatabaseUrl,
      connectionTimeoutMillis: 10000,
    });
    await lockClient.connect();
    await lockClient.query("SET lock_timeout = '5s'");
    try {
      await lockClient.query(
        "SELECT pg_advisory_lock(hashtextextended($1::text, 0::bigint))",
        [job.data.tenantId],
      );
      await this.processLocked(job);
    } finally {
      try {
        await lockClient.query(
          "SELECT pg_advisory_unlock(hashtextextended($1::text, 0::bigint))",
          [job.data.tenantId],
        );
      } finally {
        await lockClient.end();
      }
    }
  }

  private async processLocked(job: Job<TenantProvisioningJob>): Promise<void> {
    if (job.name === "tenant.provisioning.requested") {
      await this.provisionDatabase(job);
      return;
    }
    if (job.name === "tenant.admin.provisioning.requested") {
      if (!job.data.identityId) throw new Error("Identity ID is required");
      await this.provisionAdministrator(job, job.data.identityId);
      return;
    }
    throw new Error("Unsupported tenant provisioning job");
  }

  private async provisionDatabase(
    job: Job<TenantProvisioningJob>,
  ): Promise<void> {
    const tenant = await this.infrastructure.database
      .selectFrom("tenants")
      .selectAll()
      .where("id", "=", job.data.tenantId)
      .executeTakeFirstOrThrow();
    if (tenant.provisioning_status === "completed") return;

    const jobKey = `tenant-provision-${tenant.id}`;
    await this.infrastructure.database
      .insertInto("tenant_provisioning_attempts")
      .values({
        tenant_id: tenant.id,
        job_key: jobKey,
        status: "running",
        started_at: new Date(),
      })
      .onConflict((conflict) =>
        conflict.column("job_key").doUpdateSet({
          status: "running",
          attempt: sql`tenant_provisioning_attempts.attempt + 1`,
          error_code: null,
          error_detail: null,
          started_at: new Date(),
          completed_at: null,
        }),
      )
      .execute();
    await this.infrastructure.database
      .updateTable("tenants")
      .set({
        status: "provisioning",
        provisioning_status: "running",
        last_error_code: null,
      })
      .where("id", "=", tenant.id)
      .execute();

    const databaseName = databaseNameFor(tenant.id);
    try {
      await this.ensureDatabase(databaseName);
      await this.runTenantMigrations(databaseName);
      const provisionerUrl = new URL(this.provisionerDatabaseUrl);
      await this.infrastructure.database
        .transaction()
        .execute(async (transaction) => {
          await transaction
            .updateTable("tenants")
            .set({
              database_name: databaseName,
              database_host: provisionerUrl.hostname,
              database_port: Number(provisionerUrl.port || 5432),
              status: "pending_admin",
              provisioning_status: "completed",
              last_error_code: null,
            })
            .where("id", "=", tenant.id)
            .execute();
          await transaction
            .updateTable("tenant_provisioning_attempts")
            .set({ status: "completed", completed_at: new Date() })
            .where("job_key", "=", jobKey)
            .execute();
          await transaction
            .insertInto("platform_audit_logs")
            .values({
              action: "tenant.provisioning.completed",
              resource: "tenant",
              resource_id: tenant.id,
              tenant_id: tenant.id,
              metadata: { jobId: job.id ?? null },
            })
            .execute();
        });
    } catch (error) {
      await this.infrastructure.database
        .transaction()
        .execute(async (transaction) => {
          await transaction
            .updateTable("tenants")
            .set({
              status: "failed",
              provisioning_status: "failed",
              last_error_code: "PROVISIONING_FAILED",
            })
            .where("id", "=", tenant.id)
            .execute();
          await transaction
            .updateTable("tenant_provisioning_attempts")
            .set({
              status: "failed",
              error_code: "PROVISIONING_FAILED",
              error_detail: errorCode(error),
              completed_at: new Date(),
            })
            .where("job_key", "=", jobKey)
            .execute();
        });
      throw error;
    }
  }

  private async ensureDatabase(databaseName: string): Promise<void> {
    const provisioner = new pg.Client({
      connectionString: this.provisionerDatabaseUrl,
    });
    await provisioner.connect();
    try {
      const existing = await provisioner.query<{ exists: boolean }>(
        "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
        [databaseName],
      );
      if (!existing.rows[0]?.exists) {
        const formatted = await provisioner.query<{ statement: string }>(
          "SELECT format('CREATE DATABASE %I', $1::text) AS statement",
          [databaseName],
        );
        const statement = formatted.rows[0]?.statement;
        if (!statement) throw new Error("Database creation statement failed");
        await provisioner.query(statement);
      }
    } finally {
      await provisioner.end();
    }

    const tenantProvisioner = new pg.Client({
      connectionString: databaseUrl(this.provisionerDatabaseUrl, databaseName),
    });
    await tenantProvisioner.connect();
    try {
      const formattedGrant = await tenantProvisioner.query<{
        statement: string;
      }>(
        "SELECT format('GRANT CONNECT ON DATABASE %I TO blupo_app, blupo_migrator', $1::text) AS statement",
        [databaseName],
      );
      const grantStatement = formattedGrant.rows[0]?.statement;
      if (!grantStatement) throw new Error("Database grant statement failed");
      await tenantProvisioner.query(grantStatement);
      await tenantProvisioner.query(
        "REVOKE CREATE ON SCHEMA public FROM PUBLIC",
      );
      await tenantProvisioner.query(
        "GRANT USAGE ON SCHEMA public TO blupo_app, blupo_migrator",
      );
      await tenantProvisioner.query(
        "GRANT CREATE ON SCHEMA public TO blupo_migrator",
      );
    } finally {
      await tenantProvisioner.end();
    }
  }

  private async runTenantMigrations(databaseName: string): Promise<void> {
    const migrationUrl = databaseUrl(this.migrationDatabaseUrl, databaseName);
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["--experimental-strip-types", migrationScriptPath(), "up", "tenant"],
        {
          env: {
            NODE_ENV: process.env["NODE_ENV"] ?? "production",
            LOG_LEVEL: process.env["LOG_LEVEL"] ?? "info",
            MIGRATION_DATABASE_URL: migrationUrl,
            ...(process.env["OTEL_ENABLED"]
              ? { OTEL_ENABLED: process.env["OTEL_ENABLED"] }
              : {}),
            ...(process.env["OTEL_EXPORTER_OTLP_ENDPOINT"]
              ? {
                  OTEL_EXPORTER_OTLP_ENDPOINT:
                    process.env["OTEL_EXPORTER_OTLP_ENDPOINT"],
                }
              : {}),
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let stderr = "";
      child.stdout.resume();
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      child.on("error", reject);
      child.on("exit", (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(
          new Error("Tenant migration process failed", {
            cause: stderr.slice(0, 2000),
          }),
        );
      });
    });
  }

  private async provisionAdministrator(
    job: Job<TenantProvisioningJob>,
    identityId: string,
  ): Promise<void> {
    const row = await this.infrastructure.database
      .selectFrom("tenants")
      .innerJoin("identities", "identities.tenant_id", "tenants.id")
      .select([
        "tenants.id as tenantId",
        "tenants.status as tenantStatus",
        "tenants.database_name as databaseName",
        "tenants.legal_name as legalName",
        "tenants.trade_name as tradeName",
        "tenants.tax_id as taxId",
        "tenants.contact_email as contactEmail",
        "identities.id as identityId",
        "identities.email as email",
        "identities.display_name as displayName",
      ])
      .where("tenants.id", "=", job.data.tenantId)
      .where("identities.id", "=", identityId)
      .where("identities.deleted_at", "is", null)
      .executeTakeFirstOrThrow();
    if (row.tenantStatus === "active") return;
    const tenantDatabaseName = row.databaseName;
    const administratorName = row.displayName;
    if (!tenantDatabaseName || !administratorName) {
      throw new Error("Tenant database and administrator profile are required");
    }

    const tenantDatabase = createKysely<WorkerTenantDatabase>({
      connectionString: databaseUrl(
        this.runtimeDatabaseUrl,
        tenantDatabaseName,
      ),
      poolMin: 0,
      poolMax: 1,
      idleTimeoutMillis: 5000,
    });
    try {
      await withTenantTransaction(
        tenantDatabase,
        row.tenantId,
        async (transaction) => {
          const role = await transaction
            .insertInto("roles")
            .values({
              tenant_id: row.tenantId,
              name: "Super Administrator",
              slug: "tenant_super_admin",
              description: "Reserved tenant superadministrator role",
              reserved: true,
            })
            .onConflict((conflict) =>
              conflict.columns(["tenant_id", "slug"]).doUpdateSet({
                deleted_at: null,
                reserved: true,
              }),
            )
            .returning("id")
            .executeTakeFirstOrThrow();
          const user = await transaction
            .insertInto("users")
            .values({
              tenant_id: row.tenantId,
              identity_id: row.identityId,
              email: row.email,
              normalized_email: row.email.toLowerCase(),
              display_name: administratorName,
            })
            .onConflict((conflict) =>
              conflict.columns(["tenant_id", "identity_id"]).doUpdateSet({
                email: row.email,
                normalized_email: row.email.toLowerCase(),
                display_name: administratorName,
                status: "active",
                deleted_at: null,
              }),
            )
            .returning("id")
            .executeTakeFirstOrThrow();

          const existingUserRole = await transaction
            .selectFrom("user_roles")
            .select("id")
            .where("tenant_id", "=", row.tenantId)
            .where("user_id", "=", user.id)
            .where("role_id", "=", role.id)
            .where("deleted_at", "is", null)
            .executeTakeFirst();
          if (!existingUserRole) {
            await transaction
              .insertInto("user_roles")
              .values({
                tenant_id: row.tenantId,
                user_id: user.id,
                role_id: role.id,
              })
              .execute();
          }

          for (const permissionKey of tenantPermissions) {
            const permission = await transaction
              .insertInto("permissions")
              .values({ tenant_id: row.tenantId, key: permissionKey })
              .onConflict((conflict) =>
                conflict.columns(["tenant_id", "key"]).doUpdateSet({
                  deleted_at: null,
                }),
              )
              .returning("id")
              .executeTakeFirstOrThrow();
            const existingGrant = await transaction
              .selectFrom("role_permissions")
              .select("id")
              .where("tenant_id", "=", row.tenantId)
              .where("role_id", "=", role.id)
              .where("permission_id", "=", permission.id)
              .where("deleted_at", "is", null)
              .executeTakeFirst();
            if (!existingGrant) {
              await transaction
                .insertInto("role_permissions")
                .values({
                  tenant_id: row.tenantId,
                  role_id: role.id,
                  permission_id: permission.id,
                })
                .execute();
            }
          }

          await transaction
            .insertInto("company_settings")
            .values({
              tenant_id: row.tenantId,
              legal_name: row.legalName,
              trade_name: row.tradeName,
              tax_id: row.taxId,
              contact_email: row.contactEmail,
            })
            .onConflict((conflict) =>
              conflict.column("tenant_id").doUpdateSet({
                legal_name: row.legalName,
                trade_name: row.tradeName,
                tax_id: row.taxId,
                contact_email: row.contactEmail,
                deleted_at: null,
              }),
            )
            .execute();
        },
      );
    } finally {
      await closeKysely(tenantDatabase);
    }

    await this.infrastructure.database
      .transaction()
      .execute(async (transaction) => {
        await transaction
          .updateTable("tenants")
          .set({
            status: "active",
            activated_at: new Date(),
            last_error_code: null,
          })
          .where("id", "=", row.tenantId)
          .execute();
        const subscription = await transaction
          .selectFrom("subscriptions")
          .select(["id", "trial_ends_at"])
          .where("tenant_id", "=", row.tenantId)
          .where("status", "=", "pending")
          .executeTakeFirst();
        if (subscription) {
          await transaction
            .updateTable("subscriptions")
            .set({
              status:
                subscription.trial_ends_at &&
                subscription.trial_ends_at > new Date()
                  ? "trialing"
                  : "active",
              current_period_start: new Date(),
            })
            .where("id", "=", subscription.id)
            .execute();
        }
        await transaction
          .insertInto("platform_audit_logs")
          .values({
            actor_identity_id: identityId,
            action: "tenant.admin.provisioning.completed",
            resource: "tenant",
            resource_id: row.tenantId,
            tenant_id: row.tenantId,
            metadata: { jobId: job.id ?? null },
          })
          .execute();
      });
  }
}
