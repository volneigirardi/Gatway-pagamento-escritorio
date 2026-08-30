import { Injectable } from "@nestjs/common";
import type { Selectable } from "kysely";
import { AdminDatabaseService } from "../../common/database.module.js";
import type { AdminDatabase } from "../../common/admin-database.js";

export type IdentityRow = Selectable<AdminDatabase["identities"]>;
export type MfaFactorRow = Selectable<AdminDatabase["mfa_factors"]>;

export interface IdentityWithTenant extends IdentityRow {
  tenant_status: Selectable<AdminDatabase["tenants"]>["status"] | null;
  tenant_database_name: string | null;
}

export interface AuditInput {
  actorIdentityId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  tenantId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  correlationId?: string;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly database: AdminDatabaseService) {}

  async findIdentityByNormalizedEmail(
    normalizedEmail: string,
  ): Promise<IdentityWithTenant | undefined> {
    return this.database.db
      .selectFrom("identities")
      .leftJoin("tenants", "tenants.id", "identities.tenant_id")
      .selectAll("identities")
      .select([
        "tenants.status as tenant_status",
        "tenants.database_name as tenant_database_name",
      ])
      .where("identities.normalized_email", "=", normalizedEmail)
      .where("identities.deleted_at", "is", null)
      .executeTakeFirst();
  }

  async findIdentityById(
    identityId: string,
  ): Promise<IdentityWithTenant | undefined> {
    return this.database.db
      .selectFrom("identities")
      .leftJoin("tenants", "tenants.id", "identities.tenant_id")
      .selectAll("identities")
      .select([
        "tenants.status as tenant_status",
        "tenants.database_name as tenant_database_name",
      ])
      .where("identities.id", "=", identityId)
      .where("identities.deleted_at", "is", null)
      .executeTakeFirst();
  }

  async loadPlatformAuthorization(identityId: string): Promise<{
    roles: string[];
    permissions: string[];
  }> {
    const rows = await this.database.db
      .selectFrom("platform_identity_roles")
      .innerJoin(
        "platform_roles",
        "platform_roles.id",
        "platform_identity_roles.role_id",
      )
      .leftJoin(
        "platform_role_permissions",
        "platform_role_permissions.role_id",
        "platform_roles.id",
      )
      .leftJoin(
        "platform_permissions",
        "platform_permissions.id",
        "platform_role_permissions.permission_id",
      )
      .select([
        "platform_roles.slug as role",
        "platform_permissions.key as permission",
      ])
      .where("platform_identity_roles.identity_id", "=", identityId)
      .where("platform_identity_roles.deleted_at", "is", null)
      .where("platform_roles.deleted_at", "is", null)
      .where((expression) =>
        expression.or([
          expression("platform_role_permissions.deleted_at", "is", null),
          expression("platform_role_permissions.id", "is", null),
        ]),
      )
      .where((expression) =>
        expression.or([
          expression("platform_permissions.deleted_at", "is", null),
          expression("platform_permissions.id", "is", null),
        ]),
      )
      .execute();

    return {
      roles: [...new Set(rows.map((row) => row.role))],
      permissions: [
        ...new Set(
          rows
            .map((row) => row.permission)
            .filter((permission): permission is string => permission !== null),
        ),
      ],
    };
  }

  async getMfaFactor(identityId: string): Promise<MfaFactorRow | undefined> {
    return this.database.db
      .selectFrom("mfa_factors")
      .selectAll()
      .where("identity_id", "=", identityId)
      .executeTakeFirst();
  }

  async savePendingMfaFactor(
    identityId: string,
    secretCiphertext: string,
  ): Promise<MfaFactorRow> {
    return this.database.db
      .insertInto("mfa_factors")
      .values({ identity_id: identityId, secret_ciphertext: secretCiphertext })
      .onConflict((conflict) =>
        conflict.column("identity_id").doUpdateSet({
          secret_ciphertext: secretCiphertext,
          enabled_at: null,
          last_used_step: null,
        }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async enableMfaFactor(factorId: string): Promise<void> {
    const result = await this.database.db
      .updateTable("mfa_factors")
      .set({ enabled_at: new Date() })
      .where("id", "=", factorId)
      .executeTakeFirst();
    if (Number(result.numUpdatedRows) !== 1) {
      throw new Error("MFA factor was not updated");
    }
  }

  async consumeMfaStep(factorId: string, step: number): Promise<boolean> {
    const result = await this.database.db
      .updateTable("mfa_factors")
      .set({ last_used_step: String(step) })
      .where("id", "=", factorId)
      .where((expression) =>
        expression.or([
          expression("last_used_step", "is", null),
          expression("last_used_step", "<", String(step)),
        ]),
      )
      .executeTakeFirst();
    return Number(result.numUpdatedRows) === 1;
  }

  async replaceBackupCodes(
    factorId: string,
    codeHashes: string[],
  ): Promise<void> {
    await this.database.db.transaction().execute(async (transaction) => {
      await transaction
        .deleteFrom("mfa_backup_codes")
        .where("factor_id", "=", factorId)
        .execute();
      await transaction
        .insertInto("mfa_backup_codes")
        .values(
          codeHashes.map((codeHash) => ({
            factor_id: factorId,
            code_hash: codeHash,
          })),
        )
        .execute();
    });
  }

  async listUnusedBackupCodes(factorId: string): Promise<
    {
      id: string;
      codeHash: string;
    }[]
  > {
    const rows = await this.database.db
      .selectFrom("mfa_backup_codes")
      .select(["id", "code_hash"])
      .where("factor_id", "=", factorId)
      .where("used_at", "is", null)
      .execute();
    return rows.map((row) => ({ id: row.id, codeHash: row.code_hash }));
  }

  async consumeBackupCode(codeId: string): Promise<boolean> {
    const result = await this.database.db
      .updateTable("mfa_backup_codes")
      .set({ used_at: new Date() })
      .where("id", "=", codeId)
      .where("used_at", "is", null)
      .executeTakeFirst();
    return Number(result.numUpdatedRows) === 1;
  }

  async updatePassword(
    identityId: string,
    passwordHash: string,
  ): Promise<void> {
    const result = await this.database.db
      .updateTable("identities")
      .set({
        password_hash: passwordHash,
        must_change_password: false,
        password_changed_at: new Date(),
      })
      .where("id", "=", identityId)
      .executeTakeFirst();
    if (Number(result.numUpdatedRows) !== 1) {
      throw new Error("Identity password was not updated");
    }
  }

  async activateIdentity(identityId: string): Promise<void> {
    await this.database.db
      .updateTable("identities")
      .set({ status: "active" })
      .where("id", "=", identityId)
      .where("status", "=", "pending")
      .execute();
  }

  async recordSuccessfulLogin(identityId: string): Promise<void> {
    const result = await this.database.db
      .updateTable("identities")
      .set({ last_login_at: new Date(), locked_until: null })
      .where("id", "=", identityId)
      .executeTakeFirst();
    if (Number(result.numUpdatedRows) !== 1) {
      throw new Error("Identity login timestamp was not updated");
    }
  }

  async appendAudit(input: AuditInput): Promise<void> {
    await this.database.db
      .insertInto("platform_audit_logs")
      .values({
        actor_identity_id: input.actorIdentityId ?? null,
        action: input.action,
        resource: input.resource,
        resource_id: input.resourceId ?? null,
        tenant_id: input.tenantId ?? null,
        metadata: input.metadata ?? {},
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
        request_id: input.requestId ?? null,
        correlation_id: input.correlationId ?? null,
      })
      .execute();
  }
}
