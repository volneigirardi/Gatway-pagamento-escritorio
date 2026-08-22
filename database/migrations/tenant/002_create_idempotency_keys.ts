import { type Kysely, sql } from "kysely";

const tableName = "idempotency_keys";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable(tableName)
    .addColumn("id", "uuid", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn("tenant_id", "uuid", (col) => col.notNull())
    .addColumn("key", "varchar(255)", (col) => col.notNull())
    .addColumn("scope", "varchar(255)", (col) => col.notNull())
    .addColumn("status", "varchar(50)", (col) => col.notNull())
    .addColumn("response", "jsonb")
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createIndex("idx_idempotency_keys_tenant_scope_key")
    .on(tableName)
    .columns(["tenant_id", "scope", "key"])
    .unique()
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable(tableName).ifExists().execute();
}
