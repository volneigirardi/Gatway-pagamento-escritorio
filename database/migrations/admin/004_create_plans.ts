import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("plans")
    .addColumn("id", "uuid", (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("name", "varchar(120)", (column) => column.notNull())
    .addColumn("slug", "varchar(100)", (column) => column.notNull().unique())
    .addColumn("description", "text")
    .addColumn("status", "varchar(20)", (column) =>
      column.notNull().defaultTo("draft"),
    )
    .addColumn("trial_days", "integer", (column) =>
      column.notNull().defaultTo(0),
    )
    .addColumn("created_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz")
    .addCheckConstraint(
      "chk_plans_status",
      sql`status IN ('draft', 'active', 'archived')`,
    )
    .addCheckConstraint(
      "chk_plans_trial_days",
      sql`trial_days >= 0 AND trial_days <= 365`,
    )
    .execute();

  await sql`
    CREATE INDEX idx_plans_status_name
    ON plans (status, name)
    WHERE deleted_at IS NULL
  `.execute(db);

  await db.schema
    .createTable("plan_prices")
    .addColumn("id", "uuid", (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("plan_id", "uuid", (column) =>
      column.notNull().references("plans.id").onDelete("restrict"),
    )
    .addColumn("currency", "varchar(3)", (column) =>
      column.notNull().defaultTo("BRL"),
    )
    .addColumn("billing_interval", "varchar(20)", (column) => column.notNull())
    .addColumn("amount_cents", "bigint", (column) => column.notNull())
    .addColumn("effective_from", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("effective_to", "timestamptz")
    .addColumn("created_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint("uq_plan_prices_version", [
      "plan_id",
      "currency",
      "billing_interval",
      "effective_from",
    ])
    .addCheckConstraint(
      "chk_plan_prices_currency",
      sql`currency ~ '^[A-Z]{3}$'`,
    )
    .addCheckConstraint(
      "chk_plan_prices_interval",
      sql`billing_interval IN ('monthly', 'yearly')`,
    )
    .addCheckConstraint("chk_plan_prices_amount", sql`amount_cents >= 0`)
    .addCheckConstraint(
      "chk_plan_prices_period",
      sql`effective_to IS NULL OR effective_to > effective_from`,
    )
    .execute();

  await db.schema
    .createIndex("idx_plan_prices_lookup")
    .on("plan_prices")
    .columns(["plan_id", "currency", "billing_interval", "effective_from"])
    .execute();

  await db.schema
    .createTable("plan_features")
    .addColumn("id", "uuid", (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("plan_id", "uuid", (column) =>
      column.notNull().references("plans.id").onDelete("cascade"),
    )
    .addColumn("key", "varchar(128)", (column) => column.notNull())
    .addColumn("value", "jsonb", (column) => column.notNull())
    .addColumn("created_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint("uq_plan_features_plan_key", ["plan_id", "key"])
    .addCheckConstraint(
      "chk_plan_features_key",
      sql`key ~ '^[a-z0-9][a-z0-9._:-]{0,127}$'`,
    )
    .execute();

  for (const table of ["plans", "plan_features"]) {
    await sql`
      CREATE TRIGGER ${sql.ref(`${table}_updated_at_trigger`)}
      BEFORE UPDATE ON ${sql.ref(table)}
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `.execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table of ["plan_features", "plans"]) {
    await sql`
      DROP TRIGGER IF EXISTS ${sql.ref(`${table}_updated_at_trigger`)}
      ON ${sql.ref(table)}
    `.execute(db);
  }
  await db.schema.dropTable("plan_features").ifExists().execute();
  await db.schema.dropTable("plan_prices").ifExists().execute();
  await db.schema.dropTable("plans").ifExists().execute();
}
