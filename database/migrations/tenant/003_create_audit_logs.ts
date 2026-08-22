import { type Kysely, sql } from "kysely";

const tableName = "audit_logs";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable(tableName)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("tenant_id", "uuid", (col) => col.notNull())
    .addColumn("actor_id", "uuid")
    .addColumn("action", "varchar(255)", (col) => col.notNull())
    .addColumn("resource", "varchar(255)", (col) => col.notNull())
    .addColumn("resource_id", "varchar(255)")
    .addColumn("before_state", "jsonb")
    .addColumn("after_state", "jsonb")
    .addColumn("ip_address", "varchar(45)")
    .addColumn("user_agent", "text")
    .addColumn("correlation_id", "uuid")
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex("idx_audit_logs_tenant_created")
    .on(tableName)
    .columns(["tenant_id", "created_at"])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable(tableName).ifExists().execute();
}
