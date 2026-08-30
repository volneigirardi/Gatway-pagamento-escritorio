import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("invoices")
    .addColumn("deleted_at", "timestamptz")
    .execute();

  await sql`
    ALTER TABLE invoice_items
      ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN deleted_at timestamptz
  `.execute(db);

  await db.schema
    .alterTable("payments")
    .addColumn("deleted_at", "timestamptz")
    .execute();

  await db.schema
    .alterTable("subscriptions")
    .addColumn("deleted_at", "timestamptz")
    .execute();

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_tenant_id
    ON subscriptions (tenant_id, id)
  `.execute(db);

  await sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM invoices i
        JOIN subscriptions s ON s.id = i.subscription_id
        WHERE i.tenant_id <> s.tenant_id
        LIMIT 1
      ) THEN
        RAISE EXCEPTION 'Invoice/subscription tenant mismatch detected; resolve before applying fk_invoices_subscription';
      END IF;
    END $$;

    ALTER TABLE invoices
      DROP CONSTRAINT IF EXISTS invoices_subscription_id_fkey,
      ADD CONSTRAINT fk_invoices_subscription
        FOREIGN KEY (tenant_id, subscription_id) REFERENCES subscriptions(tenant_id, id)
        ON DELETE RESTRICT
  `.execute(db);

  await sql`
    DROP INDEX IF EXISTS idx_invoice_items_invoice;
    CREATE INDEX idx_invoice_items_tenant_invoice
    ON invoice_items (tenant_id, invoice_id)
  `.execute(db);

  await sql`
    DROP TRIGGER IF EXISTS invoice_items_updated_at_trigger ON invoice_items;
    CREATE TRIGGER invoice_items_updated_at_trigger
    BEFORE UPDATE ON invoice_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  `.execute(db);

  await sql`
    DROP INDEX IF EXISTS uq_subscriptions_tenant_current;
    CREATE UNIQUE INDEX uq_subscriptions_tenant_current
    ON subscriptions (tenant_id)
    WHERE deleted_at IS NULL
      AND status IN ('pending', 'trialing', 'active', 'past_due', 'suspended')
  `.execute(db);

  await sql`
    DROP INDEX IF EXISTS uq_payments_tenant_provider_reference;
    CREATE UNIQUE INDEX uq_payments_tenant_provider_reference
    ON payments (tenant_id, provider, external_reference)
    WHERE deleted_at IS NULL
      AND external_reference IS NOT NULL
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS uq_payments_tenant_provider_reference;
    CREATE UNIQUE INDEX uq_payments_tenant_provider_reference
    ON payments (tenant_id, provider, external_reference)
    WHERE deleted_at IS NULL
      AND external_reference IS NOT NULL
  `.execute(db);

  await sql`
    DROP INDEX IF EXISTS uq_subscriptions_tenant_current;
    CREATE UNIQUE INDEX uq_subscriptions_tenant_current
    ON subscriptions (tenant_id)
    WHERE deleted_at IS NULL
      AND status IN ('pending', 'trialing', 'active', 'past_due', 'suspended')
  `.execute(db);

  await sql`
    DROP TRIGGER IF EXISTS invoice_items_updated_at_trigger ON invoice_items;
    DROP INDEX IF EXISTS idx_invoice_items_tenant_invoice;
    CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items (invoice_id);
  `.execute(db);

  await sql`
    ALTER TABLE invoices
      DROP CONSTRAINT IF EXISTS fk_invoices_subscription,
      ADD CONSTRAINT invoices_subscription_id_fkey
        FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
        ON DELETE RESTRICT
  `.execute(db);

  await sql`
    DROP INDEX IF EXISTS uq_subscriptions_tenant_id;
  `.execute(db);

  await db.schema
    .alterTable("invoice_items")
    .dropColumn("updated_at")
    .execute();
  await db.schema
    .alterTable("invoice_items")
    .dropColumn("deleted_at")
    .execute();
  await db.schema.alterTable("invoices").dropColumn("deleted_at").execute();
  await db.schema.alterTable("payments").dropColumn("deleted_at").execute();
  await db.schema
    .alterTable("subscriptions")
    .dropColumn("deleted_at")
    .execute();
}
