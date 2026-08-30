import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "@saas/auth";
import type {
  CreatePlanPriceRequest,
  CreatePlanRequest,
  UpdatePlanRequest,
} from "@saas/contracts";
import type { Transaction } from "kysely";
import type { AdminDatabase } from "../../common/admin-database.js";
import { decodeCursor, encodeCursor } from "../../common/cursor.js";
import { toSafeInteger } from "../../common/safe-integer.js";
import {
  PlatformIdempotencyService,
  type IdempotentResult,
} from "../../common/platform-idempotency.service.js";
import { PlansRepository, type PlanDetails } from "./plans.repository.js";

function response(details: PlanDetails): Record<string, unknown> {
  return {
    id: details.plan.id,
    name: details.plan.name,
    slug: details.plan.slug,
    description: details.plan.description,
    status: details.plan.status,
    trialDays: details.plan.trial_days,
    createdAt: details.plan.created_at.toISOString(),
    updatedAt: details.plan.updated_at.toISOString(),
    prices: details.prices.map((price) => ({
      id: price.id,
      currency: price.currency,
      billingInterval: price.billing_interval,
      amountCents: toSafeInteger(price.amount_cents, "plan price"),
      effectiveFrom: price.effective_from.toISOString(),
      effectiveTo: price.effective_to?.toISOString() ?? null,
    })),
    features: Object.fromEntries(
      details.features.map((feature) => [feature.key, feature.value]),
    ),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

function isCheckViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23514"
  );
}

@Injectable()
export class PlansService {
  constructor(
    private readonly repository: PlansRepository,
    private readonly idempotency: PlatformIdempotencyService,
  ) {}

  async create(
    user: AuthenticatedUser,
    key: string,
    input: CreatePlanRequest,
  ): Promise<IdempotentResult<Record<string, unknown>>> {
    if (user.realm !== "platform") throw new ConflictException("Invalid realm");
    try {
      return await this.idempotency.execute({
        scope: "platform.plans.create",
        key,
        actorIdentityId: user.userId,
        request: input,
        callback: async (transaction) => {
          const details = await this.repository.create(transaction, {
            name: input.name,
            slug: input.slug,
            ...(input.description ? { description: input.description } : {}),
            trialDays: input.trialDays,
            currency: input.price.currency,
            billingInterval: input.price.billingInterval,
            amountCents: input.price.amountCents,
            features: input.features,
          });
          await this.recordMutation(
            transaction,
            user.userId,
            "platform.plan.created",
            details.plan.id,
            { slug: details.plan.slug },
          );
          return response(details);
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("Plan slug already exists");
      }
      throw error;
    }
  }

  async list(input: {
    limit: number;
    cursor?: string;
    search?: string;
    status?: string;
  }): Promise<{ items: Record<string, unknown>[]; nextCursor: string | null }> {
    const status = input.status;
    if (status && !["draft", "active", "archived"].includes(status)) {
      throw new BadRequestException("Invalid plan status");
    }
    const before = decodeCursor(input.cursor);
    const rows = await this.repository.list({
      limit: input.limit,
      ...(input.search ? { search: input.search } : {}),
      ...(status ? { status: status as "draft" | "active" | "archived" } : {}),
      ...(before ? { before } : {}),
    });
    const hasMore = rows.length > input.limit;
    const page = rows.slice(0, input.limit);
    const last = page.at(-1);
    return {
      items: page.map((plan) => ({
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
        description: plan.description,
        status: plan.status,
        trialDays: plan.trial_days,
        createdAt: plan.created_at.toISOString(),
        updatedAt: plan.updated_at.toISOString(),
      })),
      nextCursor:
        hasMore && last
          ? encodeCursor({ createdAt: last.created_at, id: last.id })
          : null,
    };
  }

  async get(planId: string): Promise<Record<string, unknown>> {
    const details = await this.repository.findById(planId);
    if (!details) throw new NotFoundException("Plan not found");
    return response(details);
  }

  async update(
    user: AuthenticatedUser,
    planId: string,
    key: string,
    input: UpdatePlanRequest,
  ): Promise<IdempotentResult<Record<string, unknown>>> {
    if (user.realm !== "platform") throw new ConflictException("Invalid realm");
    return this.idempotency.execute({
      scope: `platform.plans.update:${planId}`,
      key,
      actorIdentityId: user.userId,
      request: input,
      callback: async (transaction) => {
        const plan = await this.repository.update(transaction, planId, {
          ...(input.name ? { name: input.name } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.trialDays !== undefined
            ? { trial_days: input.trialDays }
            : {}),
          ...(input.status ? { status: input.status } : {}),
        });
        if (!plan) throw new NotFoundException("Plan not found");
        await this.recordMutation(
          transaction,
          user.userId,
          "platform.plan.updated",
          plan.id,
          { status: plan.status },
        );
        const details = await this.repository.findById(plan.id, transaction);
        if (!details) throw new NotFoundException("Plan not found");
        return response(details);
      },
    });
  }

  async addPrice(
    user: AuthenticatedUser,
    planId: string,
    key: string,
    input: CreatePlanPriceRequest,
  ): Promise<IdempotentResult<Record<string, unknown>>> {
    if (user.realm !== "platform") throw new ConflictException("Invalid realm");
    return this.idempotency.execute({
      scope: `platform.plans.price.create:${planId}`,
      key,
      actorIdentityId: user.userId,
      request: input,
      callback: async (transaction) => {
        const existing = await this.repository.findById(planId, transaction);
        if (!existing) throw new NotFoundException("Plan not found");
        let price: Awaited<ReturnType<typeof this.repository.addPrice>>;
        try {
          price = await this.repository.addPrice(transaction, planId, {
            currency: input.currency,
            billingInterval: input.billingInterval,
            amountCents: input.amountCents,
            ...(input.effectiveFrom
              ? { effectiveFrom: new Date(input.effectiveFrom) }
              : {}),
          });
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new ConflictException(
              "Active price already exists for this plan/currency/interval",
            );
          }
          if (isCheckViolation(error)) {
            throw new BadRequestException(
              "effectiveFrom must be after the existing active price start",
            );
          }
          throw error;
        }
        const value = {
          id: price.id,
          planId: price.plan_id,
          currency: price.currency,
          billingInterval: price.billing_interval,
          amountCents: toSafeInteger(price.amount_cents, "plan price"),
          effectiveFrom: price.effective_from.toISOString(),
          effectiveTo: price.effective_to?.toISOString() ?? null,
        };
        await this.recordMutation(
          transaction,
          user.userId,
          "platform.plan.price_created",
          planId,
          value,
        );
        return value;
      },
    });
  }

  private async recordMutation(
    transaction: Transaction<AdminDatabase>,
    actorIdentityId: string,
    eventType: string,
    planId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await transaction
      .insertInto("platform_outbox")
      .values({
        aggregate_type: "Plan",
        aggregate_id: planId,
        event_type: eventType,
        payload,
      })
      .execute();
    await transaction
      .insertInto("platform_audit_logs")
      .values({
        actor_identity_id: actorIdentityId,
        action: eventType,
        resource: "plan",
        resource_id: planId,
        metadata: payload,
      })
      .execute();
  }
}
