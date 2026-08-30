import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `.execute(db);

  await db.schema
    .createTable("identities")
    .addColumn("id", "uuid", (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("email", "varchar(320)", (column) => column.notNull())
    .addColumn("display_name", "varchar(160)")
    .addColumn("normalized_email", "varchar(320)", (column) =>
      column.notNull().unique(),
    )
    .addColumn("password_hash", "text", (column) => column.notNull())
    .addColumn("realm", "varchar(20)", (column) => column.notNull())
    .addColumn("tenant_id", "uuid", (column) =>
      column.references("tenants.id").onDelete("restrict"),
    )
    .addColumn("status", "varchar(30)", (column) =>
      column.notNull().defaultTo("pending"),
    )
    .addColumn("must_change_password", "boolean", (column) =>
      column.notNull().defaultTo(true),
    )
    .addColumn("mfa_required", "boolean", (column) =>
      column.notNull().defaultTo(true),
    )
    .addColumn("password_changed_at", "timestamptz")
    .addColumn("last_login_at", "timestamptz")
    .addColumn("locked_until", "timestamptz")
    .addColumn("created_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("deleted_at", "timestamptz")
    .addCheckConstraint(
      "chk_identities_realm",
      sql`realm IN ('platform', 'tenant')`,
    )
    .addCheckConstraint(
      "chk_identities_realm_tenant",
      sql`(realm = 'platform' AND tenant_id IS NULL) OR (realm = 'tenant' AND tenant_id IS NOT NULL)`,
    )
    .addCheckConstraint(
      "chk_identities_status",
      sql`status IN ('pending', 'active', 'locked', 'disabled')`,
    )
    .execute();

  await sql`
    CREATE INDEX idx_identities_tenant_status
    ON identities (tenant_id, status)
    WHERE deleted_at IS NULL
  `.execute(db);

  await db.schema
    .createTable("mfa_factors")
    .addColumn("id", "uuid", (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("identity_id", "uuid", (column) =>
      column.notNull().unique().references("identities.id").onDelete("cascade"),
    )
    .addColumn("type", "varchar(20)", (column) =>
      column.notNull().defaultTo("totp"),
    )
    .addColumn("secret_ciphertext", "text", (column) => column.notNull())
    .addColumn("last_used_step", "bigint")
    .addColumn("enabled_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addCheckConstraint("chk_mfa_factors_type", sql`type = 'totp'`)
    .execute();

  await db.schema
    .createTable("mfa_backup_codes")
    .addColumn("id", "uuid", (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("factor_id", "uuid", (column) =>
      column.notNull().references("mfa_factors.id").onDelete("cascade"),
    )
    .addColumn("code_hash", "text", (column) => column.notNull())
    .addColumn("used_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint("uq_mfa_backup_codes_factor_hash", [
      "factor_id",
      "code_hash",
    ])
    .execute();

  await sql`
    CREATE INDEX idx_mfa_backup_codes_factor_unused
    ON mfa_backup_codes (factor_id)
    WHERE used_at IS NULL
  `.execute(db);

  for (const table of ["identities", "mfa_factors"]) {
    await sql`
      CREATE TRIGGER ${sql.ref(`${table}_updated_at_trigger`)}
      BEFORE UPDATE ON ${sql.ref(table)}
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `.execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const table of ["mfa_factors", "identities"]) {
    await sql`
      DROP TRIGGER IF EXISTS ${sql.ref(`${table}_updated_at_trigger`)}
      ON ${sql.ref(table)}
    `.execute(db);
  }
  await db.schema.dropTable("mfa_backup_codes").ifExists().execute();
  await db.schema.dropTable("mfa_factors").ifExists().execute();
  await db.schema.dropTable("identities").ifExists().execute();
  await sql`DROP FUNCTION IF EXISTS update_updated_at_column()`.execute(db);
}
