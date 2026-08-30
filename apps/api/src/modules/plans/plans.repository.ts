import { Injectable } from "@nestjs/common";
import type { Kysely, Selectable, Transaction, Updateable } from "kysely";
import type { AdminDatabase } from "../../common/admin-database.js";
import { AdminDatabaseService } from "../../common/database.module.js";

export type PlanRow = Selectable<AdminDatabase["plans"]>;
export type PlanPriceRow = Selectable<AdminDatabase["plan_prices"]>;

export interface PlanDetails {
  plan: PlanRow;
  prices: PlanPriceRow[];
  features: { key: string; value: unknown }[];
}

@Injectable()
export class PlansRepository {
  constructor(private readonly database: AdminDatabaseService) {}

  get db(): Kysely<AdminDatabase> {
    return this.database.db;
  }

  async create(
    transaction: Transaction<AdminDatabase>,
    input: {
      name: string;
      slug: string;
      description?: string;
      trialDays: number;
      currency: string;
      billingInterval: "monthly" | "yearly";
      amountCents: number;
      features: Record<string, unknown>;
    },
  ): Promise<PlanDetails> {
    const plan = await transaction
      .insertInto("plans")
      .values({
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        trial_days: input.trialDays,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    const price = await transaction
      .insertInto("plan_prices")
      .values({
        plan_id: plan.id,
        currency: input.currency,
        billing_interval: input.billingInterval,
        amount_cents: String(input.amountCents),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    const features = Object.entries(input.features).map(([key, value]) => ({
      plan_id: plan.id,
      key,
      value,
    }));
    if (features.length > 0) {
      await transaction.insertInto("plan_features").values(features).execute();
    }
    return {
      plan,
      prices: [price],
      features: features.map(({ key, value }) => ({ key, value })),
    };
  }

  async findById(
    planId: string,
    executor: Kysely<AdminDatabase> | Transaction<AdminDatabase> = this.database
      .db,
  ): Promise<PlanDetails | undefined> {
    const plan = await executor
      .selectFrom("plans")
      .selectAll()
      .where("id", "=", planId)
      .where("deleted_at", "is", null)
      .executeTakeFirst();
    if (!plan) return undefined;
    const [prices, features] = await Promise.all([
      executor
        .selectFrom("plan_prices")
        .selectAll()
        .where("plan_id", "=", planId)
        .orderBy("effective_from", "desc")
        .execute(),
      executor
        .selectFrom("plan_features")
        .select(["key", "value"])
        .where("plan_id", "=", planId)
        .execute(),
    ]);
    return { plan, prices, features };
  }

  async list(input: {
    limit: number;
    search?: string;
    status?: "draft" | "active" | "archived";
    before?: { createdAt: Date; id: string };
  }): Promise<PlanRow[]> {
    let query = this.database.db
      .selectFrom("plans")
      .selectAll()
      .where("deleted_at", "is", null);
    const search = input.search;
    if (search) {
      query = query.where((expression) =>
        expression.or([
          expression("name", "ilike", `%${search}%`),
          expression("slug", "ilike", `%${search}%`),
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

  async update(
    transaction: Transaction<AdminDatabase>,
    planId: string,
    changes: Updateable<AdminDatabase["plans"]>,
  ): Promise<PlanRow | undefined> {
    return transaction
      .updateTable("plans")
      .set(changes)
      .where("id", "=", planId)
      .where("deleted_at", "is", null)
      .returningAll()
      .executeTakeFirst();
  }

  async addPrice(
    transaction: Transaction<AdminDatabase>,
    planId: string,
    input: {
      currency: string;
      billingInterval: "monthly" | "yearly";
      amountCents: number;
      effectiveFrom?: Date;
    },
  ): Promise<PlanPriceRow> {
    await transaction
      .updateTable("plan_prices")
      .set({ effective_to: input.effectiveFrom ?? new Date() })
      .where("plan_id", "=", planId)
      .where("currency", "=", input.currency)
      .where("billing_interval", "=", input.billingInterval)
      .where("effective_to", "is", null)
      .execute();
    return transaction
      .insertInto("plan_prices")
      .values({
        plan_id: planId,
        currency: input.currency,
        billing_interval: input.billingInterval,
        amount_cents: String(input.amountCents),
        ...(input.effectiveFrom ? { effective_from: input.effectiveFrom } : {}),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }
}
