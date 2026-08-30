import { Injectable } from "@nestjs/common";
import type { Kysely, Selectable, Transaction, Updateable } from "kysely";
import type { AdminDatabase } from "../../common/admin-database.js";
import { AdminDatabaseService } from "../../common/database.module.js";
import { toSafeInteger } from "../../common/safe-integer.js";

export type TenantRow = Selectable<AdminDatabase["tenants"]>;

export interface PlanSelection {
  planId: string;
  planSlug: string;
  planStatus: "draft" | "active" | "archived";
  trialDays: number;
  priceId: string;
  currency: string;
  billingInterval: "monthly" | "yearly";
  amountCents: number;
}

@Injectable()
export class TenantsRepository {
  constructor(private readonly database: AdminDatabaseService) {}

  get db(): Kysely<AdminDatabase> {
    return this.database.db;
  }

  async getPlanSelection(
    planId: string,
    planPriceId: string,
    executor: Kysely<AdminDatabase> | Transaction<AdminDatabase> = this.database
      .db,
  ): Promise<PlanSelection | undefined> {
    const row = await executor
      .selectFrom("plans")
      .innerJoin("plan_prices", "plan_prices.plan_id", "plans.id")
      .select([
        "plans.id as planId",
        "plans.slug as planSlug",
        "plans.status as planStatus",
        "plans.trial_days as trialDays",
        "plan_prices.id as priceId",
        "plan_prices.currency as currency",
        "plan_prices.billing_interval as billingInterval",
        "plan_prices.amount_cents as amountCents",
      ])
      .where("plans.id", "=", planId)
      .where("plan_prices.id", "=", planPriceId)
      .where("plans.deleted_at", "is", null)
      .where("plan_prices.effective_from", "<=", new Date())
      .where((expression) =>
        expression.or([
          expression("plan_prices.effective_to", "is", null),
          expression("plan_prices.effective_to", ">", new Date()),
        ]),
      )
      .executeTakeFirst();
    return row
      ? {
          ...row,
          amountCents: toSafeInteger(row.amountCents, "plan price"),
        }
      : undefined;
  }

  async create(
    transaction: Transaction<AdminDatabase>,
    input: {
      name: string;
      slug: string;
      legalName?: string;
      tradeName?: string;
      taxId?: string;
      contactEmail: string;
      createdByIdentityId: string;
      plan: PlanSelection;
    },
  ): Promise<TenantRow> {
    const tenant = await transaction
      .insertInto("tenants")
      .values({
        name: input.name,
        slug: input.slug,
        legal_name: input.legalName ?? null,
        trade_name: input.tradeName ?? null,
        tax_id: input.taxId ?? null,
        contact_email: input.contactEmail.toLowerCase(),
        database_name: null,
        database_host: null,
        status: "provisioning",
        plan: input.plan.planSlug,
        plan_id: input.plan.planId,
        provisioning_status: "queued",
        created_by_identity_id: input.createdByIdentityId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const periodStart = new Date();
    const periodEnd = new Date(periodStart);
    if (input.plan.billingInterval === "monthly") {
      periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
    } else {
      periodEnd.setUTCFullYear(periodEnd.getUTCFullYear() + 1);
    }
    const trialEndsAt =
      input.plan.trialDays > 0
        ? new Date(periodStart.getTime() + input.plan.trialDays * 86_400_000)
        : null;
    await transaction
      .insertInto("subscriptions")
      .values({
        tenant_id: tenant.id,
        plan_id: input.plan.planId,
        plan_price_id: input.plan.priceId,
        status: "pending",
        currency: input.plan.currency,
        billing_interval: input.plan.billingInterval,
        amount_cents: String(input.plan.amountCents),
        current_period_start: periodStart,
        current_period_end: periodEnd,
        trial_ends_at: trialEndsAt,
      })
      .execute();
    return tenant;
  }

  async findById(
    tenantId: string,
    executor: Kysely<AdminDatabase> | Transaction<AdminDatabase> = this.database
      .db,
  ): Promise<TenantRow | undefined> {
    return executor
      .selectFrom("tenants")
      .selectAll()
      .where("id", "=", tenantId)
      .executeTakeFirst();
  }

  async list(input: {
    limit: number;
    search?: string;
    status?: TenantRow["status"];
    before?: { createdAt: Date; id: string };
  }): Promise<TenantRow[]> {
    let query = this.database.db.selectFrom("tenants").selectAll();
    const search = input.search;
    if (search) {
      query = query.where((expression) =>
        expression.or([
          expression("name", "ilike", `%${search}%`),
          expression("slug", "ilike", `%${search}%`),
          expression("contact_email", "ilike", `%${search}%`),
        ]),
      );
    }
    if (input.status) query = query.where("status", "=", input.status);
    const before = input.before;
    if (before) {
      query = query.where((expression) =>
        expression.or([
          expression("created_at", "<", before.createdAt),
          expression.and([
            expression("created_at", "=", before.createdAt),
            expression("id", "<", before.id),
          ]),
        ]),
      );
    }
    return query
      .orderBy("created_at", "desc")
      .orderBy("id", "desc")
      .limit(input.limit + 1)
      .execute();
  }

  async findByIdForUpdate(
    transaction: Transaction<AdminDatabase>,
    tenantId: string,
  ): Promise<TenantRow | undefined> {
    return transaction
      .selectFrom("tenants")
      .selectAll()
      .where("id", "=", tenantId)
      .forUpdate()
      .executeTakeFirst();
  }

  async hasTenantIdentity(
    transaction: Transaction<AdminDatabase>,
    tenantId: string,
  ): Promise<boolean> {
    const identity = await transaction
      .selectFrom("identities")
      .select("id")
      .where("tenant_id", "=", tenantId)
      .where("realm", "=", "tenant")
      .where("deleted_at", "is", null)
      .executeTakeFirst();
    return identity !== undefined;
  }

  async update(
    transaction: Transaction<AdminDatabase>,
    tenantId: string,
    changes: Updateable<AdminDatabase["tenants"]>,
  ): Promise<TenantRow | undefined> {
    return transaction
      .updateTable("tenants")
      .set(changes)
      .where("id", "=", tenantId)
      .returningAll()
      .executeTakeFirst();
  }

  async createAdminIdentity(
    transaction: Transaction<AdminDatabase>,
    input: {
      tenantId: string;
      email: string;
      displayName: string;
      passwordHash: string;
    },
  ): Promise<string> {
    const identity = await transaction
      .insertInto("identities")
      .values({
        email: input.email,
        display_name: input.displayName,
        normalized_email: input.email.toLowerCase(),
        password_hash: input.passwordHash,
        realm: "tenant",
        tenant_id: input.tenantId,
        status: "pending",
        must_change_password: true,
        mfa_required: true,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    return identity.id;
  }
}
