import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE INDEX idx_payments_paid_at
    ON payments (paid_at)
    WHERE status = 'paid' AND paid_at IS NOT NULL
  `.execute(db);
  await db.schema
    .createIndex("idx_payments_created")
    .on("payments")
    .columns(["created_at", "id"])
    .execute();
  await db.schema
    .createIndex("idx_payments_invoice_status")
    .on("payments")
    .columns(["invoice_id", "status"])
    .execute();
  await db.schema
    .createIndex("idx_invoices_subscription_id")
    .on("invoices")
    .column("subscription_id")
    .execute();
  await sql`
    CREATE INDEX idx_payments_failed_at
    ON payments (failed_at)
    WHERE status = 'failed' AND failed_at IS NOT NULL
  `.execute(db);
  await db.schema
    .createIndex("idx_subscriptions_created")
    .on("subscriptions")
    .columns(["created_at", "id"])
    .execute();
  await db.schema
    .createIndex("idx_subscriptions_tenant_created")
    .on("subscriptions")
    .columns(["tenant_id", "created_at", "id"])
    .execute();
  await db.schema
    .createIndex("idx_subscriptions_canceled")
    .on("subscriptions")
    .column("canceled_at")
    .execute();
  await sql`
    CREATE UNIQUE INDEX uq_plan_prices_active
    ON plan_prices (plan_id, currency, billing_interval)
    WHERE effective_to IS NULL
  `.execute(db);
  await sql`
    CREATE INDEX idx_platform_outbox_unprocessed_typed
    ON platform_outbox (event_type, created_at)
    WHERE processed_at IS NULL
  `.execute(db);
  await sql`
    CREATE INDEX idx_invoices_collectible_due
    ON invoices (due_date, tenant_id)
    WHERE status IN ('open', 'overdue')
  `.execute(db);
  await db.schema
    .createIndex("idx_platform_audit_created_id")
    .on("platform_audit_logs")
    .columns(["created_at", "id"])
    .execute();
  await db.schema
    .createIndex("idx_platform_audit_action_created")
    .on("platform_audit_logs")
    .columns(["action", "created_at", "id"])
    .execute();
  await db.schema
    .createIndex("idx_invoices_status_created_id")
    .on("invoices")
    .columns(["status", "created_at", "id"])
    .execute();
  await db.schema
    .createIndex("idx_subscriptions_status_created_id")
    .on("subscriptions")
    .columns(["status", "created_at", "id"])
    .execute();
  await db.schema
    .createIndex("idx_invoices_created_id")
    .on("invoices")
    .columns(["created_at", "id"])
    .execute();
  await db.schema
    .createIndex("idx_plans_created_id")
    .on("plans")
    .columns(["created_at", "id"])
    .execute();
  await db.schema
    .createIndex("idx_tenants_created")
    .on("tenants")
    .columns(["created_at", "id"])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex("idx_tenants_created").ifExists().execute();
  await db.schema.dropIndex("idx_plans_created_id").ifExists().execute();
  await db.schema.dropIndex("idx_invoices_created_id").ifExists().execute();
  await db.schema
    .dropIndex("idx_subscriptions_status_created_id")
    .ifExists()
    .execute();
  await db.schema
    .dropIndex("idx_invoices_status_created_id")
    .ifExists()
    .execute();
  await db.schema
    .dropIndex("idx_platform_audit_action_created")
    .ifExists()
    .execute();
  await db.schema
    .dropIndex("idx_platform_audit_created_id")
    .ifExists()
    .execute();
  await db.schema
    .dropIndex("idx_invoices_collectible_due")
    .ifExists()
    .execute();
  await db.schema
    .dropIndex("idx_platform_outbox_unprocessed_typed")
    .ifExists()
    .execute();
  await db.schema.dropIndex("uq_plan_prices_active").ifExists().execute();
  await db.schema
    .dropIndex("idx_invoices_subscription_id")
    .ifExists()
    .execute();
  await db.schema.dropIndex("idx_subscriptions_canceled").ifExists().execute();
  await db.schema.dropIndex("idx_subscriptions_created").ifExists().execute();
  await db.schema
    .dropIndex("idx_subscriptions_tenant_created")
    .ifExists()
    .execute();
  await db.schema.dropIndex("idx_payments_failed_at").ifExists().execute();
  await db.schema.dropIndex("idx_payments_invoice_status").ifExists().execute();
  await db.schema.dropIndex("idx_payments_created").ifExists().execute();
  await db.schema.dropIndex("idx_payments_paid_at").ifExists().execute();
}
