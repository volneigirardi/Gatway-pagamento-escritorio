import { Injectable } from "@nestjs/common";
import {
  dashboardSchema,
  type AuditLogQuery,
  type Dashboard,
  type DashboardQuery,
} from "@saas/contracts";
import { decodeCursor, encodeCursor } from "../../common/cursor.js";
import { toDateOnly } from "../../common/date-only.js";
import { RedisService } from "../../common/redis.module.js";
import { toSafeInteger } from "../../common/safe-integer.js";
import { ReportingRepository } from "./reporting.repository.js";

function periodStart(period: DashboardQuery["period"], now: Date): Date {
  const from = new Date(now);
  if (period === "30d") from.setUTCDate(from.getUTCDate() - 30);
  if (period === "90d") from.setUTCDate(from.getUTCDate() - 90);
  if (period === "12m") from.setUTCMonth(from.getUTCMonth() - 12);
  return from;
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10_000) / 100;
}

@Injectable()
export class ReportingService {
  constructor(
    private readonly repository: ReportingRepository,
    private readonly redis: RedisService,
  ) {}

  async dashboard(period: DashboardQuery["period"]): Promise<Dashboard> {
    const cacheKey = `platform:dashboard:${period}`;
    const cached = await this.redis.client.get(cacheKey);
    if (cached) {
      try {
        const cachedValue: unknown = JSON.parse(cached) as unknown;
        const parsed = dashboardSchema.safeParse(cachedValue);
        if (parsed.success) return parsed.data;
      } catch {
        await this.redis.client.del(cacheKey);
      }
    }

    const to = new Date();
    const from = periodStart(period, to);
    const [summary, series, plans, payments, attention] = await Promise.all([
      this.repository.summary(from, to),
      this.repository.series(from, to),
      this.repository.planDistribution(),
      this.repository.paymentDistribution(from, to),
      this.repository.attentionItems(),
    ]);
    const mrrCents = toSafeInteger(summary.mrr_cents, "MRR");
    const activeTenants = summary.active_tenants;
    const paymentAttempts = summary.paid_attempts + summary.failed_attempts;
    const result = dashboardSchema.parse({
      generatedAt: new Date().toISOString(),
      period: {
        key: period,
        from: from.toISOString(),
        to: to.toISOString(),
      },
      metrics: {
        mrrCents,
        arrCents: toSafeInteger(mrrCents * 12, "ARR"),
        activeTenants,
        trialingTenants: summary.trialing_tenants,
        suspendedTenants: summary.suspended_tenants,
        newTenants: summary.new_tenants,
        receivedCents: toSafeInteger(summary.received_cents, "received amount"),
        outstandingCents: toSafeInteger(
          summary.outstanding_cents,
          "outstanding amount",
        ),
        arpaCents: activeTenants > 0 ? Math.round(mrrCents / activeTenants) : 0,
        paymentSuccessRate: ratio(summary.paid_attempts, paymentAttempts),
        churnRate: ratio(
          summary.canceled_subscriptions,
          summary.active_at_period_start,
        ),
      },
      series: series.map((item) => ({
        period: item.period,
        receivedCents: toSafeInteger(item.received_cents, "series received"),
        newTenants: item.new_tenants,
        subscriptionValueCents: toSafeInteger(
          item.subscription_value_cents,
          "series subscription value",
        ),
      })),
      planDistribution: plans.map((item) => ({
        planId: item.plan_id,
        planName: item.plan_name,
        tenants: item.tenants,
      })),
      paymentDistribution: payments.map((item) => ({
        status: item.status,
        total: item.total,
        amountCents: toSafeInteger(item.amount_cents, "payment distribution"),
      })),
      attention: {
        overdueInvoices: attention.overdueInvoices.map((invoice) => ({
          ...invoice,
          dueDate: toDateOnly(invoice.dueDate),
          totalCents: toSafeInteger(
            invoice.totalCents,
            "overdue invoice total",
          ),
        })),
        failedProvisioning: attention.failedProvisioning.map((tenant) => ({
          ...tenant,
          updatedAt: tenant.updatedAt.toISOString(),
        })),
      },
    });
    await this.redis.client.set(cacheKey, JSON.stringify(result), "EX", 30);
    return result;
  }

  async auditLogs(input: AuditLogQuery): Promise<{
    items: Record<string, unknown>[];
    nextCursor: string | null;
  }> {
    const before = decodeCursor(input.cursor);
    const rows = await this.repository.listAuditLogs({
      limit: input.limit,
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      ...(input.action ? { action: input.action } : {}),
      ...(before ? { before } : {}),
    });
    const hasMore = rows.length > input.limit;
    const page = rows.slice(0, input.limit);
    const last = page.at(-1);
    return {
      items: page.map((row) => ({
        id: row.id,
        actorIdentityId: row.actor_identity_id,
        actorEmail: row.actor_email,
        action: row.action,
        resource: row.resource,
        resourceId: row.resource_id,
        tenantId: row.tenant_id,
        requestId: row.request_id,
        correlationId: row.correlation_id,
        createdAt: row.created_at.toISOString(),
      })),
      nextCursor:
        hasMore && last
          ? encodeCursor({ createdAt: last.created_at, id: last.id })
          : null,
    };
  }
}
