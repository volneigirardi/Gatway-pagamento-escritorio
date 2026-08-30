import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("invoices")
    .addColumn("id", "uuid", (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("tenant_id", "uuid", (column) =>
      column.notNull().references("tenants.id").onDelete("restrict"),
    )
    .addColumn("subscription_id", "uuid", (column) =>
      column.notNull().references("subscriptions.id").onDelete("restrict"),
    )
    .addColumn("number", "varchar(50)", (column) => column.notNull())
    .addColumn("status", "varchar(20)", (column) =>
      column.notNull().defaultTo("draft"),
    )
    .addColumn("currency", "varchar(3)", (column) =>
      column.notNull().defaultTo("BRL"),
    )
    .addColumn("subtotal_cents", "bigint", (column) => column.notNull())
    .addColumn("discount_cents", "bigint", (column) =>
      column.notNull().defaultTo(0),
    )
    .addColumn("tax_cents", "bigint", (column) => column.notNull().defaultTo(0))
    .addColumn("total_cents", "bigint", (column) => column.notNull())
    .addColumn("due_date", "date", (column) => column.notNull())
    .addColumn("issued_at", "timestamptz")
    .addColumn("paid_at", "timestamptz")
    .addColumn("voided_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint("uq_invoices_tenant_number", ["tenant_id", "number"])
    .addCheckConstraint(
      "chk_invoices_status",
      sql`status IN ('draft', 'open', 'paid', 'overdue', 'void')`,
    )
    .addCheckConstraint("chk_invoices_currency", sql`currency ~ '^[A-Z]{3}$'`)
    .addCheckConstraint(
      "chk_invoices_amounts",
      sql`subtotal_cents >= 0 AND discount_cents >= 0 AND tax_cents >= 0 AND total_cents >= 0`,
    )
    .addCheckConstraint(
      "chk_invoices_total",
      sql`total_cents = subtotal_cents - discount_cents + tax_cents`,
    )
    .execute();

  await db.schema
    .createIndex("idx_invoices_status_due")
    .on("invoices")
    .columns(["status", "due_date"])
    .execute();
  await db.schema
    .createIndex("idx_invoices_tenant_created")
    .on("invoices")
    .columns(["tenant_id", "created_at"])
    .execute();

  await db.schema
    .createTable("invoice_items")
    .addColumn("id", "uuid", (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("invoice_id", "uuid", (column) =>
      column.notNull().references("invoices.id").onDelete("cascade"),
    )
    .addColumn("description", "varchar(500)", (column) => column.notNull())
    .addColumn("quantity", "integer", (column) => column.notNull().defaultTo(1))
    .addColumn("unit_amount_cents", "bigint", (column) => column.notNull())
    .addColumn("total_cents", "bigint", (column) => column.notNull())
    .addColumn("created_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint("chk_invoice_items_quantity", sql`quantity > 0`)
    .addCheckConstraint(
      "chk_invoice_items_amounts",
      sql`unit_amount_cents >= 0 AND total_cents = unit_amount_cents * quantity`,
    )
    .execute();

  await db.schema
    .createIndex("idx_invoice_items_invoice")
    .on("invoice_items")
    .column("invoice_id")
    .execute();

  await db.schema
    .createTable("payments")
    .addColumn("id", "uuid", (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("tenant_id", "uuid", (column) =>
      column.notNull().references("tenants.id").onDelete("restrict"),
    )
    .addColumn("invoice_id", "uuid", (column) =>
      column.notNull().references("invoices.id").onDelete("restrict"),
    )
    .addColumn("provider", "varchar(50)", (column) =>
      column.notNull().defaultTo("internal"),
    )
    .addColumn("external_reference", "varchar(255)")
    .addColumn("method", "varchar(30)", (column) => column.notNull())
    .addColumn("status", "varchar(20)", (column) =>
      column.notNull().defaultTo("pending"),
    )
    .addColumn("currency", "varchar(3)", (column) =>
      column.notNull().defaultTo("BRL"),
    )
    .addColumn("amount_cents", "bigint", (column) => column.notNull())
    .addColumn("failure_code", "varchar(100)")
    .addColumn("paid_at", "timestamptz")
    .addColumn("failed_at", "timestamptz")
    .addColumn("refunded_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint(
      "chk_payments_method",
      sql`method IN ('manual', 'bank_transfer', 'pix', 'card', 'other')`,
    )
    .addCheckConstraint(
      "chk_payments_status",
      sql`status IN ('pending', 'paid', 'failed', 'refunded', 'canceled')`,
    )
    .addCheckConstraint("chk_payments_currency", sql`currency ~ '^[A-Z]{3}$'`)
    .addCheckConstraint("chk_payments_amount", sql`amount_cents > 0`)
    .execute();

  await sql`
    CREATE UNIQUE INDEX uq_payments_tenant_provider_reference
      ON payments (tenant_id, provider, external_reference)
      WHERE external_reference IS NOT NULL
  `.execute(db);

  await db.schema
    .createIndex("idx_payments_status_created")
    .on("payments")
    .columns(["status", "created_at"])
    .execute();
  await db.schema
    .createIndex("idx_payments_tenant_created")
    .on("payments")
    .columns(["tenant_id", "created_at"])
    .execute();

  for (const table of ["invoices", "payments"]) {
    await sql`
      CREATE TRIGGER ${sql.ref(`${table}_updated_at_trigger`)}
      BEFORE UPDATE ON ${sql.ref(table)}
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `.execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table of ["payments", "invoices"]) {
    await sql`
      DROP TRIGGER IF EXISTS ${sql.ref(`${table}_updated_at_trigger`)}
      ON ${sql.ref(table)}
    `.execute(db);
  }
  await db.schema.dropTable("payments").ifExists().execute();
  await db.schema.dropTable("invoice_items").ifExists().execute();
  await db.schema.dropTable("invoices").ifExists().execute();
}
