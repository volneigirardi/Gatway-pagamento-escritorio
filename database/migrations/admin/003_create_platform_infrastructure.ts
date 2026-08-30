import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("platform_audit_logs")
    .addColumn("id", "uuid", (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("actor_identity_id", "uuid", (column) =>
      column.references("identities.id").onDelete("set null"),
    )
    .addColumn("action", "varchar(128)", (column) => column.notNull())
    .addColumn("resource", "varchar(128)", (column) => column.notNull())
    .addColumn("resource_id", "uuid")
    .addColumn("tenant_id", "uuid", (column) =>
      column.references("tenants.id").onDelete("set null"),
    )
    .addColumn("metadata", "jsonb", (column) =>
      column.notNull().defaultTo(sql`'{}'::jsonb`),
    )
    .addColumn("ip_address", "varchar(45)")
    .addColumn("user_agent", "text")
    .addColumn("request_id", "uuid")
    .addColumn("correlation_id", "uuid")
    .addColumn("created_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex("idx_platform_audit_created")
    .on("platform_audit_logs")
    .column("created_at")
    .execute();
  await db.schema
    .createIndex("idx_platform_audit_actor_created")
    .on("platform_audit_logs")
    .columns(["actor_identity_id", "created_at"])
    .execute();
  await db.schema
    .createIndex("idx_platform_audit_tenant_created")
    .on("platform_audit_logs")
    .columns(["tenant_id", "created_at"])
    .execute();

  await db.schema
    .createTable("platform_idempotency_keys")
    .addColumn("id", "uuid", (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("actor_identity_id", "uuid", (column) =>
      column.references("identities.id").onDelete("set null"),
    )
    .addColumn("scope", "varchar(128)", (column) => column.notNull())
    .addColumn("key", "varchar(255)", (column) => column.notNull())
    .addColumn("request_hash", "varchar(64)", (column) => column.notNull())
    .addColumn("status", "varchar(20)", (column) =>
      column.notNull().defaultTo("pending"),
    )
    .addColumn("response_status", "integer")
    .addColumn("response", "jsonb")
    .addColumn("expires_at", "timestamptz", (column) => column.notNull())
    .addColumn("created_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("updated_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addUniqueConstraint("uq_platform_idempotency_scope_key", ["scope", "key"])
    .addCheckConstraint(
      "chk_platform_idempotency_status",
      sql`status IN ('pending', 'completed', 'failed')`,
    )
    .execute();

  await db.schema
    .createIndex("idx_platform_idempotency_expires")
    .on("platform_idempotency_keys")
    .column("expires_at")
    .execute();

  await db.schema
    .createTable("platform_outbox")
    .addColumn("id", "uuid", (column) =>
      column.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("aggregate_type", "varchar(128)", (column) => column.notNull())
    .addColumn("aggregate_id", "uuid", (column) => column.notNull())
    .addColumn("event_type", "varchar(128)", (column) => column.notNull())
    .addColumn("event_version", "varchar(20)", (column) =>
      column.notNull().defaultTo("v1"),
    )
    .addColumn("payload", "jsonb", (column) => column.notNull())
    .addColumn("metadata", "jsonb", (column) =>
      column.notNull().defaultTo(sql`'{}'::jsonb`),
    )
    .addColumn("attempts", "integer", (column) => column.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (column) =>
      column.notNull().defaultTo(sql`now()`),
    )
    .addColumn("processed_at", "timestamptz")
    .addCheckConstraint("chk_platform_outbox_attempts", sql`attempts >= 0`)
    .execute();

  await db.schema
    .createIndex("idx_platform_outbox_unprocessed")
    .on("platform_outbox")
    .columns(["processed_at", "created_at"])
    .execute();

  await sql`
    CREATE TRIGGER platform_idempotency_keys_updated_at_trigger
    BEFORE UPDATE ON platform_idempotency_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TRIGGER IF EXISTS platform_idempotency_keys_updated_at_trigger
    ON platform_idempotency_keys
  `.execute(db);
  await db.schema.dropTable("platform_outbox").ifExists().execute();
  await db.schema.dropTable("platform_idempotency_keys").ifExists().execute();
  await db.schema.dropTable("platform_audit_logs").ifExists().execute();
}
