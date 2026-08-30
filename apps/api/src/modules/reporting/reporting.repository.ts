import { Injectable } from "@nestjs/common";
import { sql } from "kysely";
import { AdminDatabaseService } from "../../common/database.module.js";

export interface DashboardSummaryRow {
  mrr_cents: string;
  active_tenants: number;
  trialing_tenants: number;
  suspended_tenants: number;
  new_tenants: number;
  received_cents: string;
  outstanding_cents: string;
  paid_attempts: number;
  failed_attempts: number;
  canceled_subscriptions: number;
  active_at_period_start: number;
}

@Injectable()
export class ReportingRepository {
  constructor(private readonly database: AdminDatabaseService) {}

  async summary(from: Date, to: Date): Promise<DashboardSummaryRow> {
    const result = await sql<DashboardSummaryRow>`
      WITH collectible AS (
        SELECT id, total_cents
        FROM invoices
        WHERE status IN ('open', 'overdue')
      ), paid_by_invoice AS (
        SELECT payment.invoice_id, sum(payment.amount_cents) AS paid_cents
        FROM payments payment
        INNER JOIN collectible invoice ON invoice.id = payment.invoice_id
        WHERE payment.status = 'paid'
        GROUP BY payment.invoice_id
      )
      SELECT
        (
          SELECT coalesce(round(sum(
            CASE billing_interval
              WHEN 'monthly' THEN amount_cents
              ELSE amount_cents / 12.0
            END
          )), 0)::bigint
          FROM subscriptions
          WHERE status IN ('active', 'past_due')
        ) AS mrr_cents,
        (SELECT count(*)::int FROM tenants WHERE status = 'active') AS active_tenants,
        (SELECT count(DISTINCT tenant_id)::int FROM subscriptions WHERE status = 'trialing') AS trialing_tenants,
        (SELECT count(*)::int FROM tenants WHERE status = 'suspended') AS suspended_tenants,
        (SELECT count(*)::int FROM tenants WHERE created_at >= ${from} AND created_at < ${to}) AS new_tenants,
        (
          SELECT coalesce(sum(amount_cents), 0)::bigint
          FROM payments
          WHERE status = 'paid' AND paid_at >= ${from} AND paid_at < ${to}
        ) AS received_cents,
        (
          SELECT coalesce(sum(greatest(i.total_cents - coalesce(p.paid_cents, 0), 0)), 0)::bigint
          FROM collectible i
          LEFT JOIN paid_by_invoice p ON p.invoice_id = i.id
        ) AS outstanding_cents,
        (
          SELECT count(*)::int FROM payments
          WHERE status = 'paid' AND paid_at >= ${from} AND paid_at < ${to}
        ) AS paid_attempts,
        (
          SELECT count(*)::int FROM payments
          WHERE status = 'failed' AND failed_at >= ${from} AND failed_at < ${to}
        ) AS failed_attempts,
        (
          SELECT count(*)::int FROM subscriptions
          WHERE canceled_at >= ${from} AND canceled_at < ${to}
        ) AS canceled_subscriptions,
        (
          SELECT count(*)::int FROM subscriptions
          WHERE created_at < ${from}
            AND (canceled_at IS NULL OR canceled_at >= ${from})
        ) AS active_at_period_start
    `.execute(this.database.db);
    return (
      result.rows[0] ?? {
        mrr_cents: "0",
        active_tenants: 0,
        trialing_tenants: 0,
        suspended_tenants: 0,
        new_tenants: 0,
        received_cents: "0",
        outstanding_cents: "0",
        paid_attempts: 0,
        failed_attempts: 0,
        canceled_subscriptions: 0,
        active_at_period_start: 0,
      }
    );
  }

  async series(
    from: Date,
    to: Date,
  ): Promise<
    {
      period: string;
      received_cents: string;
      new_tenants: number;
      subscription_value_cents: string;
    }[]
  > {
    const result = await sql<{
      period: string;
      received_cents: string;
      new_tenants: number;
      subscription_value_cents: string;
    }>`
      WITH periods AS (
        SELECT generate_series(
          date_trunc('month', ${from}::timestamptz),
          date_trunc('month', ${to}::timestamptz),
          interval '1 month'
        ) AS period_start
      )
      SELECT
        to_char(p.period_start, 'YYYY-MM') AS period,
        coalesce((
          SELECT sum(pay.amount_cents)::bigint
          FROM payments pay
          WHERE pay.status = 'paid'
            AND pay.paid_at >= p.period_start
            AND pay.paid_at < p.period_start + interval '1 month'
        ), 0)::bigint AS received_cents,
        coalesce((
          SELECT count(*)::int
          FROM tenants t
          WHERE t.created_at >= p.period_start
            AND t.created_at < p.period_start + interval '1 month'
        ), 0)::int AS new_tenants,
        coalesce((
          SELECT round(sum(
            CASE s.billing_interval
              WHEN 'monthly' THEN s.amount_cents
              ELSE s.amount_cents / 12.0
            END
          ))::bigint
          FROM subscriptions s
          WHERE s.created_at < p.period_start + interval '1 month'
            AND (s.canceled_at IS NULL OR s.canceled_at >= p.period_start)
        ), 0)::bigint AS subscription_value_cents
      FROM periods p
      ORDER BY p.period_start
    `.execute(this.database.db);
    return [...result.rows];
  }

  async planDistribution(): Promise<
    { plan_id: string; plan_name: string; tenants: number }[]
  > {
    const result = await sql<{
      plan_id: string;
      plan_name: string;
      tenants: number;
    }>`
      SELECT p.id AS plan_id, p.name AS plan_name, count(t.id)::int AS tenants
      FROM plans p
      LEFT JOIN tenants t ON t.plan_id = p.id AND t.status = 'active'
      WHERE p.deleted_at IS NULL
      GROUP BY p.id, p.name
      ORDER BY tenants DESC, p.name ASC
    `.execute(this.database.db);
    return [...result.rows];
  }

  async paymentDistribution(
    from: Date,
    to: Date,
  ): Promise<{ status: string; total: number; amount_cents: string }[]> {
    const result = await sql<{
      status: string;
      total: number;
      amount_cents: string;
    }>`
      SELECT status, count(*)::int AS total, coalesce(sum(amount_cents), 0)::bigint AS amount_cents
      FROM payments
      WHERE created_at >= ${from} AND created_at < ${to}
      GROUP BY status
      ORDER BY status
    `.execute(this.database.db);
    return [...result.rows];
  }

  async attentionItems(): Promise<{
    overdueInvoices: {
      id: string;
      number: string;
      tenantId: string;
      totalCents: string;
      dueDate: string | Date;
    }[];
    failedProvisioning: {
      id: string;
      name: string;
      errorCode: string | null;
      updatedAt: Date;
    }[];
  }> {
    const [overdue, failed] = await Promise.all([
      this.database.db
        .selectFrom("invoices")
        .select(["id", "number", "tenant_id", "total_cents", "due_date"])
        .where("status", "in", ["open", "overdue"])
        .where("due_date", "<", new Date().toISOString().slice(0, 10))
        .orderBy("due_date", "asc")
        .limit(5)
        .execute(),
      this.database.db
        .selectFrom("tenants")
        .select(["id", "name", "last_error_code", "updated_at"])
        .where("status", "=", "failed")
        .orderBy("updated_at", "desc")
        .limit(5)
        .execute(),
    ]);
    return {
      overdueInvoices: overdue.map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        tenantId: invoice.tenant_id,
        totalCents: invoice.total_cents,
        dueDate: invoice.due_date,
      })),
      failedProvisioning: failed.map((tenant) => ({
        id: tenant.id,
        name: tenant.name,
        errorCode: tenant.last_error_code,
        updatedAt: tenant.updated_at,
      })),
    };
  }

  async listAuditLogs(input: {
    limit: number;
    tenantId?: string;
    action?: string;
    before?: { createdAt: Date; id: string };
  }) {
    let query = this.database.db
      .selectFrom("platform_audit_logs")
      .leftJoin(
        "identities",
        "identities.id",
        "platform_audit_logs.actor_identity_id",
      )
      .select([
        "platform_audit_logs.id",
        "platform_audit_logs.actor_identity_id",
        "identities.email as actor_email",
        "platform_audit_logs.action",
        "platform_audit_logs.resource",
        "platform_audit_logs.resource_id",
        "platform_audit_logs.tenant_id",
        "platform_audit_logs.request_id",
        "platform_audit_logs.correlation_id",
        "platform_audit_logs.created_at",
      ]);
    if (input.tenantId) {
      query = query.where("platform_audit_logs.tenant_id", "=", input.tenantId);
    }
    if (input.action) {
      query = query.where("platform_audit_logs.action", "=", input.action);
    }
    const before = input.before;
    if (before) {
      query = query.where((expression) =>
        expression.or([
          expression("platform_audit_logs.created_at", "<", before.createdAt),
          expression.and([
            expression("platform_audit_logs.created_at", "=", before.createdAt),
            expression("platform_audit_logs.id", "<", before.id),
          ]),
        ]),
      );
    }
    return query
      .orderBy("platform_audit_logs.created_at", "desc")
      .orderBy("platform_audit_logs.id", "desc")
      .limit(input.limit + 1)
      .execute();
  }
}
