import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "@saas/auth";
import type { UpdateCompanySettingsRequest } from "@saas/contracts";
import { withTenantTransaction } from "@saas/database";
import { getRequestContext } from "@saas/observability";
import { sql, type Selectable } from "kysely";
import { AdminDatabaseService } from "../../common/database.module.js";
import { toSafeInteger } from "../../common/safe-integer.js";
import type { TenantDatabase } from "../../common/tenant-database.js";
import { TenantDatabaseManager } from "../../common/tenant-database.manager.js";

interface TenantContext {
  tenantId: string;
  databaseName: string;
}

@Injectable()
export class TenantPortalService {
  constructor(
    private readonly adminDatabase: AdminDatabaseService,
    private readonly tenantDatabases: TenantDatabaseManager,
  ) {}

  async overview(user: AuthenticatedUser): Promise<Record<string, unknown>> {
    const context = await this.context(user);
    const database = await this.tenantDatabases.get(context.databaseName);
    const [tenantData, subscription] = await Promise.all([
      withTenantTransaction(database, context.tenantId, async (transaction) => {
        const [settings, userCount, currentUser] = await Promise.all([
          transaction
            .selectFrom("company_settings")
            .selectAll()
            .where("tenant_id", "=", context.tenantId)
            .where("deleted_at", "is", null)
            .executeTakeFirst(),
          transaction
            .selectFrom("users")
            .select(({ fn }) => fn.countAll<string>().as("total"))
            .where("tenant_id", "=", context.tenantId)
            .where("status", "=", "active")
            .where("deleted_at", "is", null)
            .executeTakeFirstOrThrow(),
          transaction
            .selectFrom("users")
            .select(["display_name", "email"])
            .where("tenant_id", "=", context.tenantId)
            .where("identity_id", "=", user.userId)
            .where("deleted_at", "is", null)
            .executeTakeFirst(),
        ]);
        if (!settings || !currentUser) {
          throw new NotFoundException("Tenant profile is unavailable");
        }
        return {
          settings: this.settingsResponse(settings),
          activeUsers: toSafeInteger(userCount.total, "active user count"),
          currentUser: {
            displayName: currentUser.display_name,
            email: currentUser.email,
          },
        };
      }),
      this.adminDatabase.db
        .selectFrom("subscriptions as subscription")
        .innerJoin("plans as plan", "plan.id", "subscription.plan_id")
        .select([
          "subscription.status",
          "subscription.billing_interval",
          "subscription.amount_cents",
          "subscription.currency",
          "subscription.current_period_end",
          "subscription.trial_ends_at",
          "plan.name as plan_name",
        ])
        .where("subscription.tenant_id", "=", context.tenantId)
        .orderBy("subscription.created_at", "desc")
        .executeTakeFirst(),
    ]);
    return {
      ...tenantData,
      subscription: subscription
        ? {
            planName: subscription.plan_name,
            status: subscription.status,
            billingInterval: subscription.billing_interval,
            amountCents: toSafeInteger(
              subscription.amount_cents,
              "subscription amount",
            ),
            currency: subscription.currency,
            currentPeriodEnd: subscription.current_period_end.toISOString(),
            trialEndsAt: subscription.trial_ends_at?.toISOString() ?? null,
          }
        : null,
    };
  }

  async settings(user: AuthenticatedUser): Promise<Record<string, unknown>> {
    const context = await this.context(user);
    const database = await this.tenantDatabases.get(context.databaseName);
    return withTenantTransaction(
      database,
      context.tenantId,
      async (transaction) => {
        const settings = await transaction
          .selectFrom("company_settings")
          .selectAll()
          .where("tenant_id", "=", context.tenantId)
          .where("deleted_at", "is", null)
          .executeTakeFirst();
        if (!settings)
          throw new NotFoundException("Company settings not found");
        return this.settingsResponse(settings);
      },
    );
  }

  async updateSettings(
    user: AuthenticatedUser,
    input: UpdateCompanySettingsRequest,
  ): Promise<Record<string, unknown>> {
    const context = await this.context(user);
    const database = await this.tenantDatabases.get(context.databaseName);
    return withTenantTransaction(
      database,
      context.tenantId,
      async (transaction) => {
        const before = await transaction
          .selectFrom("company_settings")
          .selectAll()
          .where("tenant_id", "=", context.tenantId)
          .where("deleted_at", "is", null)
          .forUpdate()
          .executeTakeFirst();
        if (!before) throw new NotFoundException("Company settings not found");
        const updated = await transaction
          .updateTable("company_settings")
          .set({
            legal_name: input.legalName,
            trade_name: input.tradeName,
            contact_email: input.contactEmail,
            timezone: input.timezone,
            locale: input.locale,
          })
          .where("tenant_id", "=", context.tenantId)
          .where("id", "=", before.id)
          .where(
            sql<boolean>`(
            legal_name IS DISTINCT FROM ${input.legalName}::text OR
            trade_name IS DISTINCT FROM ${input.tradeName}::text OR
            contact_email IS DISTINCT FROM ${input.contactEmail}::text OR
            timezone IS DISTINCT FROM ${input.timezone}::text OR
            locale IS DISTINCT FROM ${input.locale}::text
          )`,
          )
          .returningAll()
          .executeTakeFirst();
        if (!updated) return this.settingsResponse(before);
        const actor = await transaction
          .selectFrom("users")
          .select("id")
          .where("tenant_id", "=", context.tenantId)
          .where("identity_id", "=", user.userId)
          .where("deleted_at", "is", null)
          .executeTakeFirst();
        if (!actor) throw new NotFoundException("Tenant user not found");
        const beforeState = this.settingsResponse(before);
        const afterState = this.settingsResponse(updated);
        const correlationId = getRequestContext()?.correlationId;
        await transaction
          .insertInto("audit_logs")
          .values({
            tenant_id: context.tenantId,
            actor_id: actor.id,
            action: "company.settings.updated",
            resource: "company_settings",
            resource_id: updated.id,
            before_state: beforeState,
            after_state: afterState,
            correlation_id: correlationId ?? null,
          })
          .execute();
        await transaction
          .insertInto("outbox")
          .values({
            tenant_id: context.tenantId,
            type: "company.settings.updated",
            aggregate_type: "CompanySettings",
            aggregate_id: updated.id,
            payload: afterState,
            metadata: correlationId ? { correlationId } : null,
          })
          .execute();
        return afterState;
      },
    );
  }

  private async context(user: AuthenticatedUser): Promise<TenantContext> {
    if (user.realm !== "tenant") {
      throw new NotFoundException("Tenant context is unavailable");
    }
    const tenant = await this.adminDatabase.db
      .selectFrom("tenants")
      .select(["id", "database_name", "status"])
      .where("id", "=", user.tenantId)
      .executeTakeFirst();
    if (tenant?.status !== "active" || !tenant.database_name) {
      throw new ServiceUnavailableException("Tenant is unavailable");
    }
    return { tenantId: tenant.id, databaseName: tenant.database_name };
  }

  private settingsResponse(
    settings: Selectable<TenantDatabase["company_settings"]>,
  ): Record<string, unknown> {
    return {
      id: settings.id,
      legalName: settings.legal_name,
      tradeName: settings.trade_name,
      taxId: settings.tax_id,
      contactEmail: settings.contact_email,
      timezone: settings.timezone,
      locale: settings.locale,
      updatedAt: settings.updated_at.toISOString(),
    };
  }
}
