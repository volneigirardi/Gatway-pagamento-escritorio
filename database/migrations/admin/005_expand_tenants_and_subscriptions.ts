import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE tenants
      ALTER COLUMN database_name DROP NOT NULL,
      ALTER COLUMN database_host DROP NOT NULL,
      ALTER COLUMN status SET DEFAULT 'draft'
  `.execute(db);

  await db.schema
    .alterTable("tenants")
    .addColumn("legal_name", "varchar(255)")
    .addColumn("trade_name", "varchar(255)")
    .addColumn("tax_id", "varchar(14)")
    .addColumn("contact_email", "varchar(320)")
    .addColumn("plan_id", "uuid", (column) =>
      column.references("plans.id").onDelete("restrict"),
    )
    .addColumn("provisioning_status", "varchar(30)", (column) =>
      column.notNull().defaultTo("not_started"),
    )
    .addColumn("database_port", "integer")
    .addColumn("created_by_identity_id", "uuid", (column) =>
      column.references("identities.id").onDelete("set null"),
    )
    .addColumn("activated_at", "timestamptz")
    .addColumn("suspended_at", "timestamptz")
    .addColumn("last_error_code", "varchar(100)")
    .execute();

  await sql`
    DO $validate_tax_id$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM tenants
        WHERE tax_id IS NOT NULL
        GROUP BY tax_id
        HAVING count(*) > 1
        LIMIT 1
      ) THEN
        RAISE EXCEPTION 'Duplicate non-null tax_id values exist; resolve before applying uq_tenants_tax_id';
      END IF;
    END
    $validate_tax_id$;
  `.execute(db);

  await sql`
    ALTER TABLE tenants
      ADD CONSTRAINT uq_tenants_tax_id UNIQUE (tax_id),
      ADD CONSTRAINT chk_tenants_status
        CHECK (status IN ('draft', 'provisioning', 'pending_admin', 'active', 'suspended', 'failed', 'archived')),
      ADD CONSTRAINT chk_tenants_provisioning_status
        CHECK (provisioning_status IN ('not_started', 'queued', 'running', 'completed', 'failed')),
      ADD CONSTRAINT chk_tenants_tax_id
        CHECK (tax_id IS NULL OR tax_id ~ '^[0-9]{14}$'),
      ADD CONSTRAINT chk_tenants_database_port
        CHECK (database_port IS NULL OR database_port BETWEEN 1 AND 65535)
  `.execute(db);

  await db.schema
    .createIndex("idx_tenants_status_created")
    .on("tenants")
    .columns(["status", "created_at"])
    .execute();
  await db.schema
    .createIndex("idx_tenants_plan_status")
    .on("tenants")
    .columns(["plan_id", "status"])
    .execute();

  await db.schema
    .createTable("tenant_provisioning_attempts")
    .addColumn("id", "uuid", (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("tenant_id", "uuid", (column) =>
      column.notNull().references("tenants.id").onDelete("cascade"),
    )
    .addColumn("job_key", "varchar(255)", (column) => column.notNull().unique())
    .addColumn("status", "varchar(20)", (column) => column.notNull())
    .addColumn("attempt", "integer", (column) => column.notNull().defaultTo(1))
    .addColumn("error_code", "varchar(100)")
    .addColumn("error_detail", "text")
    .addColumn("started_at", "timestamptz")
    .addColumn("completed_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint(
      "chk_tenant_provisioning_attempts_status",
      sql`status IN ('queued', 'running', 'completed', 'failed')`,
    )
    .addCheckConstraint(
      "chk_tenant_provisioning_attempts_attempt",
      sql`attempt > 0`,
    )
    .execute();

  await db.schema
    .createIndex("idx_tenant_provisioning_tenant_created")
    .on("tenant_provisioning_attempts")
    .columns(["tenant_id", "created_at"])
    .execute();

  await db.schema
    .createTable("subscriptions")
    .addColumn("id", "uuid", (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("tenant_id", "uuid", (column) =>
      column.notNull().references("tenants.id").onDelete("restrict"),
    )
    .addColumn("plan_id", "uuid", (column) =>
      column.notNull().references("plans.id").onDelete("restrict"),
    )
    .addColumn("plan_price_id", "uuid", (column) =>
      column.notNull().references("plan_prices.id").onDelete("restrict"),
    )
    .addColumn("status", "varchar(20)", (column) => column.notNull())
    .addColumn("currency", "varchar(3)", (column) => column.notNull())
    .addColumn("billing_interval", "varchar(20)", (column) => column.notNull())
    .addColumn("amount_cents", "bigint", (column) => column.notNull())
    .addColumn("current_period_start", "timestamptz", (column) =>
      column.notNull(),
    )
    .addColumn("current_period_end", "timestamptz", (column) =>
      column.notNull(),
    )
    .addColumn("trial_ends_at", "timestamptz")
    .addColumn("canceled_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint(
      "chk_subscriptions_status",
      sql`status IN ('pending', 'trialing', 'active', 'past_due', 'suspended', 'canceled')`,
    )
    .addCheckConstraint(
      "chk_subscriptions_currency",
      sql`currency ~ '^[A-Z]{3}$'`,
    )
    .addCheckConstraint(
      "chk_subscriptions_interval",
      sql`billing_interval IN ('monthly', 'yearly')`,
    )
    .addCheckConstraint("chk_subscriptions_amount", sql`amount_cents >= 0`)
    .addCheckConstraint(
      "chk_subscriptions_period",
      sql`current_period_end > current_period_start`,
    )
    .execute();

  await sql`
    CREATE UNIQUE INDEX uq_subscriptions_tenant_current
    ON subscriptions (tenant_id)
    WHERE status IN ('pending', 'trialing', 'active', 'past_due', 'suspended')
  `.execute(db);
  await db.schema
    .createIndex("idx_subscriptions_status_period_end")
    .on("subscriptions")
    .columns(["status", "current_period_end"])
    .execute();

  for (const table of [
    "tenants",
    "tenant_provisioning_attempts",
    "subscriptions",
  ]) {
    await sql`
      CREATE TRIGGER ${sql.ref(`${table}_updated_at_trigger`)}
      BEFORE UPDATE ON ${sql.ref(table)}
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `.execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  const incompleteTenants = await sql<{ count: number }>`
    SELECT count(*)::int AS count
    FROM tenants
    WHERE database_name IS NULL
      OR database_host IS NULL
      OR status = 'provisioning'
      OR provisioning_status IN ('queued', 'running')
  `.execute(db);
  if ((incompleteTenants.rows[0]?.count ?? 0) > 0) {
    throw new Error(
      "Cannot roll back tenant expansion while provisioning-state tenants are active",
    );
  }

  for (const table of [
    "subscriptions",
    "tenant_provisioning_attempts",
    "tenants",
  ]) {
    await sql`
      DROP TRIGGER IF EXISTS ${sql.ref(`${table}_updated_at_trigger`)}
      ON ${sql.ref(table)}
    `.execute(db);
  }

  await db.schema.dropTable("subscriptions").ifExists().execute();
  await db.schema
    .dropTable("tenant_provisioning_attempts")
    .ifExists()
    .execute();

  await db.schema.dropIndex("idx_tenants_plan_status").ifExists().execute();

  await sql`
    DROP INDEX IF EXISTS idx_tenants_status_created;
    ALTER TABLE tenants
      DROP CONSTRAINT chk_tenants_database_port,
      DROP CONSTRAINT chk_tenants_tax_id,
      DROP CONSTRAINT chk_tenants_provisioning_status,
      DROP CONSTRAINT chk_tenants_status,
      DROP COLUMN last_error_code,
      DROP COLUMN suspended_at,
      DROP COLUMN activated_at,
      DROP COLUMN created_by_identity_id,
      DROP COLUMN database_port,
      DROP COLUMN provisioning_status,
      DROP COLUMN plan_id,
      DROP COLUMN contact_email,
      DROP COLUMN tax_id,
      DROP COLUMN trade_name,
      DROP COLUMN legal_name,
      ALTER COLUMN status SET DEFAULT 'active',
      ALTER COLUMN database_host SET NOT NULL,
      ALTER COLUMN database_name SET NOT NULL
  `.execute(db);
}
