import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE invoice_items
      ADD COLUMN tenant_id uuid
  `.execute(db);

  await sql`
    UPDATE invoice_items
    SET tenant_id = invoices.tenant_id
    FROM invoices
    WHERE invoice_items.invoice_id = invoices.id
  `.execute(db);

  await sql`
    ALTER TABLE invoice_items
      ALTER COLUMN tenant_id SET NOT NULL
  `.execute(db);

  await sql`
    ALTER TABLE invoices
      ADD CONSTRAINT uq_invoices_tenant_id
        UNIQUE (tenant_id, id)
  `.execute(db);

  await sql`
    ALTER TABLE invoice_items
      DROP CONSTRAINT IF EXISTS invoice_items_invoice_id_fkey,
      ADD CONSTRAINT fk_invoice_items_tenant_invoice
        FOREIGN KEY (tenant_id, invoice_id) REFERENCES invoices(tenant_id, id)
        ON DELETE CASCADE
  `.execute(db);

  await sql`
    ALTER TABLE payments
      DROP CONSTRAINT IF EXISTS payments_invoice_id_fkey,
      DROP CONSTRAINT IF EXISTS payments_tenant_id_fkey,
      ADD CONSTRAINT fk_payments_tenant_invoice
        FOREIGN KEY (tenant_id, invoice_id) REFERENCES invoices(tenant_id, id)
        ON DELETE RESTRICT
  `.execute(db);

  await sql`
    CREATE INDEX idx_payments_tenant_invoice
      ON payments (tenant_id, invoice_id)
  `.execute(db);

  await sql`
    DROP INDEX IF EXISTS idx_platform_audit_created
  `.execute(db);

  await sql`
    ALTER TABLE payments
      ADD CONSTRAINT chk_payments_paid_status
        CHECK (status != 'paid' OR paid_at IS NOT NULL),
      ADD CONSTRAINT chk_payments_failed_status
        CHECK (status != 'failed' OR failed_at IS NOT NULL),
      ADD CONSTRAINT chk_payments_refunded_status
        CHECK (status != 'refunded' OR refunded_at IS NOT NULL)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE payments
      DROP CONSTRAINT IF EXISTS chk_payments_refunded_status,
      DROP CONSTRAINT IF EXISTS chk_payments_failed_status,
      DROP CONSTRAINT IF EXISTS chk_payments_paid_status
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS idx_platform_audit_created
      ON platform_audit_logs (created_at)
  `.execute(db);

  await sql`
    DROP INDEX IF EXISTS idx_payments_tenant_invoice
  `.execute(db);

  await sql`
    ALTER TABLE payments
      DROP CONSTRAINT IF EXISTS fk_payments_tenant_invoice,
      ADD CONSTRAINT payments_invoice_id_fkey
        FOREIGN KEY (invoice_id) REFERENCES invoices(id)
        ON DELETE RESTRICT,
      ADD CONSTRAINT payments_tenant_id_fkey
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        ON DELETE RESTRICT
  `.execute(db);

  await sql`
    ALTER TABLE invoice_items
      DROP CONSTRAINT IF EXISTS fk_invoice_items_tenant_invoice,
      ADD CONSTRAINT invoice_items_invoice_id_fkey
        FOREIGN KEY (invoice_id) REFERENCES invoices(id)
        ON DELETE CASCADE
  `.execute(db);

  await sql`
    ALTER TABLE invoices
      DROP CONSTRAINT IF EXISTS uq_invoices_tenant_id
  `.execute(db);

  await sql`
    ALTER TABLE invoice_items
      DROP COLUMN tenant_id
  `.execute(db);
}
